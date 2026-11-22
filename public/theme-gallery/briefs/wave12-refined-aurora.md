# Wave 12: Refined aurora (#301–320)

Read `CONTRACT.md` first; it is binding. Use headless browsers only. Don't edit `themes/themes.js`, the gallery files, or other agents' files. Your specs are the blurbs for #301–320 in `themes/themes.js`.

## Where we are

Josh is narrowing down toward a final design for joshuakgoldberg.com. Intensity is on his 1–10 scale:

- #241–260 were 7–10, too loud.
- #261–280 were 1–2, too timid.
- #281–300 were 3–5, which is the right zone.

This wave combines the specific pieces he picked out. **Screenshot every reference theme he named before you start** (dark and light, top and scrolled, after mouse moves), and read its code:

```sh
~/.venvs/patchright/bin/python tools/shot.py 282 --mode dark --out <your-scratch>/282-dark.png
```

His notes, verbatim, with the themes to study:

1. **Top aurora:** "266's / 282's / 297's / 298's top aurora, but ranging levels of more subtle (a little to a lot), and raising the center of it so it's higher up and thus less intrusive."
   - Study `qa-squiggle-aurora` (266), `ma-aurora-crown` (282), `ma-fog-band` (297) and `ma-horizon-scroll` (298).
   - Kits: `_quiet-b`, `_medium-a`, `_medium-e`.
2. **Margin stars:** "subtle galaxy/star effects in the sides/margins like 277's / 291's, also maybe stars like 253's / 287's in the higher areas."
   - Study `qa-margin-stars` (277), `ma-milky-corners` (291), `aa-milky-way` (253) and `ma-local-sky` (287) at night.
3. **Side effects:** "various interesting side effects like 283 but more subtle, and much more interesting physics from mouse movement near them."
   - Study `ma-side-curtains` (283).
4. **Texture:** "i like the texture and blurry gradient-y stuff of 276. maybe all around/sides? maybe just bottom? as footer decoration?"
   - Study `qa-paper-bleed` (276).
5. **Footer:** "some kind of visually impressive but still subtle thing. 263? 260? 258/259? 257? 251?"
   - Study `qa-footer-valley` (263), `aa-fire-tower` (260), `aa-bokeh` (258), `aa-fog` (259), `aa-watercolor` (257) and `aa-loon` (251).

## Definitions

### Raised top aurora

- The brightest part of the aurora's vertical center sits at about **4–10% of viewport height**: at or above the header line, near the very top.
- It feathers out completely by about **20–25%**, well above the hero title.
- Compare #282 and #297, whose glow peaks around 20–25% and reaches into the hero. Yours sits clearly higher.
- It is still soft, rounded and aurora-like, with folds and gentle rays, and no hard edges.
- It bends and brightens toward the cursor (#144 DNA).
- It scrolls away with the page or fades out over the first ~300–500px of scroll, using only compositor-friendly properties.

### Subtlety levels for the top aurora

These are relative to #282 Aurora Crown in dark mode at full strength. Each level must still be clearly visible; it must never become invisible like #261.

| Level | Strength |
| --- | --- |
| 1 | About 30% of #282's presence: a delicate glow you notice within a second or two. |
| 2 | About 55%. |
| 3 | About 80%: #282's strength, but raised. |

Light mode uses pastel, scaled the same way. It must still read in light mode.

### Margins and sides

- Effects live in the side margins, outside the ~52rem content column, and never sit behind body text.
- They hide gracefully when the margins get narrow (about 800px wide).

### Physics side effects (#304, #305, #308, #309, #310)

The point is **much more interesting physics from mouse movement near them**, while staying visually subtle:

- Use real simulations: spring-mass or verlet, a wave equation, a field model.
- Use a fixed timestep, with a cheap per-step cost.
- Inject force from cursor velocity, not just position, so flicks and slow passes feel different.
- Motion settles and the loop sleeps when everything is at rest.
- They are visible at rest but understated, and come alive when touched.

### Footer pieces

- Visually impressive but still subtle.
- They live in the footer region (roughly 160–280px tall) around and behind the footer text. The footer text stays readable with no scrim.
- They run only when scrolled into view (IntersectionObserver), and cost nothing before that.

### Texture (#276 style)

- Use a pre-baked grain tile plus large, soft, blurry pastel gradient washes, moved only with transform and opacity.
- Keep the grain subtle enough that text never looks dirty.

## Global rules (unchanged)

- Start from Josh's real site (`site.css` with no theme): `#fdffff`, `#0b1220`, League Spartan, blue accent. Keep the typography and layout.
- **Text needs no help:** no scrims, panels or text shadows. Text is AA-readable as-is.
- Night mode is the showpiece, and light mode must be good too.
- Reduced motion: one static frame, with pointer reaction only when user-driven.
- **Performance:**
  - Size canvases to their area and use reduced-resolution aurora.
  - No per-draw `ctx.filter` and no large animated CSS blur or backdrop-filter.
  - Idle loops run at 20–30 fps or sleep, and pause on `document.hidden`.
  - For WebGL: cap the DPR, handle a null context, and lose the context on cleanup.
  - Scroll handlers are passive and transform/opacity-only.
- Reuse is encouraged. Import from or copy any kit (`_aurora-*`, `_quiet-*`, `_medium-*`, `forest-kit`, `cursor-kit`), but don't edit them.

## Process

- Work only on your assigned themes. Put shared code in your own kit folder, and keep scratch scripts in your own scratch subfolder: `/private/tmp/claude-501/-Users-josh-repos-dot-com/4db80127-f1c9-44f6-9d98-8e927dbb8cb0/scratchpad/<your-kit>/`.
- **Look at your work:**
  - Screenshot light and dark, at the top, at `--scroll 900`, scrolled to the footer, after mouse moves, and at 800px wide.
  - For physics themes, screenshot mid-interaction (move the mouse quickly through a margin, then capture 100–300ms later).
  - Compare your raised aurora against #282 to confirm it sits higher and at the intended level.
  - Iterate until it is polished.
- Run `~/.venvs/patchright/bin/python tools/errors.py <n>`. It must report 0 errors.
- **Final report:** 2–3 lines per theme. Be honest about what you did not check.
