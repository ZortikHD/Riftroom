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

// Ban-Vorschläge: Einfluss = (geglättete Winrate - Durchschnitt) * Pickrate / (100 - Pickrate).
// Champions aus dem eigenen Pool werden nicht vorgeschlagen.
export function banSuggestions(state, cur, catalogById, n = 5, favorites = new Set()) {
  const own = new Set(state.players.flatMap(p => p.pool.map(x => x.id)));
  const avg = averageWinrate(cur);
  const main = new Map();
  for (const e of cur.entries) {
    const m = main.get(e.champion);
    if (!m || e.games > m.games) main.set(e.champion, e);
  }
  return [...main.values()]
    .filter(e => (e.games >= 10000 || favorites.has(e.champion)) && !own.has(e.champion) && catalogById.has(e.champion))
    .map(e => {
      const pick = e.pickRate ?? 0;
      const fav = favorites.has(e.champion);
      return {id: e.champion, role: e.role, wr: wr(e) * 100, games: e.games, pick: e.pickRate, ban: e.banRate, fav,
        score: (adj(e) - avg) * 100 * pick / Math.max(1, 100 - pick) + (fav ? 1000 : 0)};
    })
    .concat([...favorites].filter(id => !main.has(id) && !own.has(id) && catalogById.has(id))
      .map(id => ({id, role: null, wr: null, games: 0, pick: null, ban: null, fav: true, score: 999})))
    .sort((a, b) => b.score - a.score).slice(0, n);
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
