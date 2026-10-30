// Auswertungen aus dem aktuellen und dem vorherigen Meta-Snapshot. Reine Funktionen, ohne Netzwerk.
import {ROLES,adj} from './engine.js';
export const wr = e => e.wins / e.games;
const key = e => e.champion + '|' + e.role;

export function indexMeta(meta) {
  return new Map((meta?.entries || []).map(e => [key(e), e]));
}

export function averageWinrate(meta) {
  const g = meta.entries.reduce((a, e) => a + e.games, 0);
  const w = meta.entries.reduce((a, e) => a + e.wins, 0);
  return g ? w / g : 0.5;
}

// Veränderung der Winrate in Prozentpunkten; nur wenn beide Patches genug Spiele haben.
export function delta(cur, prevIndex, minGames = 2000) {
  const p = prevIndex?.get(key(cur));
  if (!p || cur.games < minGames || p.games < minGames) return null;
  return (wr(cur) - wr(p)) * 100;
}

export function poolCheck(state, cur, prev, catalogById, {drop = 1.0, rise = 1.0} = {}) {
  const prevIndex = prev ? indexMeta(prev) : null;
  const curIndex = indexMeta(cur);
  return state.players.map((player, i) => {
    const role = ROLES[i];
    const inPool = new Set(player.pool.map(p => p.id));
    const items = player.pool.map(p => {
      const e = curIndex.get(p.id + '|' + role);
      if (!e) return {id: p.id, comfort: p.comfort, flag: 'nodata'};
      const d = delta(e, prevIndex);
      const flag = d == null ? 'ok' : d <= -drop ? 'down' : d >= rise ? 'up' : 'ok';
      return {id: p.id, comfort: p.comfort, wr: wr(e) * 100, games: e.games, delta: d, flag};
    }).sort((a, b) => ({down: 0, nodata: 1, ok: 2, up: 3}[a.flag] - {down: 0, nodata: 1, ok: 2, up: 3}[b.flag]));
    const alternatives = cur.entries
      .filter(e => e.role === role && e.games >= 10000 && !inPool.has(e.champion) && catalogById.has(e.champion))
      .sort((a, b) => adj(b) - adj(a)).slice(0, 3)
      .map(e => ({id: e.champion, wr: wr(e) * 100, games: e.games}));
    return {name: player.name, role, items, alternatives, needsAlternatives: items.some(x => x.flag === 'down' || x.flag === 'nodata')};
  });
}

// Ban-Vorschläge mit Begründung.
// Wert ≈ wie viele Prozentpunkte Siegchance uns ein Champion kostet, mal der Chance, dass der Gegner ihn wirklich spielt.
// Drei Quellen: starke Meta-Champions, die Mains der Gegner und Konter gegen eure Comfort-Picks.
// Ein Gegner-Main ist nur einen Ban wert, wenn er auch stark ist: im Meta oder nach den eigenen Spielen des Gegners (Riot-Daten).
// Schwache oder auf der Rolle kaum gespielte Mains landen in „skipped“ und werden als „kein Ban nötig“ angezeigt.
// opts: {opp, personal: [{map: Map(id -> {n, w}), games}] je Rolle, counters: [{id, vs, wr, role}], info: roleInfo der Gegner-Picks,
//        relevance(id, role): 0..1 wie relevant ein Ban für noch offene Rollen ist, taken: Set, n}
export function banPlan(state, meta, catalogById, opts = {}) {
  const {opp = null, personal = [], counters = [], info = null, relevance = () => 1, taken = new Set(), n = 5} = opts;
  const own = new Set(state.players.flatMap(p => p.pool.map(x => x.id)));
  const ok = id => catalogById.has(id) && !own.has(id) && !taken.has(id);
  const avg = meta ? averageWinrate(meta) * 100 : 50;
  const idx = indexMeta(meta);
  const at = (id, role) => idx.get(id + '|' + role);
  const roleOpen = role => !info ? 1 : !info.open.includes(role) ? 0 : info.maybe.has(role) ? 0.5 : 1;
  const cand = new Map(), skipped = [];
  const add = (id, role, value, note) => {
    const c = cand.get(id) || {id, role, parts: []};
    c.parts.push({value, ...note});
    if (!c.role) c.role = role;
    cand.set(id, c);
  };
  // 1. Starke Meta-Champions: Vorteil gegenüber dem Durchschnitt mal Pickrate in ihrer Hauptrolle.
  if (meta) {
    const main = new Map();
    for (const e of meta.entries) { const m = main.get(e.champion); if (!m || e.games > m.games) main.set(e.champion, e); }
    for (const e of main.values()) {
      if (e.games < 10000 || !ok(e.champion)) continue;
      const wrA = adj(e) * 100, edge = wrA - avg;
      if (edge <= 0.3) continue;
      const prob = Math.min(0.35, (e.pickRate || 0) / 100);
      add(e.champion, e.role, edge * prob * relevance(e.champion, e.role), {kind: 'meta', wr: wrA});
    }
  }
  // 2. Mains und meistgespielte Champions der Gegner, pro Rolle.
  if (opp) ROLES.forEach((role, i) => {
    const rel = roleOpen(role);
    if (!rel) return;
    const mains = opp.players[i]?.champs || [], per = personal[i] || null;
    const ids = new Set(mains);
    if (per) for (const [id, x] of per.map) if (x.n >= 3) ids.add(id);
    for (const id of ids) {
      if (!ok(id)) continue;
      const e = at(id, role), base = e ? adj(e) * 100 : avg - 1, p = per?.map.get(id);
      let wrEst, prob;
      if (p) { wrEst = (p.w * 100 + base * 8) / (p.n + 8); prob = Math.min(0.8, Math.max(0.05, p.n / Math.max(5, per.games))); }
      else { wrEst = meta ? base + 2 : avg + 3; prob = Math.min(0.4, 0.8 / Math.max(1, mains.length)); }
      const edge = wrEst - avg;
      const note = {kind: 'main', role, wr: e ? adj(e) * 100 : null, offmeta: meta ? !e : false, n: p?.n || 0, pw: p ? p.w / p.n * 100 : null};
      if (meta && edge <= 0.5) { if (mains.includes(id) || (p && p.n >= 5)) skipped.push({id, ...note, edge}); continue; }
      add(id, role, Math.max(0.05, edge) * prob * rel, note);
    }
  });
  // Team-Favoriten ohne Rolle: wie ein Main mit kleinerer Wahrscheinlichkeit.
  for (const id of (opp?.favorites || [])) {
    if (!ok(id) || cand.has(id) || skipped.some(x => x.id === id)) continue;
    let e = null;
    if (meta) for (const x of meta.entries) if (x.champion === id && (!e || x.games > e.games)) e = x;
    const wrEst = e ? adj(e) * 100 + 1 : avg + 2, edge = wrEst - avg;
    if (meta && edge <= 0.5) { skipped.push({id, kind: 'fav', role: e?.role || null, wr: e ? adj(e) * 100 : null, offmeta: !e, edge}); continue; }
    add(id, e?.role || null, Math.max(0.05, edge) * 0.2 * (e ? relevance(id, e.role) : 1), {kind: 'fav', wr: e ? adj(e) * 100 : null});
  }
  // 3. Konter gegen eure Comfort-Picks auf noch offenen Gegner-Rollen.
  for (const k of counters) {
    if (!ok(k.id)) continue;
    const rel = roleOpen(k.role);
    if (!rel) continue;
    add(k.id, k.role, (k.wr - 50) * 0.2 * (k.weight ?? 1) * rel, {kind: 'counter', vs: k.vs, wr: k.wr});
  }
  const items = [...cand.values()].map(c => {
    c.parts.sort((a, b) => b.value - a.value);
    const value = c.parts[0].value + 0.35 * c.parts.slice(1).reduce((a, x) => a + x.value, 0);
    return {id: c.id, role: c.role, value, notes: c.parts};
  }).filter(x => x.value > 0.02).sort((a, b) => b.value - a.value);
  skipped.sort((a, b) => a.edge - b.edge);
  return {items: items.slice(0, n), skipped: skipped.filter(x => !items.slice(0, n).some(i => i.id === x.id))};
}

export function biggestChanges(cur, prev, n = 5, minGames = 5000) {
  if (!prev) return {risers: [], fallers: []};
  const prevIndex = indexMeta(prev);
  const rows = [];
  for (const e of cur.entries) {
    const d = delta(e, prevIndex, minGames);
    if (d != null) rows.push({id: e.champion, role: e.role, wr: wr(e) * 100, delta: d, games: e.games});
  }
  rows.sort((a, b) => b.delta - a.delta);
  return {risers: rows.filter(r => r.delta > 0).slice(0, n), fallers: rows.slice(-n).reverse().filter(r => r.delta < 0)};
}

// Turnier-Reihenfolge (Solo Queue und Turniere): B = blaue Seite, R = rote Seite.
export const TOURNAMENT_ORDER = [
  ['B', 'ban'], ['R', 'ban'], ['B', 'ban'], ['R', 'ban'], ['B', 'ban'], ['R', 'ban'],
  ['B', 'pick'], ['R', 'pick'], ['R', 'pick'], ['B', 'pick'], ['B', 'pick'], ['R', 'pick'],
  ['R', 'ban'], ['B', 'ban'], ['R', 'ban'], ['B', 'ban'],
  ['R', 'pick'], ['B', 'pick'], ['B', 'pick'], ['R', 'pick']
];
// Liefert alle Schritte mit Status und den aktuellen Schritt.
export function draftTurn(state) {
  const us = state.side === 'red' ? 'R' : 'B';
  const have = {
    'us|ban': state.bans.slice(0, 5).filter(Boolean).length, 'them|ban': state.bans.slice(5, 10).filter(Boolean).length,
    'us|pick': state.allies.filter(Boolean).length, 'them|pick': state.enemies.filter(Boolean).length
  };
  const seen = {};
  let current = -1;
  const steps = TOURNAMENT_ORDER.map(([side, type], i) => {
    const who = side === us ? 'us' : 'them', k = who + '|' + type;
    seen[k] = (seen[k] || 0) + 1;
    const done = have[k] >= seen[k];
    if (!done && current < 0) current = i;
    return {i, side, who, type, n: seen[k], done};
  });
  return {steps, current: current < 0 ? null : steps[current], finished: current < 0};
}
