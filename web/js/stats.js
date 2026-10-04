// Player statistics, derived from saved progress (see storage.js).

export const COUNTERS = ['moves', 'hints', 'undos', 'resets', 'solves', 'timeMs'];

// Each cleared level is worth up to 100 points: 100 × par ÷ best.
export function levelScore(par, best) {
  return Math.round((100 * par) / Math.max(best, par));
}

export function computeStats(progress, levels) {
  let cleared = 0, perfect = 0, score = 0;
  for (const [i, best] of Object.entries(progress.best)) {
    const level = levels[i];
    if (!level) continue;
    cleared++;
    if (best <= level.par) perfect++;
    score += levelScore(level.par, best);
  }

  const totals = Object.fromEntries(COUNTERS.map((k) => [k, 0]));
  for (const counters of Object.values(progress.devices)) {
    for (const k of COUNTERS) totals[k] += counters[k] ?? 0;
  }

  return {
    cleared,
    total: levels.length,
    perfect,
    score,
    maxScore: levels.length * 100,
    efficiency: cleared ? Math.round(score / cleared) : null, // % of par, averaged
    streak: dayStreak(progress.days),
    ...totals,
  };
}

export function today(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Consecutive days played, ending today (or yesterday, so the streak survives
// until the player opens the app today).
export function dayStreak(days) {
  const played = new Set(days);
  const d = new Date();
  if (!played.has(today(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (played.has(today(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '<1m';
  const h = Math.floor(minutes / 60);
  return h ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}
