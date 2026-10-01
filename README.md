# Subway Shuffle

A mobile-first web version of the **Subway Shuffle** sliding puzzle.

## Rules

- The board is a subway map. Stations are joined by colored track segments.
- Every car has a color, and it can only ride track of **its own color**.
- A move takes one car one stop along its line, and only into an **empty** station.
- Get the **starred car** to the **ringed station** of the same color.

## Play

There is no build step. Serve the folder over HTTP, since ES modules don't load from `file://`:

```sh
npx serve .            # or: python3 -m http.server
```

Then open the printed URL on your phone or in the browser's mobile emulator.

Controls: tap a car, then tap a highlighted station. You can also drag a car onto a station. **Undo**, **Reset** and **Hint** sit in the bottom bar. Hint runs the solver from the current position.
Progress and best scores are saved in `localStorage`.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html`, `style.css` | App shell and mobile layout |
| `js/engine.js` | Rules, move generation and a BFS solver (shared with the tools) |
| `js/app.js` | SVG rendering, input and UI |
| `js/levels.js` | Level data (generated) |
| `tools/generate.mjs` | Level generator: random subway maps, keeps layouts whose optimal solution matches a difficulty ramp |

### Level format

```js
{
  name: "Level 1",
  par: 5,                         // optimal move count
  nodes: [[x, y], ...],           // station grid positions
  edges: [[a, b, color], ...],    // track between stations a and b
  cars: [[node, color], ...],     // starting cars
  target: { car: 0, node: 7 }     // cars[0] must reach station 7
}
```

Colors are indices into `COLORS` in `js/engine.js`. To swap in hand-made levels (such as the original puzzle set), replace the entries in `js/levels.js`. You can check that a level is solvable, and get its par, with `solve(level)` from `js/engine.js`.

To regenerate the levels: `node tools/generate.mjs [seed]`.
