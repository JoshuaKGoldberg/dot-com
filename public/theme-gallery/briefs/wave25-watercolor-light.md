# Wave 25: Watercolor light mode (#519–528)

Read `CONTRACT.md` first; it is binding. Use headless browsers only. Don't edit `themes/themes.js` or the gallery files. Your specs are the blurbs for #519–528 in `themes/themes.js`.

## Josh's request, verbatim

> dark mode is beautiful, wonderful, great. but light mode the auroras specifically don't quite look right. give me 10 more variants that in light mode have colors more like 257-aa-watercolor's watercolor colors (not the adirondacks etc., just specifically the watercolor colors). be creative and different for some of them

## Base

Every theme is **#518 `hp-ac-starfield`**, Josh's current favorite: it is #479 plus the hero photo. **Dark mode must stay byte-for-byte identical to #518.** Change only **light mode**, and in light mode only the **auroras**:

1. **The header aurora**: the `_vs4/aurora.js` shader. Its light palette comes in as data (`light.aurora`, four or five stops, currently `LIGHT.golden`), and its light branch draws "luminous ink on paper".
2. **The footer aurora**: `_vs4/footer.js`, the same shader family mirrored.
3. **The portrait backdrop aurora and the glow in the hero photo**: `_hp/` (`kit.aurora`, `ac.js` `acStarfield`, `layers.js`).

Leave the page background, typography, squiggles, side stars and graphs, and the general layout alone, unless a small tint change is needed to make the watercolor auroras sit right. If you make one, say so.

## The colors: #257 `aa-watercolor`, the pigments only

`themes/aa-watercolor.js` holds `PIG.light`:

| Pigment | RGB |
| --- | --- |
| jade | `[60, 175, 140]` |
| cornflower | `[80, 150, 205]` |
| wisteria | `[160, 115, 200]` |
| rose | `[225, 120, 150]` |

They're painted as translucent wet-on-wet strokes, with pigment pooling slightly at the edges (`strokeSprite`: stops at 0.55, 0.5, 0.75, then 0) and a paper grain. Study #257 in light mode, but take **only the pigment colors and the watercolor character**. Don't take the Adirondack ridges, pines, birds, or paper page background.

## Implementation

- **Wrapping:** wrap #518's activate. You can't edit `_vs4`, `_sq`, `_type*`, `rn-*` or `sq-*`. To change the header and footer shaders, copy what you need into `themes/_wc/` and modify the copy there, for example a light-only shader variant with pooled edges or grain. Then swap it in for light mode only, or re-run the `_vs4` theme factory (`makeTheme` in `gd-bloom.js`) with a different `light` palette, whichever is cleaner.
- **`_hp` (finished):** you may make **additive** changes, such as a new option that defaults to the current behaviour, so that #480–518 render identically. Run `errors.py 480-518` afterwards to prove it.
- **Watercolor effects must be cheap:**
  - pre-baked grain and bloom textures;
  - shader math rather than per-frame canvas filters;
  - no per-frame `ctx.filter`.
- **Placement:** nothing behind text, which is a durable Josh rule. Paper grain and texture appear only inside the aurora washes, in the margins, the top band and the footer, never as a page-wide overlay behind the reading column.
- **Motion:** keep #518's timing rules. On hover only the portrait tilt responds immediately. Everything else waits about 1 s, then eases in slowly. Respect pause and reduced motion.
- **Colour quality:** watercolor transparency, meaning soft, luminous, slightly desaturated jewel tones on the light background. Don't make it muddy, neon, or the "washed-out dark palette". Mixed overlaps should read as pigment mixing, not grey sludge, except in #525, where soft greys are the point.

## Be creative

The 10 blurbs cover these, and each should be visibly distinct:

- the straight pigment swap;
- pooled edges;
- paper grain;
- granulation;
- blooms and backruns;
- wet-on-wet bleeding;
- a two-pigment duet;
- a cool trio;
- multiply glazes;
- cursor-pulled pigment.

## Process

- Scratch files go in `/private/tmp/claude-501/-Users-josh-repos-dot-com/4db80127-f1c9-44f6-9d98-8e927dbb8cb0/scratchpad/_wc/`. Shared code goes in `themes/_wc/`. Theme files are `themes/wc-*.{js,css}`.
- After every edit to a shared module, run `node --input-type=module --check < file`. Josh browses live.
- **Look at your work.** Light mode at 1440, DPR 2, for each theme:
  - the top of the page (header aurora plus hero photo), at rest and after 6 s of portrait hover;
  - the footer, at rest and after dwell.

  Put #257 light and #518 light in the same contact sheet for comparison. Critique and iterate.
- Spot-check that dark mode matches #518 pixel-for-pixel at rest, at the top, on 2–3 themes.
- Run `~/.venvs/patchright/bin/python tools/errors.py 519-528`, plus `480-518` if you touched `_hp`. Both must report 0 errors. Use a long timeout or run them in the background.
- **Report:** one line per theme: the technique and how the light auroras look. List anything you didn't check.
