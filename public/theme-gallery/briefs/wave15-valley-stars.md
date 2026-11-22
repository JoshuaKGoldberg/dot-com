# Wave 15: Valley Stars (#361–365), five refinements of #347

Read `CONTRACT.md` first; it is binding. Use headless browsers only. Don't edit `themes/themes.js`, gallery files, or other agents' files. Your specs are the blurbs for #361–365 in `themes/themes.js`.

## Context

Josh likes **#347 `dl-valley-stars`** the most of everything so far. Study it thoroughly before changing anything:

- **Code:** `themes/dl-valley-stars.js`, `themes/_dl-c/` (calm aurora, margin layer, squiggle FX, `valley.js` footer), and `themes/_sky/stars.js` (the shared dark-sky star field).
- **Screenshots:** take them in dark and light, at the top, at `--scroll 900`, and at the footer.

All five variants keep #347's character. Apply every change below.

## His notes, verbatim

> * header aurora: right now it its midpoint goes below the top of the screen. that should never happen. have it always be at least on the top, if not above. i want direct light-to-dark gradient visibility from top of the screen down, never ascending then descending brightness
> * header aurora: add back brightness and color shifting and saturation for the aurora area near the mouse
> * sides: make stars less bright / visible except when near a mouse, and reduce their average size and max brightness by a third
> * body area: instead of directly having no stars, just have fewer and dimmer
> * squigglies: slower of an effect on hover, and when not on hover, have them be varied in color for a cool multi-color/rainbow-y effect on the page
> * footer: no water ripples or animals, much slower transitions/animations/speed like 3-10x slower, 1.25-2.5x the height, try without trees for a few

## Requirements

### 1. Header aurora

- **Brightness must be monotonically non-increasing from the top edge down, at every x and at every moment.**
  - The brightest row is the top edge, row 0, or conceptually above it.
  - It fades directly to dark going down.
  - Never let a band's center or peak sit below the top. There should be no rise-then-fall profile.
  - Enforce this in the math. For example, compute the curtain's intensity and multiply by a vertical envelope that is maximal at y=0 and strictly decreasing. Or build the curtain so its "hem" is above the viewport and only the rays hanging down from it are visible.
  - Cursor bending must not push the peak down either. Bend the rays sideways and lengthen them slightly, but don't drop the band.
- **Verify by measurement.** In a dark screenshot, sample a few columns (for example x = 10%, 50%, and 90%) and confirm that luminance does not increase with y in the aurora region. Also check right after a mouse move.
- **Near the cursor, add back brightness, color shift, and saturation.** Within about 250–350px of the cursor, the aurora gets locally brighter, more saturated, and hue-shifted. For example, green moves toward teal and violet, or warms toward rose at the tips. The response should be smooth and should decay gently when the cursor leaves. Keep the calm, slow base motion from #347; only the local response is livelier.

### 2. Margin stars

Use `themes/_sky/stars.js` `starrySky()`, which now has these options:

- `sizeScale` and `alphaScale` scale every star.
- `rest` (0 to 1) is how visible stars are until the cursor comes near.
- `body: { density, alpha }` continues a sparser, dimmer field behind the content column. The blend is per star, so there is no edge.

Start from `sizeScale: 0.67, alphaScale: 0.67, rest: 0.45, body: { density: 0.22, alpha: 0.35 }` and tune by eye.

- Stars should be noticeably less visible at rest and should come up clearly near the cursor.
- Body stars must stay tiny and dim enough that text contrast is unaffected. They should read as a few far-off stars, not clutter.
- If you need a behavior the module doesn't have, copy it into your kit and extend the copy. Don't edit `_sky/stars.js`, because other themes use it.

### 3. Squiggles

- **At rest,** every link's squiggle is a different color, so the page has a subtle multi-color, rainbow-ish feel. Each variant uses its own scheme, named in its blurb:
  - by vertical position;
  - by golden-angle hue per link;
  - by horizontal position;
  - a pastel gradient per squiggle;
  - by section.
  Colors must stay tasteful and harmonious with the page (controlled saturation and lightness), with good contrast in both modes.
- **On hover,** the effect is about 2–3× slower than #347's: a gentle, unhurried shimmer or hue drift. Following Josh's earlier note on #360, the hover change should be driven by mouse movement, not run continuously on its own.
- When the cursor leaves, the squiggle returns to its at-rest color, not to the default blue.

### 4. Footer

Start from #347's valley footer (`_dl-c/valley.js`).

- **Remove** the water ripples, including click ripples and any ripple hint, and the loon, birds, and any other animals.
- **Make every footer animation 3–10× slower:** aurora, mist, reflection shimmer, everything. It should feel almost still and meditative.
- **Height:** the variant-specific multiplier from its blurb (1.25×, 1.5×, 2×, or 2.5×) of #347's current footer height.
- **Trees:**
  - #361 and #364 keep trees.
  - #362 and #363 have none.
  - #365 has only small islands.
- The footer text stays readable with no scrim. The footer's sky fades in from fully transparent over a long ramp, with no hard top edge. The decoration runs to the very bottom of the page (`.site-page { padding-bottom: 0 }`).
- It runs only while visible, via IntersectionObserver.

### Global rules (unchanged)

- Nothing sits behind the content text except the sparse, dim body stars specified above.
- No masks, panels, or boxes.
- Night mode is the showpiece; light mode must still be lovely.
- **Reduced motion:** one static frame, with pointer reaction only when user-driven.
- **Performance:**
  - Canvases are sized to their area.
  - No per-draw `ctx.filter` and no large animated blur.
  - Idle loops sleep or run at 20–30 fps.
  - Loops pause on `document.hidden`.
  - Footers run only while visible.

## Process

- Put shared code in `themes/_vs/`. Scratch work goes in `/private/tmp/claude-501/-Users-josh-repos-dot-com/4db80127-f1c9-44f6-9d98-8e927dbb8cb0/scratchpad/_vs/`.
- **Look at your work.**
  - Screenshot dark and light at the top, at `--scroll 900`, and at the footer.
  - Run the header luminance check from section 1, including right after a mouse move.
  - Compare a resting screenshot with one taken just after the cursor sweeps near the top-right corner, to confirm the local color, brightness, and saturation response.
  - Check stars at rest versus with the cursor near.
  - Check squiggles at rest across the page, then on hover with the mouse held still for 1 s: the colors must hold.
  - Check the footer, plus two footer frames 2 s apart to confirm it's slow.
  - Compare everything with #347 side by side.
- Run `~/.venvs/patchright/bin/python tools/errors.py <n>`; it must report 0 errors. It takes minutes, so use a long timeout or run it in the background.
- **Final report:** 2–3 lines per theme, plus the header luminance-check result. Be honest about what you didn't check.
