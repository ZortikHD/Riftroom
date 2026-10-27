// Shared by both languages. Data publication and data retrieval are separate steps.
export function restoreMetaMode(saved) {
  return ['published', 'imported', 'disabled'].includes(saved.metaMode)
    ? saved.metaMode : saved.meta ? 'imported' : 'published';
}

export function acceptPublishedMeta(state, snapshot, checkedAt = new Date().toISOString()) {
  if (state.metaMode !== 'published') return false;
  state.meta = snapshot;
  state.lastChecked = checkedAt;
  return true;
}

export async function fetchPublishedBundle(catalog, validateMeta, fetcher = fetch) {
  const response = await fetcher('data/meta.json', {
    cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const next = data.catalog ?? catalog;
  if (!next || !/^\d+\.\d+\.\d+$/.test(next.version) ||
      !Array.isArray(next.champions) || next.champions.length < 100 ||
      !next.champions.every(c => c && /^[A-Za-z0-9]+$/.test(c.id) && typeof c.name === 'string')) {
    throw new Error('Invalid champion catalog');
  }
  const ids = new Set(next.champions.map(c => c.id));
  if (ids.size !== next.champions.length) throw new Error('Duplicate champion');
  // Validate before changing any active data; failed refreshes keep the last good snapshot.
  const snapshot = validateMeta(data.current?.snapshot, ids);
  const previous = data.previous?.snapshot ? validateMeta(data.previous.snapshot, ids) : null;
  return {catalog: next, snapshot, previous, bis: data.bis};
}
