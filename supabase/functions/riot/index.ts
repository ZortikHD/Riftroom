// Riot-Abfrage für Riftroom: Riot-ID rein, Rang, Mastery und die meistgespielten Champions der letzten Ranked-Spiele raus.
// Der Riot-Key kommt nur aus dem Secret RIOT_API_KEY, geht nur im Header an Riot und wird nie zurückgegeben oder geloggt.
// Alle Abfragen teilen sich ein Budget in der Datenbank (riot_take), damit der Key nie über Riots Limit kommt.
// Ergebnisse werden zwischengespeichert: Konten 7 Tage, Profile 20 Minuten, einzelne Spiele dauerhaft (sie ändern sich nie).
import { createClient } from 'npm:@supabase/supabase-js@2';

// Nur den eigentlichen Key nehmen: Beim Kopieren rutschen leicht Leerzeichen, andere Bindestriche oder unsichtbare
// Zeichen mit. Deshalb nach „RGAPI“ die 32 Hex-Ziffern einsammeln und den Key sauber neu zusammensetzen.
const RAW = Deno.env.get('RIOT_API_KEY') ?? '';
function cleanKey(raw: string) {
  const at = raw.toUpperCase().indexOf('RGAPI');
  if (at < 0) return '';
  const hex = raw.slice(at + 5).replace(/[^0-9a-fA-F]/g, '').slice(0, 32).toLowerCase();
  if (hex.length !== 32) return '';
  return `RGAPI-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const KEY = cleanKey(RAW);
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const ORIGINS = ['https://zortikhd.github.io', 'http://127.0.0.1:8766', 'http://localhost:8766'];
const PLATFORM: Record<string, string> = { euw: 'euw1', eune: 'eun1', na: 'na1', kr: 'kr', tr: 'tr1', br: 'br1', lan: 'la1', las: 'la2', oce: 'oc1', jp: 'jp1', ru: 'ru', me: 'me1', sg: 'sg2', tw: 'tw2', vn: 'vn2' };
const REGIONAL: Record<string, string> = { euw: 'europe', eune: 'europe', tr: 'europe', ru: 'europe', me: 'europe', na: 'americas', br: 'americas', lan: 'americas', las: 'americas', kr: 'asia', jp: 'asia', oce: 'sea', sg: 'sea', tw: 'sea', vn: 'sea' };
const SR_QUEUES = new Set([400, 420, 430, 440, 490]); // Summoner's Rift: Draft, Solo/Duo, Blind, Flex, Quickplay
const MATCHES = 20;

class Busy { constructor(public ms: number) {} }
class KeyProblem {}
class NotFound {}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Anfragen beim gemeinsamen Budget anmelden; kurz warten, wenn nötig, sonst „busy“ melden.
async function take(n: number) {
  const until = Date.now() + 20000;
  for (;;) {
    const { data, error } = await db.rpc('riot_take', { p_n: n });
    if (error) throw new Error('budget ' + (error.code || '') + ' ' + String(error.message || '').slice(0, 60));
    if (data === 0) return;
    if (Date.now() + data > until) throw new Busy(data);
    await sleep(data);
  }
}
async function riot(url: string) {
  const r = await fetch(url, { headers: { 'X-Riot-Token': KEY } });
  if (r.status === 200) return await r.json();
  await r.body?.cancel();
  if (r.status === 404) return null;
  if (r.status === 429) throw new Busy((Number(r.headers.get('Retry-After')) || 10) * 1000);
  if (r.status === 401 || r.status === 403) throw new KeyProblem();
  throw new Error('upstream ' + r.status);
}

async function lookup(name: string, tag: string, region: string) {
  const plat = PLATFORM[region], reg = REGIONAL[region], acctReg = reg === 'sea' ? 'asia' : reg;
  // 1. Konto (Riot-ID -> puuid)
  const akey = `${region}|${name.toLowerCase()}#${tag.toLowerCase()}`;
  let acct = (await db.from('riot_accounts').select('puuid,name,tag').eq('key', akey).gt('at', new Date(Date.now() - 7 * 864e5).toISOString()).maybeSingle()).data;
  if (!acct) {
    await take(1);
    const a = await riot(`https://${acctReg}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
    if (!a?.puuid) throw new NotFound();
    acct = { puuid: a.puuid, name: a.gameName || name, tag: a.tagLine || tag };
    await db.from('riot_accounts').upsert({ key: akey, ...acct, at: new Date().toISOString() });
  }
  const puuid = acct.puuid;
  // 2. Fertiges Profil aus den letzten 20 Minuten
  const pkey = `${region}|${puuid}`;
  const cached = (await db.from('riot_profiles').select('data').eq('key', pkey).gt('at', new Date(Date.now() - 20 * 6e4).toISOString()).maybeSingle()).data;
  if (cached) return { ...cached.data, cached: true };
  // 3. Spiel-IDs, Rang und Mastery
  await take(3);
  const [ranked, league, mastery] = await Promise.all([
    riot(`https://${reg}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?type=ranked&count=${MATCHES}`),
    riot(`https://${plat}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`),
    riot(`https://${plat}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=8`),
  ]);
  let ids: string[] = Array.isArray(ranked) ? ranked : [];
  let onlyRanked = true;
  // Kaum Ranked gespielt: dann auch normale Spiele auf Summoner's Rift nehmen.
  if (ids.length < 5) {
    await take(1);
    const all = await riot(`https://${reg}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${MATCHES}`);
    if (Array.isArray(all) && all.length > ids.length) { ids = all; onlyRanked = false; }
  }
  // 4. Nur Spiele laden, die noch nicht gespeichert sind (alle zehn Teilnehmer auf einmal speichern)
  const have = new Set(((await db.from('riot_matches').select('match_id').eq('puuid', puuid).in('match_id', ids.length ? ids : ['-'])).data || []).map((r: { match_id: string }) => r.match_id));
  const missing = ids.filter(id => !have.has(id));
  for (let i = 0; i < missing.length; i += 5) {
    const batch = missing.slice(i, i + 5);
    await take(batch.length);
    const games = await Promise.all(batch.map(id => riot(`https://${reg}.api.riotgames.com/lol/match/v5/matches/${id}`)));
    const rows = [];
    for (let k = 0; k < batch.length; k++) {
      const g = games[k], info = g?.info;
      if (!info?.participants) { rows.push({ match_id: batch[k], puuid, champ: '-', pos: '', win: false, q: -1, dur: 0 }); continue; }
      const end = info.gameEndTimestamp || info.gameCreation || Date.now();
      for (const p of info.participants) {
        rows.push({ match_id: batch[k], puuid: p.puuid, champ: String(p.championName || '-').slice(0, 30), pos: String(p.teamPosition || p.individualPosition || '').slice(0, 10), win: !!p.win, k: p.kills | 0, d: p.deaths | 0, a: p.assists | 0, q: info.queueId | 0, dur: info.gameDuration | 0, at: new Date(end).toISOString() });
      }
    }
    if (rows.length) await db.from('riot_matches').upsert(rows, { onConflict: 'match_id,puuid', ignoreDuplicates: true });
  }
  // 5. Auswerten: pro Champion und Rolle; Remakes (unter 5 Minuten) und andere Modi zählen nicht.
  const mine = ((await db.from('riot_matches').select('match_id,champ,pos,win,k,d,a,q,dur,at').eq('puuid', puuid).in('match_id', ids.length ? ids : ['-'])).data || [])
    .filter((r: { q: number; dur: number }) => SR_QUEUES.has(r.q) && r.dur >= 300);
  const champs = new Map<string, { id: string; pos: string; n: number; w: number; k: number; d: number; a: number }>();
  const roles: Record<string, number> = {};
  let last = 0;
  for (const r of mine) {
    const key = r.champ + '|' + r.pos;
    const c = champs.get(key) || { id: r.champ, pos: r.pos, n: 0, w: 0, k: 0, d: 0, a: 0 };
    c.n++; if (r.win) c.w++; c.k += r.k; c.d += r.d; c.a += r.a; champs.set(key, c);
    if (r.pos) roles[r.pos] = (roles[r.pos] || 0) + 1;
    last = Math.max(last, Date.parse(r.at) || 0);
  }
  const entry = (t: string) => { const e = Array.isArray(league) ? league.find((x: { queueType: string }) => x.queueType === t) : null; return e ? { tier: e.tier, rank: e.rank, lp: e.leaguePoints, w: e.wins, l: e.losses } : null; };
  const data = {
    name: acct.name, tag: acct.tag, region,
    rank: { solo: entry('RANKED_SOLO_5x5'), flex: entry('RANKED_FLEX_SR') },
    mastery: (Array.isArray(mastery) ? mastery : []).map((m: { championId: number; championLevel: number; championPoints: number }) => ({ c: m.championId, lvl: m.championLevel, pts: m.championPoints })),
    games: mine.length, onlyRanked, last, roles,
    champs: [...champs.values()].sort((a, b) => b.n - a.n || b.w - a.w).slice(0, 25),
    at: Date.now(),
  };
  await db.from('riot_profiles').upsert({ key: pkey, data, at: new Date().toISOString() });
  // Ab und zu aufräumen.
  if (Math.random() < 0.03) {
    await db.from('riot_profiles').delete().lt('at', new Date(Date.now() - 864e5).toISOString());
    await db.from('riot_accounts').delete().lt('at', new Date(Date.now() - 30 * 864e5).toISOString());
    await db.from('riot_matches').delete().lt('at', new Date(Date.now() - 120 * 864e5).toISOString());
  }
  return data;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '';
  const ok = ORIGINS.includes(origin);
  const cors = { 'Access-Control-Allow-Origin': ok ? origin : ORIGINS[0], 'Access-Control-Allow-Headers': 'apikey, content-type, authorization, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
  const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!ok) return out({ error: 'origin' }, 403);
  if (req.method !== 'POST') return out({ error: 'method' }, 405);
  if (!KEY) return out({ error: 'key' });
  let body: { riotId?: unknown; region?: unknown };
  try { body = await req.json(); } catch { return out({ error: 'bad' }, 400); }
  const id = typeof body.riotId === 'string' ? body.riotId.trim() : '';
  const region = typeof body.region === 'string' && PLATFORM[body.region] ? body.region : 'euw';
  const cut = id.lastIndexOf('#');
  const name = cut > 0 ? id.slice(0, cut).trim() : '', tag = cut > 0 ? id.slice(cut + 1).trim() : '';
  if (!/^[\p{L}\p{N} ._'-]{1,24}$/u.test(name) || !/^[\p{L}\p{N}]{2,6}$/u.test(tag)) return out({ error: 'bad' }, 400);
  try {
    return out(await lookup(name, tag, region));
  } catch (e) {
    if (e instanceof NotFound) return out({ error: 'not_found' });
    if (e instanceof Busy) return out({ error: 'busy', retry: Math.ceil(e.ms / 1000) });
    if (e instanceof KeyProblem) return out({ error: 'key' });
    return out({ error: 'upstream' });
  }
});
