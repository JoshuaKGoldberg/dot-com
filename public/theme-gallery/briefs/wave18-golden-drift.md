# Wave 18: Golden Drift (#381–385)

Read `CONTRACT.md` first. It is binding: headless browsers only, and don't edit `themes/themes.js`, gallery files, or other agents' files. Your specs are the blurbs for #381–385 in `themes/themes.js`.

## Base

Start from **#378 `fl-golden`**. Its kit is `themes/_vs3/` and its config is `themes/fl-golden.js`. Copy the kit to `themes/_vs4/` and don't edit `_vs3`.

Read `briefs/wave17-fog-lake.md`, `wave16-lake-stars.md` and `wave15-valley-stars.md`. Every rule in them still holds unless this brief changes it, notably:

- The header's brightness falls off monotonically from the top edge.
- Squiggles stay blue at rest; on hover they reveal stationary rainbow colors, driven by the mouse.
- Nothing sits behind content text except sparse, dim body stars, and there are no masks or boxes.
- Star density ramps gradually across the margins.
- The header rests at 25% opacity and rises to 75% over about 5 s on hover.

Study #378 in dark and light (top, `--scroll 900`, footer), and study #379's footer.

## Josh's notes, verbatim

> for 5 more explorations, let's go with 378 golden as the base starting point. but with changes:
> * each area should start off much more subtle, like 1/2 as visible at most (try a few different), then slowly get more visible as the mouse stays near it
> * 379 winter day's footer style for the footer text
> * abandon the reflecting water and mountains and such for the footer. instead, have it be the same effect as the header, but much larger. still very subtle at first -less so than the header- and then gradually more visible.
> * for the footer, also explore different additions of a lot more circuitry/star-circles/nodes/edges as with the side views
> * for the side views, also increase the maximum amount of stuff (since they're more subtle at first)

## Requirements

### 1. Dwell reveal, per area

There are four areas: the header aurora, the left side, the right side, and the footer. Optionally the portrait background is a fifth.

- **Resting visibility.** Each area rests at a reduced visibility: at most half of #378's current level. Each variant uses its own resting level:

  | Theme | Resting level |
  | --- | --- |
  | #381 | 0.5 |
  | #382 | 0.25 |
  | #383 | 0.33 |
  | #384 | 0.4 |
  | #385 | starts subtle, blooms the most |

- **Dwell.** While the cursor stays near an area, a per-area dwell value rises slowly over roughly 4–8 s toward full, which is about #378's level or slightly richer. When the cursor leaves, it decays just as slowly.
  - Proximity is soft. The sides respond to cursor distance from that margin; the header responds near the top; the footer responds when the cursor is over or near it.
- **Header.** Its existing 25%→75% hover behavior counts as its dwell. Lower its resting level to match the variant's level.
- **Mechanism.** Use a compositor-friendly opacity on each area's layer, plus per-area intensity uniforms where a shader needs them. Don't animate CSS filters.
- **Reduced motion.** Show the resting level, then jump straight to the dwell level with no slow animation.

### 2. Footer: abandon the lake

- Remove the water, reflection, ridges, mountains, fog, horizon and treeline from the footer.
- Instead, the footer has **the same aurora effect as the header, but much larger**: the same soft, rounded drapery shader and the same palette, colors and hover modes.
  - It's mirrored, so it rises from the bottom edge. Brightness is monotonic: highest at the very bottom of the page and fading upward.
  - It's much taller, filling roughly the bottom 400–600px of the page.
- **Very subtle at first, even more so than the header.** Then it grows gradually more visible with dwell, and with the same slow hover-mode morphing as the header.
- The footer still runs only while it's visible.

### 3. Footer text

Use **#379 winter day's credit treatment**: the credit fades and rises into view as it scrolls in, using a CSS scroll-driven animation (opacity and translate only, with a fallback to fully visible). Place it so it sits well inside the footer aurora, with generous space below it, and make sure it stays readable in both modes.

### 4. Circuitry in the footer

Add a lot more circuitry, star circles, nodes and edges in the footer, in the same visual language as the side views: depth-aware edges, parallax and rainbow tint near the cursor. Each variant explores a different take:

| Theme | Footer network |
| --- | --- |
| #381 | Sparse star-circuit field |
| #382 | A dense constellation-and-circuit network that lights up around the cursor |
| #383 | Drifting graph nodes and edges in 2–3 parallax layers |
| #384 | Circuit traces routing between star pads across the whole footer, with 45° bends and pads |
| #385 | A rich mix of star circles, nodes and circuitry |

Like everything else, it's subtle at rest and comes alive with dwell. Edges grow out near the cursor and fade when it leaves. Keep the footer text readable: thin the network out right behind the text.

### 5. Side views: more stuff

The sides now start more subtle, so raise their maximum:

- more stars, about 1.5–2x the current outer density;
- more and longer edge trees;
- an optional extra node or circle ornament.

All of this is visible only as dwell rises. Keep the gradual density ramp from the text column outward, with no visible boundary.

## Global rules (unchanged)

- Text needs no help: no scrims or shadows.
- Night mode is the showpiece; light mode must still be lovely. #378's golden light palette is the base.
- **Performance:**
  - Canvases are sized to their area.
  - Idle loops sleep or run at 20–30 fps.
  - Pause when `document.hidden`.
  - The footer runs only while visible.
  - No per-draw `ctx.filter` and no large animated blur.

## Process

- Scratch files go in `/private/tmp/claude-501/-Users-josh-repos-dot-com/4db80127-f1c9-44f6-9d98-8e927dbb8cb0/scratchpad/_vs4/`.
- **Look at your work.** Check each area at rest and after holding the cursor near it for about 6 s. Capture two screenshots, at rest and dwelled, in both modes.
  - Confirm the resting levels differ visibly across the five themes.
  - Confirm the footer aurora's luminance is monotonic from the bottom edge upward. Sample columns the same way the header check does.
  - Check the footer network and the credit fade-in by actually scrolling to the footer.
- Run `~/.venvs/patchright/bin/python tools/errors.py <n>`. It must report 0 errors. It takes minutes, so use a long timeout or run it in the background.
- Final report: 2–3 lines per theme. Be honest about what you didn't check.
