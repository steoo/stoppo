# Stoppo

Mobile-first sliding puzzle on a transit map (cars ride lines of their own color; get Stoppo, the target car with eyes, to the ringed station). Vanilla JS (ES modules), SVG rendering, no bundler or build step. The same web app ships as a native iPhone/iPad app via Capacitor (Android later via `npx cap add android`). See [README.md](README.md) for rules and the level format.

## Run

- Web: serve `web/` over HTTP (ES modules don't load from `file://`): `npm run serve` or `python3 -m http.server -d web`.
- iOS: `npm run ios` copies `web/` into the Xcode project (`cap sync ios`) and opens Xcode. Run `npx cap sync` after any change to `web/` before building natively. Xcode needs the iOS platform installed (Settings → Components).
- Rebuild levels: `npm run levels` (`node tools/build-levels.mjs`) writes `web/js/levels.js` from the transcriptions and fails if any level's solver result differs from its par. This is the closest thing to a test suite; there is no linter.

## Layout

- `web/`: the whole app as shipped (also Capacitor's `webDir`).
- `web/js/engine.js`: pure game rules, move generation and BFS solver. Shared by the browser app and Node tools, so keep it free of DOM and browser APIs.
- `web/js/app.js`: SVG rendering, input (drag along lines or tap), undo/reset/hint, the Solve autoplay (testing aid), and `localStorage` progress.
- `web/js/levels.js`: generated level data; edit `tools/build-levels.mjs` instead.
- `web/js/storage.js`: progress (`{ current, best, updatedAt }`) saved to localStorage, native Preferences and iCloud key-value storage (`CloudStore`), merged on load (lowest best per level, newest `current`). Remote iCloud changes merge best scores only.
- `web/js/stats.js`: player stats for the Progress sheet (cleared, perfect, score = Σ 100·par/best, efficiency, day streak, time played, totals). Counters live per device in `progress.devices[deviceId]` and only grow, so sync merges by max per device; `track()` in `app.js` records them. Auto-solve never counts.
- `web/js/native.js`: `callNative`/`onNative` wrap `Capacitor.nativePromise`/`addListener`. Use these for native plugins; there's no bundler, so `@capacitor/*` JS packages aren't imported.
- `tools/build-levels.mjs`: the level source, transcribed from `reference/LevelNNN.jpg` (gitignored). The 100 levels come from another game's designer, who gave permission to use them (confirmed by the owner, 2026-10-04; keep the written confirmation). Some station pairs have two parallel lines of different colors.
- `tools/generate.mjs`: old random level generator. Don't run it; it overwrites `web/js/levels.js` with random levels.
- `web/index.html`, `web/style.css`, `web/icon.svg`, `web/fonts/`: app shell, layout, favicon and self-hosted Nunito (keep it offline: no CDN links).
- `ios/`: Capacitor Xcode project (bundle ID `com.steoo.stoppo`, team `4WFCSZ9R44`, iPhone portrait-only, iPad all orientations). `ios/App/App/public` is generated; don't edit it. `ios/App/App/CloudStorePlugin.swift` is our own iCloud key-value plugin, registered in `MainViewController` (the root view controller); its entitlement is in `App.entitlements`. New Swift files must be added to `project.pbxproj` (no synchronized folders).
- `assets/`: sources for the app icon (`app-icon.svg` → 1024px PNG, no alpha) and splash (`splash.svg` → 2732px). Rendered with headless Chrome and copied into `ios/App/App/Assets.xcassets`.
- `capacitor.config.json`: app ID, name, `webDir: web`.

## Conventions

- Colors are indices into `COLORS` in `web/js/engine.js`; levels refer to them by index.
- Every level's `par` must equal its BFS-optimal move count.
- `package.json` sets `"type": "module"` so Node can run `tools/` and import `web/js/engine.js`.
- Native-only features go through `window.Capacitor` behind a check (see `haptic()` in `app.js`) so the browser build keeps working without Capacitor.
- Release builds (`Capacitor.DEBUG` false, see `isReleaseApp` in `native.js`) hide testing aids like Solve; the browser and debug builds keep them.
- `ios/App/App/PrivacyInfo.xcprivacy`: no tracking, no data collected; declares `UserDefaults` (reason CA92.1, used by Preferences). Update it if a new SDK or required-reason API is added.
- Keep it mobile-first: test at phone width and with touch input. `?level=N` opens a level directly.
- Brand: Stoppo. Don't name the game the levels came from in the product unless the owner decides to add a credit.
- Look: cream transit map (Mini Metro-like), flat lines, ink-outlined stations, flat bouncy cars (Two Dots-like). Colors live in `COLORS` (`js/engine.js`) and CSS tokens on `:root` (`style.css`, with a dark-mode set).
- Headless Chrome screenshots: macOS has no `timeout`; use `perl -e 'alarm 40; exec @ARGV' "<chrome>" --headless=new --user-data-dir=<tmp> ...`. The window is at least 500px wide, so wrap the page in a 390px iframe to see phone width.
