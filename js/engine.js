// Core rules of Subway Shuffle, shared by the browser game and the level tools.
//
// A level is a graph: stations (nodes) joined by colored track segments (edges).
// Each car sits on a station. A car may move along one segment of its own
// color to a neighbouring station, but only if that station is empty.
// The puzzle is solved when the target car reaches the goal station.
//
// Level format:
//   {
//     name:   "Level 1",
//     nodes:  [[x, y], ...],            // station positions (grid units)
//     edges:  [[a, b, color], ...],     // node indices + color index
//     cars:   [[node, color], ...],     // starting cars
//     target: { car: 0, node: 7 },      // cars[car] must reach node
//     par:    12                        // optimal number of moves (optional)
//   }

export const COLORS = [
  { name: 'red', fill: '#e53935' },
  { name: 'blue', fill: '#1e88e5' },
  { name: 'green', fill: '#43a047' },
  { name: 'yellow', fill: '#fdd835' },
  { name: 'purple', fill: '#8e24aa' },
  { name: 'orange', fill: '#fb8c00' },
];

// Adjacency per node: list of { to, color }.
export function buildAdjacency(level) {
  const adj = level.nodes.map(() => []);
  for (const [a, b, color] of level.edges) {
    adj[a].push({ to: b, color });
    adj[b].push({ to: a, color });
  }
  return adj;
}

// Initial state: positions[i] is the node of cars[i].
export function initialState(level) {
  return level.cars.map(([node]) => node);
}

export function occupancy(level, positions) {
  const occ = new Array(level.nodes.length).fill(-1);
  positions.forEach((node, i) => { occ[node] = i; });
  return occ;
}

// Legal destinations for car `i`.
export function movesForCar(level, adj, positions, i, occ = occupancy(level, positions)) {
  const color = level.cars[i][1];
  const out = [];
  for (const e of adj[positions[i]]) {
    if (e.color === color && occ[e.to] === -1) out.push(e.to);
  }
  return out;
}

export function isSolved(level, positions) {
  return positions[level.target.car] === level.target.node;
}

// Canonical key: cars of the same color are interchangeable, the target car is not.
function stateKey(level, positions) {
  const slots = new Array(level.nodes.length).fill('.');
  positions.forEach((node, i) => {
    slots[node] = i === level.target.car ? '*' : String.fromCharCode(97 + level.cars[i][1]);
  });
  return slots.join('');
}

// Breadth-first search for the shortest solution from `start`.
// Returns { moves: [{ car, from, to }], explored } or { moves: null, explored }.
export function solve(level, start = initialState(level), maxStates = 2_000_000) {
  const adj = buildAdjacency(level);
  if (isSolved(level, start)) return { moves: [], explored: 1 };

  const startKey = stateKey(level, start);
  const parent = new Map([[startKey, null]]);
  let frontier = [start];
  let explored = 1;

  while (frontier.length) {
    const next = [];
    for (const pos of frontier) {
      const occ = occupancy(level, pos);
      const key = stateKey(level, pos);
      for (let i = 0; i < pos.length; i++) {
        for (const to of movesForCar(level, adj, pos, i, occ)) {
          const np = pos.slice();
          np[i] = to;
          const nk = stateKey(level, np);
          if (parent.has(nk)) continue;
          parent.set(nk, { key, move: { car: i, from: pos[i], to }, pos: np });
          explored++;
          if (isSolved(level, np)) return { moves: unwind(parent, nk), explored };
          if (explored >= maxStates) return { moves: null, explored, truncated: true };
          next.push(np);
        }
      }
    }
    frontier = next;
  }
  return { moves: null, explored };
}

function unwind(parent, key) {
  const moves = [];
  for (let p = parent.get(key); p; p = parent.get(p.key)) moves.push(p.move);
  return moves.reverse();
}
