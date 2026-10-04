# Stoppo

Mobile-first sliding puzzle on a transit map (cars ride lines of their own color; get Stoppo, the target car with eyes, to the ringed station). Vanilla JS (ES modules), SVG rendering, no dependencies, no build step. See [README.md](README.md) for rules and the level format.

## Run

- Serve over HTTP (ES modules don't load from `file://`): `npx serve .` or `python3 -m http.server`.
- Rebuild levels: `node tools/build-levels.mjs` writes `js/levels.js` from the transcriptions and fails if any level's solver result differs from its par. This is the closest thing to a test suite; there is no linter.

## Layout

- `js/engine.js`: pure game rules, move generation and BFS solver. Shared by the browser app and Node tools, so keep it free of DOM and browser APIs.
- `js/app.js`: SVG rendering, input (drag along lines or tap), undo/reset/hint, the Solve autoplay (testing aid), and `localStorage` progress.
- `js/levels.js`: generated level data; edit `tools/build-levels.mjs` instead.
- `tools/build-levels.mjs`: the level source, transcribed from `reference/LevelNNN.jpg` (gitignored). The current 100 levels are third-party placeholders for development and must be replaced with our own before launch. Some station pairs have two parallel lines of different colors.
- `tools/generate.mjs`: old random level generator. Don't run it; it overwrites `js/levels.js` with random levels.
- `index.html`, `style.css`, `icon.svg`: app shell, mobile layout and icon.

## Conventions

- Colors are indices into `COLORS` in `js/engine.js`; levels refer to them by index.
- Every level's `par` must equal its BFS-optimal move count.
- `package.json` sets `"type": "module"` so Node can run `tools/` and import `engine.js`.
- Keep it mobile-first: test at phone width and with touch input. `?level=N` opens a level directly.
- Brand: Stoppo. Don't reference the game these levels came from anywhere in the product or repo.
- Look: cream transit map (Mini Metro-like), flat lines, ink-outlined stations, flat bouncy cars (Two Dots-like). Colors live in `COLORS` (`js/engine.js`) and CSS tokens on `:root` (`style.css`, with a dark-mode set).
- Headless Chrome screenshots: macOS has no `timeout`; use `perl -e 'alarm 40; exec @ARGV' "<chrome>" --headless=new --user-data-dir=<tmp> ...`. The window is at least 500px wide, so wrap the page in a 390px iframe to see phone width.
