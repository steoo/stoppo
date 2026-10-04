// Player progress:
//   { current, best: { [levelIndex]: moves }, updatedAt,
//     devices: { [deviceId]: { moves, hints, undos, resets, solves, timeMs } },
//     days: ['YYYY-MM-DD', ...] }
//
// Counters are kept per device and only ever grow, so merging copies from
// several devices takes the max per device and never double-counts.
//
// Saved in three places and merged on load:
//   - localStorage (browser, and a fast first read in the app)
//   - Preferences (native app storage: durable, included in device backups)
//   - CloudStore (iCloud key-value storage: syncs across the player's devices)

import { callNative, onNative } from './native.js';

const KEY = 'stoppo/v1';

const DEVICE_KEY = 'stoppo/device';
const MAX_DAYS = 400;

export function emptyProgress() {
  return { current: 0, best: {}, updatedAt: 0, devices: {}, days: [] };
}

// A random id for this install, so its counters can be merged with other devices'.
export const deviceId = (() => {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) localStorage.setItem(DEVICE_KEY, (id = Math.random().toString(36).slice(2, 10)));
    return id;
  } catch {
    return 'local';
  }
})();

function parse(json) {
  if (!json) return null;
  try {
    const p = JSON.parse(json);
    if (p && typeof p === 'object') {
      return { ...emptyProgress(), ...p, best: { ...p.best }, devices: { ...p.devices }, days: [...(p.days ?? [])] };
    }
  } catch { /* corrupt entry */ }
  return null;
}

// Best scores keep the lowest per level, counters the highest per device,
// days are unioned, and the current level comes from the most recent save.
export function mergeProgress(a, b) {
  if (!a) return b;
  if (!b) return a;
  const best = { ...a.best };
  for (const [level, moves] of Object.entries(b.best)) {
    if (best[level] == null || moves < best[level]) best[level] = moves;
  }
  const devices = { ...a.devices };
  for (const [id, counters] of Object.entries(b.devices)) {
    const mine = devices[id] ?? {};
    devices[id] = { ...mine };
    for (const [k, v] of Object.entries(counters)) devices[id][k] = Math.max(mine[k] ?? 0, v);
  }
  const days = [...new Set([...a.days, ...b.days])].sort().slice(-MAX_DAYS);
  const newer = b.updatedAt > a.updatedAt ? b : a;
  return { current: newer.current, best, updatedAt: newer.updatedAt, devices, days };
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
