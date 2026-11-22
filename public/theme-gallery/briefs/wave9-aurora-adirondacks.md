# Wave 9: Aurora × Adirondacks (#241–260)

Read `CONTRACT.md` first. It is binding. In particular: headless browsers only, performance rules, and don't edit `themes/themes.js`, the gallery files, or other agents' files. The entries for #241–260 already exist in `themes/themes.js`. Read your entries' blurbs there; they are your specs.

## What Josh liked (study these before writing anything)

Open the code and screenshots of these themes:

- **#144 aurora-follow** (`themes/aurora-follow.{js,css}`, `themes/cursor-kit/kit.js`). Josh says "LOVE this. Must-have in all of them."
  - The behavior to keep:
    - The aurora curtain bends and brightens toward the cursor.
    - Cursor motion adds "energy" that decays.
    - The cursor is followed with smoothing.
  - What he wants explored: variations that look **more like rounded, blurry, real aurora borealis, to varying extents.**
    - Today it is drawn as 4px vertical column strips, which read as hard streaks.
    - Make it softer, rounder, and more luminous: real auroras have smooth folds, soft rayed curtains, glowing lower edges, and gentle color gradients (green → teal → violet/red at the top).
- **#91 parallax-adirondacks** (`themes/parallax-adirondacks.{js,css}`, `themes/forest-kit/kit.js`). Josh's notes:
  - "I like the subtlety of it, especially night mode."
  - "The parallax, the birds, the general layout."
  - "Having things mostly be off to the side or below is nice for page complexity reduction."
  - In short: trees frame the left and right edges, the mountains and lake sit low, and the center behind the text stays calm.
  - Reusing `forest-kit` (ridges, pines, flocks, stars, reflections) is encouraged.
- **#93 seasons-forest**: cool effects as the seasons change.
- **#135 firefly-follow** (`themes/firefly-follow.js`): fireflies drift toward a resting cursor and scatter when it moves. Josh wants the fireflies "in there too".
- **#166 paddle-scroll**: Josh liked the mist on the water, but was only a little happy with the parallax and the 3D-ness.
- **#215 zj-night-sky**, plus the other night and galaxy themes: a nice night-sky visualization.

Screenshot #91 and #144 in both modes before you start:

```sh
~/.venvs/patchright/bin/python tools/shot.py 91 --mode dark --out <scratch>/91-dark.png
```

## Every theme in this wave must have

1. **A cursor-reactive aurora in the spirit of #144.**
   - It bends and brightens toward the pointer, and energy builds with movement and decays.
   - It is rendered softer and rounder than #144, at the level of blur your spec calls for.
   - Read the pointer from `window` listeners, never by blocking the page.
   - On touch devices or with no pointer, it rests at a pleasant default.
2. **Subtlety, and a calm reading area.**
   - Scenery lives mostly at the edges and the bottom. The aurora sits in the sky band, above or behind the header and hero, and fades well before the body text.
   - Body text must stay AA-readable.
3. **Night mode as the showpiece, and a good light mode.**
   - Light mode can be dawn, dusk, or a pale daytime sky with a faint pastel aurora, like #144's light mode. It must look intentional, not like an inverted dark mode.
4. **Reduced motion:** render one static, beautiful frame. Pointer reaction may remain only if it is user-driven and gentle.

## Performance (Josh is a web-perf expert, and this caused real problems last time)

- **Soft aurora, cheap.** Render the aurora into a **low-resolution canvas**, for example 1/4 to 1/8 of the viewport, and let CSS upscale it. Bilinear upscaling *is* the blur, and it is free.
  - Never use `ctx.filter` blur, CSS `filter: blur()` on big animated layers, or `backdrop-filter`.
  - Pre-render soft sprites (radial or vertical gradients) once, then `drawImage` them.
- **WebGL is fully allowed (update: Josh restarted Chrome, so WebGL is fine).**
  - Use shaders wherever they give the best-looking aurora; 2D canvas is no longer preferred.
  - Normal hygiene still applies:
    - cap the DPR, or render the aurora at reduced resolution;
    - handle a `null` getContext with a fallback;
    - lose the context in cleanup.
  - Don't write a pathological per-pixel cost, such as thousands of loop iterations per pixel.
- **Idle is nearly free.**
  - When the cursor is still and nothing is changing, either stop the loop, as #144 does, or run a slow idle drift on a throttled timer at 20–30 fps, and only on the low-res aurora canvas.
  - Pause when `document.hidden`.
  - Don't redraw the static scenery every frame. Draw ridges and trees to cached layers and move them with `transform` for parallax.
- Cap DPR at 1.5. Startup work stays under ~30 ms per task; defer the rest with `requestIdleCallback`.
- Scroll handlers must be passive and cheap. Prefer moving a cached layer with `transform`.

## Process

- Work on your assigned themes only. Shared code goes in your own kit folder, named in your assignment. Don't edit existing kits; copy from them if you need changes.
- **Look at your work.** Screenshot every theme in light and dark, at the top and scrolled (`--scroll 700`), and with the pointer moved.
  - Write a small headless Patchright script that moves the mouse through a few positions and screenshots, to confirm the aurora visibly follows.
  - Iterate until it is genuinely beautiful. Compare against #144 and #91 side by side. The bar: Josh should prefer it to #144.
- Run `~/.venvs/patchright/bin/python tools/errors.py <n>` for each theme. It must report 0 errors.
- Final report: for each theme, 2–3 lines on what you built and how the aurora is rendered, and anything you're unsure about. Keep it short.
