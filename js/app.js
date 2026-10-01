import { COLORS, buildAdjacency, initialState, occupancy, movesForCar, isSolved, solve } from './engine.js';
import { LEVELS } from './levels.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STORE_KEY = 'subway-shuffle/v1';
const CAR = 0.56; // car size in grid units

const $ = (id) => document.getElementById(id);
const board = $('board');

const store = loadStore();
let level, adj, positions, history, selected, carEls, hint;

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
  const tracks = el('g', {}, board);
  for (const [a, b, c] of level.edges) {
    const [x1, y1] = level.nodes[a], [x2, y2] = level.nodes[b];
    el('line', { x1, y1, x2, y2, class: 'track', stroke: COLORS[c].fill, 'stroke-width': 0.2 }, tracks);
  }

  // Goal station ring, in the target car's color
  const [gx, gy] = level.nodes[level.target.node];
  const targetColor = COLORS[level.cars[level.target.car][1]].fill;
  el('circle', { cx: gx, cy: gy, r: 0.47, class: 'goal-ring pulse', stroke: targetColor }, board);

  // Stations
  const stations = el('g', {}, board);
  level.nodes.forEach(([cx, cy]) => el('circle', { cx, cy, r: 0.15, class: 'station' }, stations));

  // Destination markers live in their own layer, refreshed on selection
  el('g', { id: 'dests' }, board);

  // Cars
  const cars = el('g', {}, board);
  carEls = level.cars.map(([, c], i) => {
    const g = el('g', { class: 'car', 'data-car': i }, cars);
    el('rect', { class: 'body', x: -CAR / 2, y: -CAR / 2, width: CAR, height: CAR, rx: 0.12, fill: COLORS[c].fill }, g);
    if (i === level.target.car) {
      el('path', { class: 'star', d: starPath(0.2, 0.09) }, g);
    } else {
      el('rect', { class: 'window', x: -0.17, y: -0.13, width: 0.34, height: 0.14, rx: 0.04 }, g);
    }
    return g;
  });

  update();
}

function starPath(R, r) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r : R;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    d += `${i ? 'L' : 'M'}${(rad * Math.cos(a)).toFixed(3)} ${(rad * Math.sin(a)).toFixed(3)}`;
  }
  return d + 'Z';
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
  if (!history.length) return;
  positions = history.pop();
  selected = null;
  hint = null;
  update();
}

function reset() {
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

function flashStatus(text) {
  const toast = $('toast');
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(flashStatus.t);
  flashStatus.t = setTimeout(() => toast.classList.remove('show'), 1800);
}

function win() {
  const n = history.length;
  const prev = store.best[store.current];
  if (prev == null || n < prev) store.best[store.current] = n;
  saveStore();
  const par = level.par;
  let text = `${level.name} solved in ${n} move${n === 1 ? '' : 's'}.`;
  if (par != null) text += n <= par ? ' That matches par — perfect!' : ` Par is ${par}.`;
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
  const carEl = evt.target.closest('.car');
  const destEl = evt.target.closest('.dest');
  if (destEl) { moveTo(Number(destEl.dataset.node)); return; }
  if (carEl) {
    const i = Number(carEl.dataset.car);
    const wasSelected = selected === i;
    if (!wasSelected) select(i);
    drag = { car: i, start: toBoard(evt), wasSelected };
    board.setPointerCapture(evt.pointerId);
    return;
  }
  // Tapping near a destination counts, so small targets are easy to hit.
  const p = toBoard(evt);
  const near = nearestDest(p);
  if (near != null) { moveTo(near); return; }
  if (selected != null) { selected = null; hint = null; update(); }
});

board.addEventListener('pointerup', (evt) => {
  if (!drag) return;
  const p = toBoard(evt);
  const moved = Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 0.3;
  if (moved && selected === drag.car) {
    const near = nearestDest(p, 0.6);
    if (near != null) moveTo(near);
  } else if (!moved && drag.wasSelected) {
    select(drag.car); // second tap on a selected car deselects it
  }
  drag = null;
});

board.addEventListener('pointercancel', () => { drag = null; });

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
  else if (evt.key === 'ArrowRight') loadLevel(store.current + 1);
  else if (evt.key === 'ArrowLeft') loadLevel(store.current - 1);
});

// ---------- buttons & dialogs ----------

$('btn-undo').onclick = undo;
$('btn-reset').onclick = reset;
$('btn-hint').onclick = showHint;
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
