import { COLORS, buildAdjacency, initialState, occupancy, movesForCar, isSolved, solve } from './engine.js';
import { LEVELS } from './levels.js';
import { callNative, isReleaseApp } from './native.js';
import { emptyProgress, loadLocal, loadAll, saveAll, mergeProgress, onRemoteProgress, deviceId } from './storage.js';
import { computeStats, levelScore, today, formatDuration } from './stats.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HELP_KEY = 'stoppo/v1/seen-help';
const R_STATION = 0.22;
const R_CAR = 0.29;
const R_GOAL = 0.38;
const TRACK = 0.2;

const $ = (id) => document.getElementById(id);
const board = $('board');

const store = loadLocal() ?? emptyProgress();
let level, adj, positions, history, selected, carEls, hint;
let autoplay = null; // { timer, moves, step } while the solver plays the level
let devReach = -1; // testing only: furthest level opened via ?level=N or auto-solve

// Levels unlock in order: one past the furthest cleared level is playable.
function lastUnlocked() {
  const cleared = Object.keys(store.best).map(Number).filter((i) => i < LEVELS.length);
  const furthest = cleared.length ? Math.max(...cleared) : -1;
  return Math.min(LEVELS.length - 1, Math.max(furthest + 1, devReach));
}

function saveStore() {
  store.updatedAt = Date.now();
  saveAll(store);
}

// Counts a player action toward the stats. Time played adds up the gaps
// between actions, ignoring breaks longer than a minute. Saves are batched.
let lastActionAt = 0;
function track(counter, amount = 1) {
  const mine = (store.devices[deviceId] ??= {});
  mine[counter] = (mine[counter] ?? 0) + amount;
  const now = Date.now();
  if (now - lastActionAt < 60_000) mine.timeMs = (mine.timeMs ?? 0) + (now - lastActionAt);
  lastActionAt = now;
  const day = today();
  if (!store.days.includes(day)) store.days.push(day);
  clearTimeout(track.t);
  track.t = setTimeout(() => saveAll(store), 1500);
}

// Haptic feedback in the native app; a no-op in the browser.
function haptic(method, options) {
  callNative('Haptics', method, options).catch(() => {});
}

function el(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

// ---------- level lifecycle ----------

function loadLevel(index, { save = true } = {}) {
  stopAutoplay();
  store.current = Math.max(0, Math.min(lastUnlocked(), index));
  if (save) saveStore();
  level = LEVELS[store.current];
  adj = buildAdjacency(level);
  positions = initialState(level);
  history = [];
  selected = null;
  hint = null;
  render();
}

function render() {
  board.replaceChildren();
  const xs = level.nodes.map((n) => n[0]);
  const ys = level.nodes.map((n) => n[1]);
  const pad = 0.75;
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
  board.setAttribute('viewBox', `${minX} ${minY} ${Math.max(...xs) - minX + pad} ${Math.max(...ys) - minY + pad}`);

  // Tracks; several lines between the same two stations run side by side
  const tracks = el('g', {}, board);
  const pairs = new Map();
  for (const [a, b, c] of level.edges) {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!pairs.has(key)) pairs.set(key, { a: Math.min(a, b), b: Math.max(a, b), colors: [] });
    pairs.get(key).colors.push(c);
  }
  for (const { a, b, colors } of pairs.values()) {
    const [x1, y1] = level.nodes[a], [x2, y2] = level.nodes[b];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const nx = -(y2 - y1) / len, ny = (x2 - x1) / len; // unit normal
    const width = colors.length > 1 ? TRACK * 0.7 : TRACK;
    colors.forEach((c, k) => {
      const off = (k - (colors.length - 1) / 2) * width * 1.15;
      el('line', {
        x1: x1 + nx * off, y1: y1 + ny * off, x2: x2 + nx * off, y2: y2 + ny * off,
        class: 'track', stroke: COLORS[c].fill, 'stroke-width': width,
      }, tracks);
    });
  }

  // Stations; the goal gets a ring and a halo in Stoppo's color
  const targetColor = COLORS[level.cars[level.target.car][1]].fill;
  const stations = el('g', {}, board);
  level.nodes.forEach(([cx, cy], n) => {
    if (n === level.target.node) {
      el('circle', { cx, cy, r: R_GOAL, class: 'goal-halo', stroke: targetColor }, stations);
      el('circle', { cx, cy, r: R_STATION, class: 'station' }, stations);
      el('circle', { cx, cy, r: R_GOAL, class: 'goal-ring', stroke: targetColor }, stations);
    } else {
      el('circle', { cx, cy, r: R_STATION, class: 'station' }, stations);
    }
  });

  // Destination markers live in their own layer, refreshed on selection
  el('g', { id: 'dests' }, board);

  // Cars; Stoppo (the target car) has eyes that look toward the goal
  const cars = el('g', {}, board);
  carEls = level.cars.map(([, c], i) => {
    const g = el('g', { class: 'car', 'data-car': i }, cars);
    const pip = el('g', { class: 'pip' }, g);
    el('circle', { class: 'ring', r: R_CAR + 0.09 }, pip);
    el('ellipse', { class: 'shadow', cx: 0, cy: 0.06, rx: R_CAR, ry: R_CAR * 0.95 }, pip);
    el('circle', { class: 'body', r: R_CAR, fill: COLORS[c].fill }, pip);
    if (i === level.target.car) {
      for (const ex of [-0.1, 0.1]) {
        el('circle', { class: 'eye', cx: ex, cy: -0.03, r: 0.085 }, pip);
        el('circle', { class: 'pupil', cx: ex, cy: -0.03, r: 0.042 }, pip);
      }
    }
    return g;
  });

  update();
}

function update() {
  carEls.forEach((g, i) => {
    const [x, y] = level.nodes[positions[i]];
    g.style.transform = `translate(${x}px, ${y}px)`;
    g.classList.toggle('selected', i === selected);
    g.classList.toggle('hint', hint?.car === i);
  });

  const dests = $('dests');
  dests.replaceChildren();
  const targets = selected != null ? movesForCar(level, adj, positions, selected) : [];
  const destColor = selected != null ? COLORS[level.cars[selected][1]].fill : '';
  for (const n of targets) {
    const [cx, cy] = level.nodes[n];
    el('circle', { cx, cy, r: 0.13, class: 'dest', fill: destColor, 'data-node': n }, dests);
  }

  // Stoppo looks toward the goal.
  const [sx, sy] = level.nodes[positions[level.target.car]];
  const [gx, gy] = level.nodes[level.target.node];
  const d = Math.hypot(gx - sx, gy - sy) || 1;
  const look = `translate(${((gx - sx) / d) * 0.035}px, ${((gy - sy) / d) * 0.035}px)`;
  for (const pupil of carEls[level.target.car].querySelectorAll('.pupil')) pupil.style.transform = look;

  $('level-name').textContent = level.name;
  $('moves').textContent = history.length;
  $('par').textContent = level.par ?? '–';
  $('btn-undo').disabled = history.length === 0;
  $('btn-reset').disabled = history.length === 0;
  $('btn-prev').disabled = store.current === 0;
  $('btn-next').disabled = store.current >= lastUnlocked();
}

// ---------- moves ----------

function select(i) {
  hint = null;
  if (selected === i) { selected = null; update(); return; }
  const dests = movesForCar(level, adj, positions, i);
  if (!dests.length) {
    selected = null;
    const g = carEls[i];
    g.classList.remove('stuck');
    void g.getBBox(); // restart the animation
    g.classList.add('stuck');
    haptic('notification', { type: 'WARNING' });
    update();
    return;
  }
  selected = i;
  update();
}

function moveTo(node) {
  if (selected == null) return;
  if (!movesForCar(level, adj, positions, selected).includes(node)) return;
  history.push(positions.slice());
  positions[selected] = node;
  selected = null;
  hint = null;
  track('moves');
  haptic('impact', { style: 'LIGHT' });
  update();
  if (isSolved(level, positions)) setTimeout(win, 220);
}

function undo() {
  stopAutoplay();
  if (!history.length) return;
  track('undos');
  positions = history.pop();
  selected = null;
  hint = null;
  update();
}

function reset() {
  stopAutoplay();
  if (history.length) track('resets');
  positions = initialState(level);
  history = [];
  selected = null;
  hint = null;
  update();
}

function showHint() {
  if (isSolved(level, positions)) return;
  const { moves } = solve(level, positions, 600_000);
  if (!moves?.length) { flashStatus('No solution from here — try Undo'); return; }
  const m = moves[0];
  track('hints');
  hint = { car: m.car };
  selected = m.car;
  update();
  // Mark the station the hinted car should go to.
  const dot = $('dests').querySelector(`[data-node="${m.to}"]`);
  if (dot) dot.setAttribute('r', 0.18);
  flashStatus(`${moves.length} moves to go`);
}

// Testing aid: the solver plays the level from the current position.
function toggleAutoplay() {
  if (isReleaseApp) return;
  if (autoplay) { stopAutoplay(); return; }
  if (isSolved(level, positions)) return;
  const { moves } = solve(level, positions);
  if (!moves?.length) { flashStatus('No solution from here — try Reset'); return; }
  // Short solutions play at a watchable pace, long ones speed up (level 100 takes ~25 s).
  const ms = Math.max(40, Math.min(350, 12000 / moves.length));
  board.style.setProperty('--move-ms', `${Math.round(ms * 0.8)}ms`);
  selected = null;
  hint = null;
  autoplay = { moves, step: 0, timer: setInterval(autoStep, ms) };
  $('btn-solve').querySelector('span').textContent = 'Stop';
  update();
}

function autoStep() {
  const { car, to } = autoplay.moves[autoplay.step++];
  history.push(positions.slice());
  positions[car] = to;
  update();
  if (autoplay.step === autoplay.moves.length) {
    stopAutoplay();
    setTimeout(() => win({ auto: true }), 300);
  }
}

function stopAutoplay() {
  if (!autoplay) return;
  clearInterval(autoplay.timer);
  autoplay = null;
  board.style.removeProperty('--move-ms');
  $('btn-solve').querySelector('span').textContent = 'Solve';
}

function flashStatus(text) {
  const toast = $('toast');
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(flashStatus.t);
  flashStatus.t = setTimeout(() => toast.classList.remove('show'), 1800);
}

function win({ auto = false } = {}) {
  const n = history.length;
  const par = level.par;
  let text;
  let title = 'Arrived!';
  if (auto) {
    // Don't record auto-solves as the player's best; just let testing continue.
    devReach = Math.max(devReach, store.current + 1);
    title = 'Solver arrived';
    text = `${level.name} in ${n} move${n === 1 ? '' : 's'} (best possible: ${par}).`;
  } else {
    const prev = store.best[store.current];
    if (prev == null || n < prev) store.best[store.current] = n;
    track('solves');
    saveStore();
    haptic('notification', { type: 'SUCCESS' });
    const points = levelScore(par, n);
    if (n <= par) {
      title = 'Perfect run!';
      text = `${level.name} in ${n} move${n === 1 ? '' : 's'} — the fewest possible. ${points} points.`;
    } else {
      text = `${level.name} in ${n} move${n === 1 ? '' : 's'}. It can be done in ${par}. ${points} points.`;
    }
  }
  $('win-title').textContent = title;
  $('win-text').textContent = text;
  $('win-next').disabled = store.current >= lastUnlocked();
  $('dlg-win').showModal();
}

// ---------- input ----------

function toBoard(evt) {
  const pt = board.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(board.getScreenCTM().inverse());
}

let drag = null;

board.addEventListener('pointerdown', (evt) => {
  if (autoplay) return;
  const carEl = evt.target.closest('.car');
  const destEl = evt.target.closest('.dest');
  if (destEl) { moveTo(Number(destEl.dataset.node)); return; }
  if (carEl) {
    const i = Number(carEl.dataset.car);
    const wasSelected = selected === i;
    if (!wasSelected) select(i);
    drag = { car: i, start: toBoard(evt), wasSelected, moved: false, along: null };
    board.setPointerCapture(evt.pointerId);
    return;
  }
  // Tapping near a destination counts, so small targets are easy to hit.
  const p = toBoard(evt);
  const near = nearestDest(p);
  if (near != null) { moveTo(near); return; }
  // Tapping an empty station moves the one car that can reach it.
  const station = nearestEmptyStation(p);
  if (station != null) {
    const cars = positions.map((_, i) => i).filter((i) => movesForCar(level, adj, positions, i).includes(station));
    if (cars.length === 1) { selected = cars[0]; moveTo(station); return; }
    if (cars.length > 1) { pickOne(cars); return; }
  }
  if (selected != null) { selected = null; hint = null; update(); }
});

function nearestEmptyStation(p, maxDist = 0.4) {
  const occ = occupancy(level, positions);
  let best = null, bestD = maxDist;
  level.nodes.forEach(([x, y], n) => {
    const d = Math.hypot(p.x - x, p.y - y);
    if (occ[n] === -1 && d < bestD) { best = n; bestD = d; }
  });
  return best;
}

// Several cars could take that spot: flash them and let the player choose.
function pickOne(cars) {
  selected = null;
  hint = null;
  update();
  for (const i of cars) {
    const g = carEls[i];
    g.classList.remove('pick');
    void g.getBBox(); // restart the animation
    g.classList.add('pick');
  }
  clearTimeout(pickOne.t);
  pickOne.t = setTimeout(() => {
    for (const g of carEls) g.classList.remove('pick');
  }, 1300);
  flashStatus(`${cars.length} cars can go there — pick one`);
}

// While dragging, the car slides along whichever open track is closest to the finger.
board.addEventListener('pointermove', (evt) => {
  if (!drag || selected !== drag.car) return;
  const p = toBoard(evt);
  if (!drag.moved && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < 0.15) return;
  drag.moved = true;
  const [ox, oy] = level.nodes[positions[drag.car]];
  let best = null;
  for (const n of movesForCar(level, adj, positions, drag.car)) {
    const [dx, dy] = level.nodes[n];
    const vx = dx - ox, vy = dy - oy;
    const t = Math.max(0, Math.min(1, ((p.x - ox) * vx + (p.y - oy) * vy) / (vx * vx + vy * vy)));
    const x = ox + t * vx, y = oy + t * vy;
    const d = Math.hypot(p.x - x, p.y - y);
    if (!best || d < best.d) best = { node: n, t, x, y, d };
  }
  if (!best) return;
  drag.along = best;
  const g = carEls[drag.car];
  g.classList.add('dragging');
  g.style.transform = `translate(${best.x}px, ${best.y}px)`;
});

board.addEventListener('pointerup', () => {
  if (!drag) return;
  const { car, moved, along, wasSelected } = drag;
  drag = null;
  carEls[car].classList.remove('dragging');
  if (moved) {
    // Past halfway it arrives; otherwise it slides back.
    if (along && along.t > 0.4 && selected === car) moveTo(along.node);
    else update();
  } else if (wasSelected) {
    select(car); // second tap on a selected car deselects it
  }
});

board.addEventListener('pointercancel', () => {
  if (!drag) return;
  carEls[drag.car].classList.remove('dragging');
  drag = null;
  update();
});

function nearestDest(p, maxDist = 0.45) {
  if (selected == null) return null;
  let best = null, bestD = maxDist;
  for (const n of movesForCar(level, adj, positions, selected)) {
    const [x, y] = level.nodes[n];
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) { best = n; bestD = d; }
  }
  return best;
}

document.addEventListener('keydown', (evt) => {
  if (document.querySelector('dialog[open]')) return;
  if ((evt.key === 'z' && (evt.ctrlKey || evt.metaKey)) || evt.key === 'Backspace') undo();
  else if (evt.key === 'r') reset();
  else if (evt.key === 's') toggleAutoplay();
  else if (evt.key === 'ArrowRight') loadLevel(store.current + 1);
  else if (evt.key === 'ArrowLeft') loadLevel(store.current - 1);
});

// ---------- buttons & dialogs ----------

// iOS WebKit sometimes swallows the first tap on a button as a "hover" when
// something on the page is animating, so a button needs two taps. Fire buttons
// on touch release instead, and drop the native click that may follow.
let suppressClickUntil = 0;
document.addEventListener('pointerup', (evt) => {
  if (evt.pointerType !== 'touch') return;
  const button = evt.target.closest('button');
  if (!button || button.disabled) return;
  if (!button.contains(document.elementFromPoint(evt.clientX, evt.clientY))) return; // finger slid off
  suppressClickUntil = performance.now() + 500;
  button.click();
}, true);
document.addEventListener('click', (evt) => {
  if (evt.isTrusted && performance.now() < suppressClickUntil) {
    evt.preventDefault();
    evt.stopPropagation();
    suppressClickUntil = 0;
  }
}, true);

$('btn-undo').onclick = undo;
$('btn-reset').onclick = reset;
$('btn-hint').onclick = () => { if (!autoplay) showHint(); };
$('btn-solve').onclick = toggleAutoplay;
$('btn-prev').onclick = () => loadLevel(store.current - 1);
$('btn-next').onclick = () => loadLevel(store.current + 1);
$('btn-help').onclick = () => $('dlg-help').showModal();
$('btn-levels').onclick = openLevels;
$('win-replay').onclick = () => { $('dlg-win').close(); reset(); };
$('win-next').onclick = () => { $('dlg-win').close(); loadLevel(store.current + 1); };

// Tap on the backdrop closes a sheet.
for (const dlg of document.querySelectorAll('dialog.sheet')) {
  dlg.addEventListener('click', (evt) => { if (evt.target === dlg) dlg.close(); });
}

function renderStats() {
  const s = computeStats(store, LEVELS);
  const tiles = [
    ['Cleared', `${s.cleared}<small>/${s.total}</small>`],
    ['Perfect', s.perfect],
    ['Score', `${s.score.toLocaleString()}<small>/${s.maxScore.toLocaleString()}</small>`],
    ['Efficiency', s.efficiency == null ? '–' : `${s.efficiency}%`],
    ['Day streak', s.streak],
    ['Played', formatDuration(s.timeMs)],
  ];
  $('stats-tiles').innerHTML = tiles.map(([label, value]) => `<div class="tile"><b>${value}</b><span>${label}</span></div>`).join('');
  $('stats-bar').style.width = `${(100 * s.cleared) / s.total}%`;
  $('stats-totals').textContent =
    `${s.moves.toLocaleString()} moves · ${s.hints} hints · ${s.undos} undos · ${s.resets} resets`;
}

function openLevels() {
  renderStats();
  const grid = $('level-grid');
  grid.replaceChildren();
  LEVELS.forEach((lvl, i) => {
    const b = document.createElement('button');
    const best = store.best[i];
    b.innerHTML = `${i + 1}<small>${best != null ? `${best}/${lvl.par}` : lvl.par}</small>`;
    if (best != null) b.classList.add(best <= lvl.par ? 'perfect' : 'solved');
    if (i === store.current) b.classList.add('current');
    if (i > lastUnlocked()) {
      b.classList.add('locked');
      b.disabled = true;
      b.setAttribute('aria-label', `Level ${i + 1}, locked`);
      b.innerHTML = `${i + 1}<small><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h1Zm2 0h6V8a3 3 0 0 0-6 0v3Z"/></svg></small>`;
    }
    b.onclick = () => { $('dlg-levels').close(); loadLevel(i); };
    grid.appendChild(b);
  });
  $('dlg-levels').showModal();
}

// ?level=N opens level N directly; outside the App Store build it also
// unlocks it, for testing.
const urlLevel = Number(new URLSearchParams(location.search).get('level'));
if (urlLevel >= 1 && !isReleaseApp) devReach = urlLevel - 1;
if (urlLevel >= 1) loadLevel(urlLevel - 1);
else loadLevel(store.current, { save: false });

// Native storage and iCloud may hold newer progress than localStorage.
loadAll().then((saved) => {
  const merged = mergeProgress(store, saved);
  Object.assign(store, { best: merged.best, devices: merged.devices, days: merged.days });
  // Jump to the newer saved level only if the player hasn't started moving yet.
  if (!urlLevel && merged.current !== store.current && !history.length) {
    store.updatedAt = merged.updatedAt;
    loadLevel(merged.current, { save: false });
  }
  saveAll(store);
});

// Progress from another device: take its scores and stats, but stay on this level.
onRemoteProgress((remote) => {
  const merged = mergeProgress(store, remote);
  Object.assign(store, { best: merged.best, devices: merged.devices, days: merged.days });
  saveAll(store);
});

// Testing aids (the Solve button) are left out of the App Store build.
if (isReleaseApp) document.body.classList.add('release');

let seenHelp = true;
try {
  seenHelp = !!localStorage.getItem(HELP_KEY);
  localStorage.setItem(HELP_KEY, '1');
} catch { /* storage unavailable */ }
if (!seenHelp) $('dlg-help').showModal();
