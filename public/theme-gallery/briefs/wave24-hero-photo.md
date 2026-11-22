# Wave 24: Hero photo (#480–499)

Read `CONTRACT.md` first; it's binding. Use headless browsers only. Don't edit `themes/themes.js`, gallery files, or other agents' files. Your specs are the blurbs for #480–499 in `themes/themes.js`.

## Josh's request, verbatim

> things are looking great. now let's do 20 more explorations for the hero image. the background behind me is kind of dull. do explorations around:
> * how to make that less dull (remove it? fade it out? etc.)
> * cool snazzy hover effects (more like the header/footer? side? glow/aura around me?) - for at least 5 of these, do wacky things around making the outside of my body cutout glow

## Base

Every theme is **#479 `sq-favorite`** (Josh's current favorite): #452's typography and scenery, the favorite squiggles, and the new headshot. Wrap #479's `activate`, and change **only the hero portrait**.

The portrait today is drawn by `themes/_vs4/portrait.js`:
- a canvas `.vs-portrait` appended inside `<picture class="site-portrait">`;
- the background at 70%, Josh at 100% via the mask;
- a one-off rim glow, a halo, and a background colour shift.

`#479`'s wrapper swaps in the new headshot via `data-mask`. Your themes replace that portrait rendering with their own: hide or remove the `.vs-portrait` canvas and the original `<img>`s visually, and render yours in the same 256px slot. Keep the `alt` text accessible, for example on a `role="img"` wrapper or on a kept, visually hidden `<img>`. Don't edit `_vs4` or `_sq`.

### Assets in `assets/`, made from Josh's own layers

| File | Size | Contents |
| --- | --- | --- |
| `headshot-512.webp` | 512² | the full headshot (pale, desaturated background) |
| `headshot-body-512.webp` | 512², RGBA | his cutout only (transparent background), same framing |
| `headshot-bg-512.webp` | 512², RGBA | the background only, with Josh removed (transparent where he was) |
| `headshot-mask-512.png` | 512² | grayscale person mask |
| `headshot-body-padded-616.webp` | 616², RGBA | the cutout with 60px (at this scale) of extra transparent margin on every side, same scale as the 512 versions (offset 52px), so glows and auras can extend past his body without clipping |

He's wearing a purple hood with an antenna and ears. The antenna reaches the top of the frame, and the mask includes it.

## Direction

**Less dull** (#480–487, #492): remove, fade, recolour, or replace the background so the portrait belongs to the page's world: the night sky, the aurora, the Goldberg graphs. Keep him the focal point.

**Snazzy hover** (#488–492): effects in the same language as the header aurora, footer, side stars, and snarks.

**Wacky outline glows** (#493–499, at least 5): effects driven by the *outside of his body cutout*. Build a distance field from the mask once, at build time, using the jump-flood algorithm in a small WebGL pass or a fast CPU distance transform on a downscaled mask. Use it for the aura, neon tube, sparks spawning on the edge, chromatic split, electric arcs following the contour, contour ripples, and corona flames. They can be playful and wacky, but should still feel premium and match the page's palette.

- **Overflow:** effects may extend outside the circle. Use the padded cutout and draw on an overflow canvas larger than 256px, centred on the portrait, with `pointer-events: none`. Don't let them cover the hero text.
- **At rest:** each exploration has a lovely resting state. Hover makes it come alive. Focus doesn't apply, since the portrait isn't interactive, but if you add any interactive affordance, keep it accessible.
- **Light and dark:** both must look great. Light mode needs its own palette treatment, not a washed-out dark one.

## Performance (Josh is a web-perf expert)

- Size canvases to the effect area at DPR ≤ 2.
- Build the distance field once.
- Animate only while hovered, or for a short time after hover leaves. Use a slow idle shimmer only if a blurb needs one, and cap it at 20–30fps.
- Pause on `document.hidden`, on the site's play/pause toggle (`.site[data-motion="pause"]`), and under reduced motion. In those cases, show one static frame.
- Load assets lazily where possible: preload only the portrait images the theme actually uses.
- Don't use per-frame `ctx.filter`. Pre-blur sprites once.

## Process

- Scratch: `/private/tmp/claude-501/-Users-josh-repos-dot-com/4db80127-f1c9-44f6-9d98-8e927dbb8cb0/scratchpad/_hp/`. Shared code: `themes/_hp/`.
- **Look at your work.** For each theme, take crops at DPR 2 of the portrait area plus 120px around it:
  - at rest and mid-hover;
  - in dark and light.

  Make a contact sheet of all 20 (dark, mid-hover) and view it. Critique and iterate until each is genuinely good and distinct.
- Run `~/.venvs/patchright/bin/python tools/errors.py 480-499`. It must report 0 errors, and it takes minutes, so use a long timeout or run it in the background.
- **Report:** one line per theme covering the technique, the rest state, the hover behaviour, and anything you didn't check.
