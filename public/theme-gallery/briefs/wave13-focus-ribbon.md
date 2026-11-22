# Wave 13: Focus & Ribbon (#321–340), intensity 6–8

Read `CONTRACT.md` first; it is binding. Use headless browsers only. Don't edit `themes/themes.js`, the gallery files, or other agents' files. Your specs are the blurbs for #321–340 in `themes/themes.js`. The number in parentheses at the end of each blurb is its target intensity.

## What Josh asked for

> "20 variations that are like 244-aa-focus, 243-aa-ribbon, and similar, but with subtlety at least half of the way closer to those, and at most at those levels, varying"

### Intensity scale (Josh's 1–10)

| Themes | Intensity |
| --- | --- |
| #261–280 | 1–2 (too timid) |
| #281–300 | 3–5 |
| **#243 Aurora Ribbon** and **#244 Aurora Focus** | about **8**, the ceiling for this wave |

This wave spans **6 to 8**. Six is halfway between the medium wave (about 4) and #243/#244; eight is their level. Don't exceed #243/#244.

To hit 6 or 7, dim the aurora's peak, shrink how far it reaches down toward the hero, and quiet the scenery. Keep the same character and beauty.

## Study first

Read the code and screenshot in dark and light, at the top, scrolled, and after mouse moves:

- **#244 `aa-focus`**: soft haze at rest; pointer speed raises "crispness", which adds rays and a tighter lower edge, then relaxes over about a second.
- **#243 `aa-ribbon`**: a silk ribbon whose width pinches and swells, with a soft veil below. The cursor bends it, and it is mirrored in the lake.
- **#241 `aa-soft-valley`** and **#242 `aa-veil`**: the same family.
- All four are built on `themes/_aurora-a/aurora.js` (a per-pixel aurora into a tiny canvas, upscaled by CSS) and `themes/_aurora-a/valley.js` (the #91 valley).
- **#91 `parallax-adirondacks`**: the scenery Josh loves.

Josh liked the mechanics and look of #243 and #244. He found that wave as a whole "super in your face and right behind the text", which is why this wave lowers intensity at the bottom of its range.

## Rules

- **Reuse `_aurora-a`.** Import from it, or copy it into your own kit and extend it. Don't edit it in place.
- **The #144 DNA:** the aurora bends and brightens toward the cursor, and movement energy builds then decays.
- **Text needs no help:** no scrims, panels, or text shadows. Text must be AA-readable as-is.
  - At intensity 6–7 the aurora should fade out before it reaches the hero text.
  - ~~At 8 it may sit behind the header and hero~~ **Revoked; see the update at the end.**
- Night mode is the showpiece. Light mode must be lovely too, as an intentional pastel or dawn.
- **Reduced motion:** one static frame, with pointer reaction only when user-driven.
- **Performance:**
  - Render the aurora at low resolution and let CSS upscale it.
  - Cache the scenery and parallax it with `transform`.
  - Throttle idle to 20–30 fps, and pause when `document.hidden`.
  - Physics (#327, #333) uses a fixed timestep and sleeps at rest.
  - No per-draw `ctx.filter`, and no large animated CSS blur or backdrop-filter.
  - WebGL is allowed with the usual hygiene, but `_aurora-a`'s 2D approach already looks great.

## Process

- Work only on your themes. Put shared code in your own kit folder.
- Keep scratch scripts in `/private/tmp/claude-501/-Users-josh-repos-dot-com/4db80127-f1c9-44f6-9d98-8e927dbb8cb0/scratchpad/<your-kit>/`.
- **Look at your work.**
  - Screenshot light and dark, at the top, at `--scroll 700`, during or after quick mouse moves (capture 100–300 ms after), and at rest about 2 s after moving.
  - Compare against #243 and #244 side by side to confirm your intensity target.
  - Iterate until it's beautiful.
- Run `~/.venvs/patchright/bin/python tools/errors.py <n>`. It must report 0 errors.
- **Final report:** 2–3 lines per theme, including the intensity you think you hit. Be honest about what you didn't check.

## Update: footers like #236–240 (Josh: "have footers like in the 238-y range, they're beautiful")

Every theme in this wave gets a footer in the style of the bottoms of the Zero JS aurora descents, #236–240 (`themes/zj-aurora-descent-*.css` and their asset folders). Scroll each one to the very bottom in dark and light to see them. They have:
- a dark spruce treeline silhouette;
- sometimes a peak, a fire tower (#238), or a lean-to with a campfire and sparks (#240);
- a still lake beneath that mirrors the aurora in soft, rippled reflection strips.

Rules for the footer:
- Give it a band of about 240–360px at the page's end, behind and around the footer text. Vary the details across your themes (peak, fire tower, campfire, islands, a dead snag), but keep the treeline and the aurora mirror lake.
- Reflect *your* theme's aurora, the same colors and ideally its live state, at low resolution.
- **Do not copy their scrim.** The descents put a dark rounded panel behind the footer text. Text here must be readable without one, so arrange the scenery so the footer text sits over the calm sky or water.
- Run it only when it is scrolled into view, using IntersectionObserver.

## Update 2: placement (Josh, after seeing #339 and #340: "WAY too intense. don't lose the context of i don't want visual clutter behind where text is. these things should mostly just be in the sides, a bit on top, and below the footer / behind footer.")

This overrides anything above.

- **Placement**
  - **Allowed:** effects live in the side margins (outside the ~52rem content column), a bit at the very top, and below and behind the footer.
  - **Not allowed:** no aurora, ribbon, ridge, lake, tree, or bird crosses behind the hero text, the body paragraphs, or the post, project, and talk lists, at any intensity.
  - **Scroll:** the top portion fades or scrolls away within the first ~400px of scroll.
- **Intensity 6–8 means richer and more vivid in those zones, not bigger.** Use brighter margins, more dramatic folds at the sides, and a lusher footer. Never more coverage behind text.
- Check this in screenshots: at the top, at `--scroll 900`, and at the footer, the content column behind the text should look essentially like the plain site background.

## Update 3: no visible column box (from my review of #335, #339 and #340)

The column mask now reads as a **panel**: a visible rectangle of solid page background running from just under the header to the footer, with distinct vertical edges and a hard horizontal step where it meets the footer. In light mode it even looks like a card with a shadow. Josh hates scrims and panels, and this is one.

Fix it so the content column is never a visible shape.
- **Compose the scene so it thins naturally toward the column.**
  - Trees get smaller and sparser toward the middle and stay in the margins.
  - The aurora's side curtains fade with horizontal distance from the edge.
  - The top band spans the full width at the very top and fades downward, so it isn't cut by a box.
- **If you still need a mask,** feather it over 160–240px, ending at the margin, and shape it so it's never perceptible as a rectangle. There should be no straight vertical edges visible anywhere.
- **No hard horizontal steps** at the footer. Blend the footer's sky continuously into the page above it.
- **Check the result.** At the top, at `--scroll 900` and at the footer, in both modes, you should not be able to see where the column is. It should just look like the scenery fades out.

## Update 4: the real point (supersedes Updates 2 and 3)

Josh: "you grossly misinterpreted me with 338, 337, etc. - i'm not saying just darken the area behind text. i'm saying make the visual things subtle enough and placed side/top/bottom enough that they don't interfere with text. there shouldn't be these awkward boxes at all. bad job. think about what i'm saying and why i'm saying it."

**Why he's saying it:** this is his personal site, so the content comes first. The scenery should be designed to sit at the edges of the page, never something full-screen with a hole cut out of it. Masking a full scene, whether with a hard edge or a feathered one, still reads as a box, because the scene obviously continues "under" the column.

**So: no masks, no cover layers, and no painting `--siteBg` over anything.** Delete that code. Instead, compose scenery that only exists at the edges:

- **Sides**
  - Small pine and spruce stands anchored to the left and right viewport edges, growing from the bottom edge or the footer upward.
  - Keep them short, a fraction of the viewport height, and sparse.
  - They never reach toward the middle.
- **Top**
  - The aurora, ribbon, or focus curtain lives in a band at the very top: brightest at the top edge and the outer corners, fading out well above the hero title.
  - If you want more presence, let it run partway down the side edges, like light at the margins. Never let it spread into the middle.
  - It scrolls or fades away within about 400px.
- **Bottom**
  - The #236–240-style footer, with treeline, lake, and mirror, at the page's end, behind the footer.
- **No full-width ridges, valleys, lakes, or mid-page horizons.** The #91 valley composition doesn't work here, so don't use it.
- **Intensity 6–8** means those edge elements are more vivid: brighter aurora at the top and corners, richer motion, a lusher footer. It never means more coverage.

**Self-check:** in each screenshot (top, `--scroll 900`, footer, both modes), ask whether anything looks like a rectangle, a panel, an edge, or a band crossing the content. Ask whether the middle looks naturally calm because nothing is there, not because something covers it. If you can see where "the column" is, it's wrong.
