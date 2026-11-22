# Wave 14: Delight (#341–360)

Read `CONTRACT.md` first. It is binding: headless browsers only, and don't edit `themes/themes.js`, the gallery files, or other agents' files. Your specs are the blurbs for #341–360 in `themes/themes.js`.

## Josh's latest feedback, verbatim

> my favorites: 317, 318, 316, 315, 313. especially 313. though 313's footer is buggy, there's a hard horizontal line below it as if there's content below the footer. these all have the same header problems:
> * the aurora extends too far below the top of the screen - we shouldn't be seeing much sky above the aurora
> * it animates way too fast, it should be like 2-5x slower
> * it might be too vertically bright
> as in, header should be less visible / more subtle; fix the positioning, make things slower and more chill. and also, put a little more delighters:
> * scattered throughout the sides. i'm thinking effects such as: stars that twinkle and become more visible as the mouse moves closer to them (not very visible by default)
> * little cool physics effects
> oh and ... i think there was >=1 design where squigglies had a nice color shift / rainbow effect as you hover around them? try various delighters around that. i want them delightful.

## The favorites to build on

Study each in dark and light: top, `--scroll 900`, footer, and after mouse moves.

| # | Theme | Code |
| --- | --- | --- |
| **#313** (his top pick) | `ra-paper-footer` | `themes/_refined-d/` |
| #317 | `ra-footer-watercolor` | `themes/_refined-d/` |
| #318 | `ra-footer-valley` | `themes/_refined-e/` |
| #316 | `ra-footer-bokeh` | `themes/_refined-e/` |
| #315 | `ra-footer-fog` | `themes/_refined-e/` |

The squiggle color shift he remembers is most likely **#266 `qa-squiggle-aurora`** (`themes/_quiet-b/`). The squiggle itself is `.site-link::after`, a mask of `assets/squiggle.svg`; see `site.css` around line 108.

**#313 footer bug, already fixed:** `.site-page` has `padding-bottom: 3rem`, so the footer decoration stopped 48px short of the page end and left a hard line. #313's CSS now sets `.site .site-page { padding-bottom: 0 }` and moves the space into the footer's own padding. Do the same in every theme: the footer decoration must run to the very bottom of the scroll area.

## The calmer header (required in all 20)

Every theme has a top aurora built to these numbers. Measure your screenshots against them.

- **Position:** the aurora hugs the top edge. Its brightest part sits right at the top, around 0–2% of viewport height, so **there's essentially no dark sky visible above it**.
  - Curtains or rays hang down at most about 10% of viewport height (about 80px at 800px tall). They're fully faded by about 13%.
  - Compare #313, whose aurora sits lower with sky above it. Yours should sit higher and shorter.
- **Brightness:** the peak is about 50–60% of the current #313/#315–318 header. The vertical rays are softer and less contrasty. "Less visible, more subtle."
- **Speed: 3× slower** than the current `_refined-d` and `_refined-e` header motion. That covers every time constant: drift, fold phase, ray shimmer, breathing, and cursor-follow easing.
  - The idle fold cycle should take 30 s or more.
  - Cursor response stays, but it's slow and soft: a follow time constant of 0.8 s or more, and energy decay over about 2–3 s. "Slower and more chill."
- It still bends and brightens gently toward the cursor (#144 DNA), and it still scrolls or fades away within about 400px.

## Placement (hard rule)

Nothing sits behind the content text, and nothing has the shape of a mask or panel. The scenery exists only at the edges: the top band, the side margins outside the ~52rem column, and the footer. **Never** paint `--siteBg` over a scene to hide it. Josh called that "awkward boxes". If you can see where the column is, it's wrong.

## Delighters (each theme's specific mix is in its blurb)

All delighters are subtle by default and reward attention: a visitor discovers them, and they're never in your face.

- **Hidden margin stars:** nearly invisible at rest, with an alpha around 0.05–0.15.
  - They twinkle and grow brighter and larger as the cursor approaches, with a smooth falloff over about 150–250px.
  - Each has its own twinkle phase and color temperature.
  - Pre-render the star sprites, and redraw only near the cursor or on a slow twinkle tick.
- **Little physics** (seeds, petals, motes, chimes, reeds, cairns, snow, filings, droplets):
  - Use a fixed timestep.
  - Drive them from cursor velocity, so the cursor's wake matters, not just its position.
  - Let them settle, and let the loop sleep at rest.
  - Keep them few, small, and in the margins only.
- **Squiggle delights:** the link underline itself reacts. Ideas include:
  - a hue shift or rainbow that travels along the squiggle;
  - hue that follows the cursor's position;
  - plucked-string vibration (a damped spring wave);
  - flowing phase;
  - an aurora gradient;
  - pigment bleed;
  - sparkles at the crests.

  Techniques: CSS custom properties on the hovered link (pointer position as `--x`), a moving gradient behind the mask, or a small per-link canvas or SVG created on hover and removed after. Keep it crisp and tasteful, and return to the normal blue when the cursor leaves. Don't change the text itself, and don't shift layout.

## Global rules (unchanged)

- Start from Josh's real site: `site.css`, `#fdffff` and `#0b1220`, League Spartan, the blue accent.
- Text needs no help: no scrims or shadows.
- Night mode is the showpiece. Light mode is lovely too.
- Reduced motion: one static frame. Delighters respond only to direct pointer input, with no ambient motion.
- **Performance:**
  - Size canvases to their area.
  - No per-draw `ctx.filter`, and no large animated blur or backdrop-filter.
  - Idle loops either sleep or run at 20–30 fps.
  - Pause on `document.hidden`.
  - Footers only run while visible, via IntersectionObserver.
  - WebGL hygiene: cap DPR, handle a null context, lose the context on cleanup.
- Reuse freely: import from or copy any kit (`_refined-d`, `_refined-e`, `_quiet-b`, `_medium-*`, `forest-kit`, and so on). Never edit another kit in place; copy it into your own kit folder to change it.

## Process

- Work only on your themes. Shared code goes in your kit folder. Scratch scripts go in `/private/tmp/claude-501/-Users-josh-repos-dot-com/4db80127-f1c9-44f6-9d98-8e927dbb8cb0/scratchpad/<your-kit>/`.
- **Look at your work:**
  - top, `--scroll 900`, and footer, in dark and light;
  - the header next to #313's, to confirm it's higher, shorter, and dimmer;
  - two header frames about 1 s apart, to confirm the motion is slow;
  - cursor near the stars (they appear) and away (they hide);
  - mid-physics, by moving the mouse quickly through a margin and capturing 150 ms later;
  - a squiggle hover, by hovering a `.site-link` and moving along it.

  Iterate until each one is genuinely delightful.
- Run `~/.venvs/patchright/bin/python tools/errors.py <n>`. It must report 0 errors. It now also catches import and activation errors. It can take minutes, so run it in the background or with a long timeout.
- Final report: 2–3 lines per theme. Be honest about what you didn't check.
