import { COLORS, buildAdjacency, initialState, occupancy, movesForCar, isSolved, solve } from './engine.js';
import { LEVELS } from './levels.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STORE_KEY = 'subway-shuffle/v1';
const R_STATION = 0.27;
const R_GOAL = 0.4;

const $ = (id) => document.getElementById(id);
const board = $('board');

const store = loadStore();
let level, adj, positions, history, selected, carEls, hint;
let autoplay = null; // { timer, moves, step } while the solver plays the level

function loadStore() {
  try {
    return { current: 0, best: {}, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
  } catch {
    return { current: 0, best: {} };
  }
}
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* storage unavailable */ }
}

function el(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

// ---------- level lifecycle ----------

function loadLevel(index) {
  stopAutoplay();
  store.current = Math.max(0, Math.min(LEVELS.length - 1, index));
  saveStore();
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

  // Tracks
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
    const width = colors.length > 1 ? 0.16 : 0.27;
    colors.forEach((c, k) => {
      const off = (k - (colors.length - 1) / 2) * width;
      el('line', {
        x1: x1 + nx * off, y1: y1 + ny * off, x2: x2 + nx * off, y2: y2 + ny * off,
        class: 'track', stroke: COLORS[c].fill, 'stroke-width': width,
      }, tracks);
    });
  }

  // Stations; the goal gets a thick ring in the target car's color
  const [gx, gy] = level.nodes[level.target.node];
  const targetColor = COLORS[level.cars[level.target.car][1]].fill;
  const stations = el('g', {}, board);
  level.nodes.forEach(([cx, cy], n) => {
    if (n === level.target.node) {
      el('circle', { cx: gx, cy: gy, r: R_GOAL + 0.085, class: 'goal-ring-edge' }, stations);
      el('circle', { cx: gx, cy: gy, r: R_GOAL, class: 'goal-ring-band', stroke: targetColor }, stations);
      el('circle', { cx: gx, cy: gy, r: R_GOAL - 0.085, class: 'goal-ring-edge' }, stations);
      el('circle', { cx: gx, cy: gy, r: R_GOAL - 0.085, class: 'station', stroke: 'none' }, stations);
    } else {
      el('circle', { cx, cy, r: R_STATION, class: 'station' }, stations);
    }
  });

  // Destination markers live in their own layer, refreshed on selection
  el('g', { id: 'dests' }, board);

  // Cars
  const cars = el('g', {}, board);
  carEls = level.cars.map(([, c], i) => {
    const g = el('g', { class: 'car', 'data-car': i }, cars);
    g.style.setProperty('--car-color', COLORS[c].fill);
    el('circle', { class: 'body', r: R_STATION, fill: COLORS[c].fill }, g);
    el('ellipse', { class: 'gloss', cx: 0, cy: -0.13, rx: 0.17, ry: 0.09 }, g);
    if (i === level.target.car) {
      // Little front-on train
      el('rect', { class: 'train', x: -0.14, y: -0.17, width: 0.28, height: 0.3, rx: 0.06 }, g);
      el('rect', { class: 'train-glass', x: -0.1, y: -0.12, width: 0.2, height: 0.1, rx: 0.02 }, g);
      el('circle', { class: 'train-glass', cx: -0.07, cy: 0.06, r: 0.025 }, g);
      el('circle', { class: 'train-glass', cx: 0.07, cy: 0.06, r: 0.025 }, g);
      el('rect', { class: 'train', x: -0.12, y: 0.15, width: 0.07, height: 0.04, rx: 0.015 }, g);
      el('rect', { class: 'train', x: 0.05, y: 0.15, width: 0.07, height: 0.04, rx: 0.015 }, g);
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
  for (const n of targets) {
    const [cx, cy] = level.nodes[n];
    el('circle', { cx, cy, r: 0.2, class: 'dest', 'data-node': n }, dests);
  }

  $('level-name').textContent = level.name;
  $('moves').textContent = history.length;
  $('par').textContent = level.par ?? '–';
  $('btn-undo').disabled = history.length === 0;
  $('btn-reset').disabled = history.length === 0;
  $('btn-prev').disabled = store.current === 0;
  $('btn-next').disabled = store.current === LEVELS.length - 1;
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
  update();
  if (isSolved(level, positions)) setTimeout(win, 220);
}

function undo() {
  stopAutoplay();
  if (!history.length) return;
  positions = history.pop();
  selected = null;
  hint = null;
  update();
}

function reset() {
  stopAutoplay();
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
  hint = { car: m.car };
  selected = m.car;
  update();
  // Mark the station the hinted car should go to.
  const dot = $('dests').querySelector(`[data-node="${m.to}"]`);
  if (dot) dot.setAttribute('r', 0.27);
  flashStatus(`${moves.length} moves to go`);
}

// Testing aid: the solver plays the level from the current position.
function toggleAutoplay() {
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
  $('btn-solve').textContent = 'Stop';
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
  $('btn-solve').textContent = 'Solve';
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
  if (auto) {
    // Don't record auto-solves as the player's best.
    text = `The solver finished ${level.name} in ${n} move${n === 1 ? '' : 's'} (par ${par}).`;
  } else {
    const prev = store.best[store.current];
    if (prev == null || n < prev) store.best[store.current] = n;
    saveStore();
    text = `${level.name} solved in ${n} move${n === 1 ? '' : 's'}.`;
    if (par != null) text += n <= par ? ' That matches par — perfect!' : ` Par is ${par}.`;
  }
  $('win-text').textContent = text;
  $('win-next').disabled = store.current === LEVELS.length - 1;
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
  if (selected != null) { selected = null; hint = null; update(); }
});

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

function openLevels() {
  const grid = $('level-grid');
  grid.replaceChildren();
  LEVELS.forEach((lvl, i) => {
    const b = document.createElement('button');
    const best = store.best[i];
    b.innerHTML = `${i + 1}<small>${best != null ? `${best}/${lvl.par}` : `par ${lvl.par}`}</small>`;
    if (best != null) b.classList.add(best <= lvl.par ? 'perfect' : 'solved');
    if (i === store.current) b.classList.add('current');
    b.onclick = () => { $('dlg-levels').close(); loadLevel(i); };
    grid.appendChild(b);
  });
  $('dlg-levels').showModal();
}

loadLevel(store.current);
let seenHelp = true;
try {
  seenHelp = !!localStorage.getItem(STORE_KEY + '/seen-help');
  localStorage.setItem(STORE_KEY + '/seen-help', '1');
} catch { /* storage unavailable */ }
if (!seenHelp) $('dlg-help').showModal();
