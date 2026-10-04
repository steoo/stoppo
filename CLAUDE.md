# Subway Shuffle

Mobile-first web version of the Subway Shuffle sliding puzzle. Vanilla JS (ES modules), SVG rendering, no dependencies, no build step. See [README.md](README.md) for rules and the level format.

## Run

- Serve over HTTP (ES modules don't load from `file://`): `npx serve .` or `python3 -m http.server`.
- Rebuild levels: `node tools/build-levels.mjs` writes `js/levels.js` from the transcriptions and fails if any level's solver result differs from its par. This is the closest thing to a test suite; there is no linter.

## Layout

- `js/engine.js`: pure game rules, move generation and BFS solver. Shared by the browser app and Node tools, so keep it free of DOM and browser APIs.
- `js/app.js`: SVG rendering, input (tap and drag), undo/reset/hint, and `localStorage` progress.
- `js/levels.js`: the original game's 100 levels. Generated; edit `tools/build-levels.mjs` instead.
- `tools/build-levels.mjs`: the level source, hand-transcribed from `reference/LevelNNN.jpg` (gitignored; images from https://www.cs.brandeis.edu/~storer/JimPuzzles/SLIDE/SubwayShuffle/SubwayLevels/SubwayLevels.html). Par comes from each image's header. Some station pairs have two parallel tracks of different colors.
- `tools/generate.mjs`: old random level generator. Don't run it; it overwrites `js/levels.js` with random levels.
- `index.html`, `style.css`: app shell and mobile layout.

## Conventions

- Colors are indices into `COLORS` in `js/engine.js`; levels refer to them by index.
- Every level's `par` must equal its BFS-optimal move count.
- `package.json` only sets `"type": "module"` so Node can run `tools/` and import `engine.js`.
- Keep it mobile-first: test at phone width and with touch input.
