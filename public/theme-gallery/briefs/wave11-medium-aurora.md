# Wave 11: Medium aurora (#281–300), intensity 3–5 out of 10

Read `CONTRACT.md` first; it is binding. Headless browsers only. Don't edit `themes/themes.js`, gallery files, or other agents' files. Your specs are the blurbs for #281–300 in `themes/themes.js`.

## Calibration: this wave is about hitting an intensity level

Josh rated the two previous waves on a 1–10 intensity scale:

- **#241–260 ("Aurora × Adirondacks") are 7–10.** Josh: "super in your face and right behind the text."
  - Full-bleed aurora and landscape directly behind the hero and body.
  - Screenshot **#241, #253, #259** to see this.
- **#261–280 ("Quiet aurora") are 1–2.** Too timid: hairlines, tiny marks, barely visible.
  - Screenshot **#261, #269, #272, #264** to see this.

**Your target is 3–5.**
- The atmosphere should be clearly visible at first glance. A visitor immediately sees "oh, there's an aurora and mountains," but it stays secondary to the content and never demands attention.
- Roughly: if wave 10 whispers and wave 9 shouts, this speaks at a normal, calm voice.
- #91 `parallax-adirondacks` in dark mode is a good reference for the upper end, about 5. Josh loved its subtlety, its parallax and birds, and how things sit "mostly off to the side / below."

Concrete guidelines for 3–5:

- **Coverage:** effects may occupy the top ~25–35% of the viewport, the side margins (full height), and/or the bottom ~15–25%. The middle of the content column stays essentially the plain page background.
- **Presence:**
  - The dark-mode aurora should read as a real aurora: soft, rounded, luminous, and clearly colored.
  - Light-mode versions should be clearly visible pastel, not a faint tint you have to squint at.
  - If someone looking at your screenshot can't immediately point to the aurora, it's too faint. If it's the first thing they see over the hero text, it's too strong.
- **Text needs no help.** Josh: "i don't want to have to have background color/things behind text to make it readable, it should all just be readable anyway."
  - No scrims, panels, text shadows, or darkening layers to rescue text.
  - Effects may pass behind the header or hero edges only where text would be AA-readable regardless.
  - Body paragraphs and lists sit on the plain background.
- **Base design:** start from Josh's real site (`site.css` with no theme): `#fdffff` light, `#0b1220` dark, League Spartan, and a blue accent.
  - Keep that typography and layout.
  - Palette shifts should be modest; a slightly deeper night blue in dark mode is fine.
- **#144 DNA in every theme:** a soft, rounded, blurry-ish aurora that bends and brightens toward the cursor, with movement energy that builds and decays. It rests at a pleasant default on touch devices.
- **Motion:** calm. Slow drift, gentle parallax, and occasional delighters like birds, fireflies, meteors, and loons.

## Reuse

You may import from or copy any existing kit; don't edit them:

- `themes/_aurora-a/aurora.js`: low-res 2D aurora.
- `themes/_aurora-d/kit.js`: WebGL aurora with a 2D fallback.
- `themes/_aurora-b`, `_aurora-c`, `_aurora-e`.
- `themes/_quiet-*`.
- `themes/forest-kit/kit.js`: ridges, pines, Flock, stars.
- `themes/firefly-follow.js` and `themes/parallax-adirondacks.js`.

Seeing how a wave-9 or wave-10 theme did something similar can save time.

## Performance (Josh is a web-perf expert)

- Size canvases to the effect's area. Render the aurora at reduced resolution and let CSS upscale it; that's the blur.
- Never use per-draw `ctx.filter`, big animated `filter: blur()`, or `backdrop-filter`.
- Cache the static scenery and move it with `transform`.
- Idle should be cheap:
  - throttle ambient drift to 20–30 fps;
  - stop when nothing changes;
  - pause on `document.hidden`;
  - use IntersectionObserver for off-screen parts.
- WebGL is allowed. Cap the DPR, handle a null context, and lose it on cleanup.
- Scroll-driven CSS must be compositor-only. Scroll handlers must be passive and must only set transforms.
- Reduced motion: render one static frame. Pointer reaction is allowed only when it is user-driven.

## Process

- Work only on your assigned themes. Shared code goes in your kit folder.
- **Look at your work.**
  - Screenshot each theme light and dark, at the top and scrolled (`--scroll 700`).
  - Take a shot after mouse moves, using a small headless Patchright script.
  - Take a shot at an 800px-wide viewport.
  - Put each next to #241 (too loud) and #261 (too quiet). Yours should sit clearly between them.
  - Iterate until it's tasteful and hits 3–5.
- Run `~/.venvs/patchright/bin/python tools/errors.py <n>`. It must report 0 errors.
- Use your own scratch subfolder for scripts, because other agents share the scratchpad: `/private/tmp/claude-501/-Users-josh-repos-dot-com/4db80127-f1c9-44f6-9d98-8e927dbb8cb0/scratchpad/<your-kit-name>/`.
- **Final report:** 2–3 lines per theme, including where you'd rate it on the 1–10 scale. Be honest about what you didn't check.
