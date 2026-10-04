// Player progress: { current, best: { [levelIndex]: moves }, updatedAt }.
//
// Saved in three places and merged on load:
//   - localStorage (browser, and a fast first read in the app)
//   - Preferences (native app storage: durable, included in device backups)
//   - CloudStore (iCloud key-value storage: syncs across the player's devices)

import { callNative, onNative } from './native.js';

const KEY = 'stoppo/v1';

export function emptyProgress() {
  return { current: 0, best: {}, updatedAt: 0 };
}

function parse(json) {
  if (!json) return null;
  try {
    const p = JSON.parse(json);
    if (p && typeof p === 'object') return { ...emptyProgress(), ...p, best: { ...p.best } };
  } catch { /* corrupt entry */ }
  return null;
}

// Best scores keep the lowest per level; the current level comes from
// whichever copy was saved most recently.
export function mergeProgress(a, b) {
  if (!a) return b;
  if (!b) return a;
  const best = { ...a.best };
  for (const [level, moves] of Object.entries(b.best)) {
    if (best[level] == null || moves < best[level]) best[level] = moves;
  }
  const newer = b.updatedAt > a.updatedAt ? b : a;
  return { current: newer.current, best, updatedAt: newer.updatedAt };
}

// Synchronous read, so the first frame can render right away.
export function loadLocal() {
  try { return parse(localStorage.getItem(KEY)); } catch { return null; }
}

// Reads every store and merges them.
export async function loadAll() {
  const read = (plugin) => callNative(plugin, 'get', { key: KEY }).then((r) => parse(r?.value)).catch(() => null);
  const [prefs, cloud] = await Promise.all([read('Preferences'), read('CloudStore')]);
  return [prefs, cloud].reduce(mergeProgress, loadLocal()) ?? emptyProgress();
}

export function saveAll(progress) {
  const json = JSON.stringify(progress);
  try { localStorage.setItem(KEY, json); } catch { /* storage unavailable */ }
  callNative('Preferences', 'set', { key: KEY, value: json }).catch(() => {});
  callNative('CloudStore', 'set', { key: KEY, value: json }).catch(() => {});
}

// Called when another device syncs new progress through iCloud.
export function onRemoteProgress(callback) {
  onNative('CloudStore', 'change', ({ key, value }) => {
    const p = key === KEY ? parse(value) : null;
    if (p) callback(p);
  });
}
