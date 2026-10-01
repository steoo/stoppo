// Generates puzzle levels and writes js/levels.js.
//
//   node tools/generate.mjs [seed]
//
// Each level is a grid "subway map": colored lines are laid down as random
// walks, cars are scattered on stations, and a breadth-first search keeps the
// starting layout whose shortest solution is longest.

import { writeFileSync } from 'node:fs';
import { solve } from '../js/engine.js';

let seed = Number(process.argv[2] ?? 20261001) >>> 0;
function rand() {
  // mulberry32
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Lay colored lines on a w×h grid and return { nodes, edges }.
function makeMap({ w, h, colors, lineLen, linesPerColor }) {
  const id = (x, y) => y * w + x;
  const edgeColor = new Map(); // "a-b" -> color
  const ek = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (let c = 0; c < colors; c++) {
    for (let l = 0; l < linesPerColor; l++) {
      let x = Math.floor(rand() * w);
      let y = Math.floor(rand() * h);
      let [dx, dy] = pick(dirs);
      for (let s = 0; s < lineLen; s++) {
        // Subway lines mostly run straight, turning now and then.
        if (rand() < 0.35) [dx, dy] = pick(dirs);
        const options = [[dx, dy], ...shuffle(dirs.slice())].filter(([ax, ay]) => {
          const nx = x + ax, ny = y + ay;
          return nx >= 0 && ny >= 0 && nx < w && ny < h && !edgeColor.has(ek(id(x, y), id(nx, ny)));
        });
        if (!options.length) break;
        [dx, dy] = options[0];
        edgeColor.set(ek(id(x, y), id(x + dx, y + dy)), c);
        x += dx; y += dy;
      }
    }
  }

  // Keep only stations that have track, renumbered.
  const used = new Set();
  for (const k of edgeColor.keys()) k.split('-').forEach((n) => used.add(Number(n)));
  const remap = new Map();
  const nodes = [];
  [...used].sort((a, b) => a - b).forEach((n) => {
    remap.set(n, nodes.length);
    nodes.push([n % w, Math.floor(n / w)]);
  });
  const edges = [...edgeColor].map(([k, c]) => {
    const [a, b] = k.split('-').map(Number);
    return [remap.get(a), remap.get(b), c];
  });
  return { nodes, edges };
}

function colorsAt(map, node) {
  const set = new Set();
  for (const [a, b, c] of map.edges) if (a === node || b === node) set.add(c);
  return [...set];
}

function makeLevel(spec, goalPar, attempts) {
  let best = null;
  for (let t = 0; t < attempts; t++) {
    const map = makeMap(spec);
    if (map.nodes.length < spec.cars + 3) continue;
    const order = shuffle(map.nodes.map((_, i) => i));
    const cars = order.slice(0, spec.cars).map((n) => [n, pick(colorsAt(map, n))]);
    const tColor = cars[0][1];
    const goals = map.nodes
      .map((_, i) => i)
      .filter((i) => i !== cars[0][0] && colorsAt(map, i).includes(tColor));
    if (!goals.length) continue;
    const level = { ...map, cars, target: { car: 0, node: pick(goals) } };
    const { moves, truncated } = solve(level, undefined, 150_000);
    if (!moves || truncated || moves.length < 2) continue;
    // Prefer solutions near the wanted length that make several cars move.
    const movers = new Set(moves.map((m) => m.car)).size;
    const score = Math.abs(moves.length - goalPar) * 3 - movers;
    if (!best || score < best.score) best = { level: { ...level, par: moves.length }, score };
    if (Math.abs(moves.length - goalPar) <= 1 && movers >= Math.min(spec.cars, 3)) break;
  }
  return best?.level;
}

// Board size grows with the level number; goal par ramps from 3 to ~45.
const tiers = [
  { w: 4, h: 4, colors: 2, lineLen: 5, linesPerColor: 2, cars: 3 },
  { w: 4, h: 4, colors: 2, lineLen: 6, linesPerColor: 2, cars: 4 },
  { w: 4, h: 5, colors: 3, lineLen: 6, linesPerColor: 2, cars: 5 },
  { w: 5, h: 5, colors: 3, lineLen: 7, linesPerColor: 2, cars: 7 },
  { w: 5, h: 6, colors: 4, lineLen: 7, linesPerColor: 2, cars: 9 },
  { w: 5, h: 7, colors: 4, lineLen: 8, linesPerColor: 2, cars: 11 },
];
const COUNT = 36;
const levels = [];
for (let i = 0; i < COUNT; i++) {
  const tier = tiers[Math.floor((i / COUNT) * tiers.length)];
  const goalPar = Math.round(3 + (i / (COUNT - 1)) ** 1.3 * 42);
  const lvl = makeLevel(tier, goalPar, 80);
  if (!lvl) continue;
  levels.push(lvl);
  console.log(`level ${levels.length}: goal ${goalPar}, par ${lvl.par}, stations ${lvl.nodes.length}, cars ${lvl.cars.length}`);
}
levels.forEach((l, i) => { l.name = `Level ${i + 1}`; });

const body = levels
  .map((l) => `  ${JSON.stringify({ name: l.name, par: l.par, nodes: l.nodes, edges: l.edges, cars: l.cars, target: l.target })}`)
  .join(',\n');
writeFileSync(
  new URL('../js/levels.js', import.meta.url),
  `// Generated by tools/generate.mjs — see js/engine.js for the format.\nexport const LEVELS = [\n${body},\n];\n`,
);
console.log(`wrote ${levels.length} levels`);
