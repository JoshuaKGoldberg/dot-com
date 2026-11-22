# Wave 16: Lake Stars (#366–375)

Read `CONTRACT.md` first; it is binding. Use headless browsers only. Don't edit `themes/themes.js`, gallery files, or other agents' files. Your specs are the blurbs for #366–375 in `themes/themes.js`.

## Starting point

These build on **#362 `vs-open-ridges`** and **#363 `vs-horizon`** (kit: `themes/_vs/`), which are refinements of Josh's favorite #347. Read `briefs/wave15-valley-stars.md` for the rules those follow. Every rule there still holds unless changed below. In particular:

- **Header brightness must fall monotonically from the top edge down.**
- **Squiggle hover changes are driven only by mouse movement.**
- **The footer has no ripples or animals, and moves 3–10x slower than #347.**
- **Nothing sits behind the content text, and there are no masks or boxes.**

Study #362 and #363 in dark and light: top, `--scroll 900`, footer, and after mouse moves.

## Josh's notes, verbatim

> let's go with a halfway between 362 and 363. but make stars a little more visible & frequent & varied in size, i can barely see them ever. and more star delighters:
> * have them get a small color shift in the rainbow colors when highlighted by mouse hover
> * show little edges between them like AST trees on mouse hover
> * 362's ridges are too visible, make them more like the background (darker in dark mode; lighter in light mode). and have them be fewer/shorter in center, taller/more in sides, roughly
> * squigglies: have them all be the same base color blue, but highlight in a new color when hovered. that new color should be a different rainbow-y color based on which part of the squiggle, stationary colors shown on hover, slow animation, very juicy
> * add a subtle glow around the hero image, and also make its background semitransparent 70%, and a subtle glow around my head
> * add more juicy physics effects around the top blur. it should be different each time when hovered and slowly morph into different things
> * more on the top blur, reduce it behind the book/blog/projects/speaking area, both in amount and brightness, be subtle/gradual about this
> * the footer boston text is too close to the bottom of the screen, add a bunch of padding below it. and for most, some kind of reflection-in-the-water effect, sometimes with fog/mist/distortion/weather
> * in 5 of them, add some kind of nice dock on a water ... small dock, like maybe 5-10 ft wide, 20-40ft deep. just wood. be super detailed and cute with it, but not bright - just a subtle thing at the bottom to indicate it's a water zone. this is for the footer

## Requirements

### 1. Base: halfway between #362 and #363

- The footer is about **2.25x** #347's footer height. #362 is 600px and #363 is 750px, so aim for about 675px.
- It has #363's glassy low horizon and open sky, with #362's ridges reworked:
  - **Background-toned.** In dark mode the ridges are only slightly lighter than the night sky, almost silhouettes against it. In light mode they're only slightly darker than the pale sky. They read as atmosphere, not landforms.
  - **Shaped toward the sides.** They're fewer, lower, or absent in the center, and taller with more layers toward both sides, roughly like a valley opening onto the lake.

### 2. Stars

Josh: "i can barely see them ever."

- Make them more visible, more frequent, and more varied in size than in #361–365.
- They're still tiny dark-sky dots, with no flares, crosses, or big halos.
- Use a wider size distribution: mostly small, some medium, and a few slightly larger. Raise density by about 1.5x and resting visibility to about 0.65.
- Body-area stars stay sparse and dim.

**Star delighters near the cursor:**

- **Rainbow tint.** Lit stars pick up a small rainbow hue shift. For example, each star's hue is based on its angle around the cursor, or on its position. It's subtle and returns to the star's natural color when the cursor leaves.
- **AST-tree edges.** Lit stars link with thin, faint lines that form a *tree* like an abstract syntax tree.
  - Build it as a rooted hierarchy: a root star near the cursor, with children branching downward or outward. A minimum spanning tree of the lit stars, rooted at the one nearest the cursor, is a good approach.
  - You can use elbow or orthogonal connectors to evoke tree diagrams.
  - Optionally add tiny node dots.
  - Edges grow out from the root with a short stagger when they appear, and fade when the cursor leaves.
  - Keep it elegant and faint.

Copy `themes/_sky/stars.js` into your kit and extend the copy. Don't edit the original.

### 3. Squiggles

- **At rest:** every squiggle is the same base blue, the site's normal `--siteSquiggle`.
- **On hover:** the squiggle highlights in rainbow colors that vary *along its length*, so different parts get different hues. Once revealed, those colors are **stationary**: the hue map is fixed to position along the squiggle and doesn't cycle.
- **The transition in is slow and juicy,** about 0.6–1.2 s. For example:
  - the color sweeps outward from the point where the cursor entered;
  - there's a soft glow bloom;
  - the stroke thickens slightly with a gentle overshoot;
  - optionally, a few glints along the crests.
- **On leaving,** it eases back to blue.
- Don't shift layout or change the text.
- Vary the juicy treatment across the ten themes, but keep these rules in all of them.

### 4. Hero portrait

The portrait is `<picture class="site-portrait">` with `assets/josh-light.webp` and `assets/josh-dark.webp`, both 256×256 and already circular. A person mask is provided at **`assets/josh-mask.png`**: 256×256 grayscale, white on Josh and black on the background. It works for both images.

- **Subtle glow around the hero image.** A soft halo around the circular portrait, in aurora tones, that's barely there.
- **Background at 70% opacity.** The photo's background, everything outside Josh, renders at 70% opacity so the page shows through slightly. Josh himself stays fully opaque. Compose the person layer and the background layer with the mask, using a canvas or CSS `mask-image` on two stacked copies of the image.
- **Subtle glow around his head and shoulders.** A soft rim glow that follows the silhouette, rendered once. A one-off blur of the mask on a canvas at build time is fine; a live filter is not.
- Keep the alt text and the image's layout box unchanged.

### 5. Top aurora (the "top blur")

- **Keep the #361–365 header:** a monotonic falloff from the top edge, soft rounded drapery, and a local brightness, saturation, and hue response near the cursor.
- **Add juicier physics on hover. Each time the cursor arrives, the interaction should be different, and it should slowly morph into something else while you stay.** Pick from several modes and blend between them over seconds. For example:
  - the cursor stirs a soft fluid-like advection of the drapery;
  - a slow vortex;
  - a breathing bloom;
  - spring lobes that wobble;
  - a few drifting sparks of light.

  Pick a mode on entry, with a different seed each time, and crossfade or morph through two or three over about 5–15 s. Keep it calm and luxurious, not frantic.
- **All of this must preserve the monotonic top-down falloff.** Displace sideways, change hue, saturation, and brightness per column, and lengthen the hang. Never create a brightness peak below the top.
- **Attenuate behind the nav.** Gently reduce both the amount and brightness of the aurora in the columns behind the Book, Blog, Projects, and Speaking links, with a broad, gradual falloff of about 150px or more on each side.
  - **Implement this as an x-only gain factor** from the nav links' bounding box, so monotonicity in y is preserved.
  - It should be subtle: maybe 40–60% of normal at the center of the nav, easing back to full.

### 6. Footer

- **Add a lot more padding below "Made with 💙 in Boston…".** The text should sit well up in the footer, with roughly 8–12rem or more of scenery below it before the page ends.
- **Water reflection.** Most themes have a clear reflection of the sky, aurora, and ridges in the water. Some add weather or atmosphere, as each blurb says:
  - low mist;
  - a fog bank;
  - slow wind shimmer;
  - light snowfall;
  - faint drizzle.

  All of it is slow and still-feeling, 3–10x slower than #347. There are no ripple rings and no animals.
- The sky fades in from transparent, with no hard top edge. It runs to the very bottom, with `.site-page { padding-bottom: 0 }`. It runs only while visible.

### 7. The dock (#371–375 only)

The dock is built separately as a reusable module, **`themes/_dock/dock.js`**, by the dock agent. API:

```js
import { createDock } from "./_dock/dock.js";
const dock = createDock({ dark, scale, side, seed }); // side: "left" | "right" | "center"
// dock.canvas      HTMLCanvasElement, static, pre-rendered, transparent background, includes the dock's own subtle reflection
// dock.width, dock.height   CSS px
// dock.waterlineY  CSS px from the canvas top, where the deck and pilings meet the water
// dock.anchorX     CSS px from the canvas left, the dock's base (the near end)
```

- **Dock look:**
  - It's small, about 5–10 ft wide and 20–40 ft long, and seen from the shore, receding into the lake in gentle perspective.
  - It's just wood, super detailed and cute: planks with gaps and grain, pilings, cross-bracing, a cleat or two, and maybe a lone post or a small ladder.
  - It's **not bright**. It's a subtle, low-contrast silhouette-ish presence at the bottom, there to signal a water zone.
- **Placement:** the near end sits at the very bottom edge of the page. Offset it to one side, or use a long, narrow center dock that sits below the footer text, so the footer text is never over the dock.
- The footer theme draws `dock.canvas` into its scene at the bottom. It can extend the dock's reflection with the theme's weather, such as mist around the pilings or drizzle softening it.

## Global rules (unchanged)

- Text needs no help: no scrims or shadows.
- Night mode is the showpiece; light mode must be lovely too.
- Reduced motion: one static frame, with pointer reaction only when the user drives it.
- **Performance:**
  - Canvases are sized to their area.
  - No per-draw `ctx.filter`, and no large animated blur or backdrop-filter. One-off build-time blurs are fine.
  - Idle loops sleep or run at 20–30 fps.
  - Pause on `document.hidden`.
  - Footers run only while visible.

## Process

- Scratch work goes in `/private/tmp/claude-501/-Users-josh-repos-dot-com/4db80127-f1c9-44f6-9d98-8e927dbb8cb0/scratchpad/<your-kit>/`.
- **Look at your work.** Check each of these:
  - Dark and light at the top, at `--scroll 900`, and at the footer.
  - The header luminance check: sample columns, including under the nav, and confirm luminance never increases with y. Do this at rest and during hover modes.
  - The nav attenuation is visible but gradual.
  - Star delighters: the cursor near stars shows the AST edges and the tint.
  - Squiggles: at rest all blue. On hover there's the juicy reveal, the colors hold still when the mouse stops, and they return to blue on leaving.
  - The portrait glow, the 70% background, and the head glow, cropped and zoomed.
  - Footer padding and weather, and two footer frames 2 s apart to confirm it's slow.
  - For the dock themes, the dock cropped and zoomed: detailed, subtle, not bright.
  - Iterate until it's genuinely lovely.
- Run `~/.venvs/patchright/bin/python tools/errors.py <n>`. It must report 0 errors. It takes minutes, so use a long timeout or run it in the background.
- **Final report:** 2–3 lines per theme, plus the header luminance result. Be honest about what you didn't check.

## Update: water physics at the dock (Josh, verbatim)

> in 3 of the dock images, add a full super fancy complex well-featured water simulation / physics thing so we can see little ripples of water / waves at the parts of the dock going into the water. be real fancy with this, make it cool and impressive

This applies to **#371 (mirror), #373 (drizzle) and #375 (dusk wind)**. These three are exempt from the earlier "no ripples" rule. The other dock themes, #372 and #374, stay still.

It's a separate module, **`themes/_water/water.js`**, built by the water agent:

```js
import { createWaterSim } from "./_water/water.js";
const water = createWaterSim({
  width, height,          // CSS px of the water region (the footer's lake band)
  dark, reduced,
  obstacles,              // [{ x, y, r }] CSS px in water-region coords: piling footprints at the waterline
  reflection,             // HTMLCanvasElement: what the still lake would show (sky, aurora, ridges, dock reflection), same size as the region
  weather,                // "calm" | "drizzle" | "wind"
});
// water.canvas            : the rendered water, same CSS size, to place over the lake band
// water.setReflection(c)  : swap the reflection source (e.g. when the aurora updates; call at most ~10–15 fps)
// water.setObstacles(list)
// water.start() / water.stop() / water.destroy()
```

The dock module adds **`dock.pilings`**, `[{ x, y, r }]` in dock-canvas CSS px, where each piling meets the water. The footer converts them to water-region coordinates and passes them as `obstacles`.
