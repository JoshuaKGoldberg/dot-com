# Theme authoring contract

A local gallery for flipping through prototype themes for joshuakgoldberg.com, the personal site of Josh Goldberg: a frontend developer and **web performance expert**, open-source TypeScript maintainer (typescript-eslint), author of _Learning TypeScript_, and SquiggleConf organizer.

The gallery is served at http://localhost:4400 (`python3 tools/serve.py`; it is already running).

## Files you own

For each theme id assigned to you:

- `themes/<id>.css` is **required**. It is loaded alone (only one theme's CSS is on the page at a time), after `site.css`.
- `themes/<id>.js` is optional. It is an ES module exporting `activate({ root, mode, reducedMotion, theme })`, which may return a cleanup function.
  - `root` is `#site`. The gallery restores its pristine HTML and attributes before every activation, so you may freely mutate it.
  - Cleanup must remove everything you added **outside** `root`: listeners, timers, rAF loops, workers, WebGL contexts, AudioContexts, and elements appended to `body`.
- `themes/<id>/...` is an optional asset folder.
- Third-party libraries are allowed via pinned ESM CDN URLs, for example `https://esm.sh/matter-js@0.20.0` or `https://cdn.jsdelivr.net/npm/three@0.170.0/+esm`. Import them **dynamically** (`await import(...)`), only when the effect actually starts. Hand-rolled engines are also great.

**Do not edit** `index.html`, `gallery.*`, `site.css`, `themes/themes.js`, `tools/`, or other agents' files. If you truly need a shared change, say so in your final report.

## The page

`#site` is a homepage resembling today's site. Read the markup in `index.html` and the base styles in `site.css`.

Layers you can paint into:

- `.site-scenery > .scenery-a/.scenery-b/.scenery-c`: fixed, behind everything.
- `.site-overlay > .overlay-a/.overlay-b`: fixed, above content, `pointer-events: none`.

Custom properties: `--siteBg`, `--siteFg`, `--siteFgStrong`, `--siteMuted`, `--siteAccent`, `--siteSquiggle`, `--siteSubtle`, `--siteFont`, `--siteFontDisplay`, `--siteMaxWidth`.

Structure:

- `.site-header` contains `.site-logo`, `.site-theme-toggle` and `.site-nav-link`.
- `.site-hero` contains `.site-portrait`, `.site-title`, `.site-tagline` and `.site-socials`.
- `.site-about` follows the hero.
- `.site-section.site-posts|site-projects|site-talks` contain `.site-item`, `.site-item-title`, `.site-item-description` and `.site-item-meta`.
- `.site-footer` ends the page.
- Links are `.site-link`, with a squiggle `::after`.
- `#site` is the scroll container, so listen for `scroll` on it, not on `window`.

Scope every selector under `.site` (or `html.dark .site` etc.). Never style `.gallery-*`.

## Modes, motion, keys

- Dark mode is `html.dark`. Support both light and dark.
- Reduced motion is `html.reduce-motion` **or** `prefers-reduced-motion: reduce`. Put CSS animation behind both, and in JS honor the `reducedMotion` argument: render one static frame, or make motion user-driven only.
- The gallery owns these keys: ←/→, T, D, M, I, H, and ⌘K. If your theme needs keys, use others, listen on `document`/`window`, and call `event.preventDefault()` for keys you claim. Never steal keys while the user is typing in an input.

## Performance rules (non-negotiable)

Josh is a perf expert, and Josh flips through themes rapidly. A theme that hitches is a failed theme.

- **No per-draw `ctx.filter`** (e.g. a blur set before drawing thousands of shapes). Pre-render to an offscreen canvas once, or skip the blur.
- **No CSS `filter: blur()` / `backdrop-filter` on large or animated elements.** Prefer soft radial gradients. A static, layer-promoted element is okay.
- **No live SVG filters (`feTurbulence`, `feDisplacementMap`) on large or animated areas.** Bake noise into a small tiled image (data URI or canvas → `toDataURL` once) and reuse it.
- **Canvas/WebGL:**
  - cap the device pixel ratio at 1.5 (or render at reduced resolution and upscale);
  - size to the viewport, not the document;
  - pause the loop when `document.hidden` or when nothing is changing;
  - stop it entirely in cleanup.
- **Physics:**
  - fixed timestep;
  - sleep resting bodies;
  - cap body counts by viewport area;
  - never block the main thread for more than about 30ms;
  - simulate in a worker if it's heavy.
- **Scroll-driven effects must be compositor-only.**
  - Chrome runs scroll-driven animations of `transform`/`translate`/`scale`/`rotate` and `opacity` off the main thread. Anything else (colors, `@property` values, backgrounds, gradients, `clip-path`, masks, filters, sizes) forces style recalculation plus a full repaint and re-raster **every scrolled frame**, which janks badly on Retina screens.
  - So, to change colors with scroll, **crossfade stacked pre-colored layers with `opacity`** instead of animating color properties.
  - Never animate inherited custom properties on `.site` or other large ancestors.
  - Give animated layers `will-change: transform, opacity` and `contain: paint`. Keep huge SVG/PNG layers at sane raster sizes (no 1.4 MB SVGs rasterized at 1280×3500).
  - Verify with `tools/scrollcost.py <n>`. Total main-thread cost should stay under ~0.6 ms per scrolled frame at DPR 2 (the JS themes measure 0.1–0.4).
- **Startup must be cheap.** Defer heavy setup to `requestIdleCallback`, or until the user opts in. **Opt-in effects must cost close to zero until activated**: no library download, no canvas, no loop.
- Interactivity must **never block interacting with the page**. Links stay clickable and text stays selectable. Canvases use `pointer-events: none` unless the user has explicitly entered a mode, and you read the pointer from `window` listeners instead.
- **Don't run `tools/perf.py` for now.** Measurement happens in one pass at the end, but follow the rules above as you write code.

## Never open visible browser windows

Josh is using this computer. Every browser you launch **must be headless** (`headless=True`), including in your own scripts. Never use `headless=False`, `--headed`, or the Playwright/Chrome MCP browser tools.

## Quality bar

- Text must stay readable (aim for WCAG AA on body text). Backgrounds and effects stay subtle behind prose unless the user opts in.
- Characters: Josh rejected cartoon critters drifting in the background. Small, well-made birds or wildlife are fine **only where your spec asks for them**. Any controllable character must be an **original design**: no Mario or other existing characters, and no specific game's look, sprites, or sounds.
- Use generic aesthetics only, with no recreations of copyrighted works, games, films, brands, or characters.
- Google Fonts via `@import` at the top of your theme CSS are fine.
- **Look at your work.** Screenshot every theme in light and dark, scrolled, and in its interactive states, and iterate until it looks intentional and polished:
  ```sh
  ~/.venvs/patchright/bin/python tools/shot.py <id> --mode dark --out tools/shots/<id>-dark.png
  ~/.venvs/patchright/bin/python tools/shot.py <id> --mode light --scroll 600
  ~/.venvs/patchright/bin/python tools/shot.py <id> --reduced
  ```
  View each PNG with your Read tool. For interactions, write your own small Patchright script in your scratch space, in the same style as `tools/shot.py` (launch Chrome with `channel="chrome"`; mouse moves, clicks, keys, waits), and screenshot the result.
- Every opt-in or interactive theme needs a visible, discoverable affordance, such as a small labelled button or a hint like "press G for gravity", so visitors can find it.
