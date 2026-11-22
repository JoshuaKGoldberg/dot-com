# Wave 10: Quiet Aurora (#261–280)

Read `CONTRACT.md` first. It is binding. Headless browsers only, and don't edit `themes/themes.js`, the gallery files, or other agents' files. The entries for #261–280 already exist in `themes/themes.js`, and their blurbs are your specs.

## Josh's feedback on the previous wave (#241–260): read this twice

> "these 20 are super in your face and right behind the text. i want to be much classier and subtle. have these new 20 be more like the clean, minimalist design i have already. but still have some delighters and coolness. just, you know, less jarring. like, i don't want to have to have background color/things behind text to make it readable, it should all just be readable anyway"

Screenshot #241 and #259 to see what *not* to do: a full-bleed aurora and landscape directly behind the hero and body text.

## The bar

- **Start from Josh's real design.** `site.css` with no theme is roughly today's joshuakgoldberg.com: near-white `#fdffff`, League Spartan, a blue accent, and a dark mode on `#0b1220`.
  - Your theme should look like *that site* first.
  - Keep its palette, typography, and layout. Tiny palette tweaks are fine; redesigns aren't.
  - A visitor should see a clean, minimalist personal site, and only notice the delighter a few seconds later.
- **Nothing behind the text.** No scrims, panels, or text shadows that exist to rescue readability.
  - The content column (`.site-page`, about 52rem wide) has the plain page background behind it.
  - Effects live in the margins and gutters, a thin band at the very top, the header's edges, the footer, small framed spots (a corner, a section mark, the portrait), or the link squiggles themselves.
  - If an effect does pass near text, it must be so faint that text contrast is unchanged in practice. Text should pass AA against the bare background without help.
- **Small and quiet.**
  - Effects typically cover well under 15% of the viewport.
  - Motion is slow and low amplitude, and colors are low saturation and low contrast in light mode. Dark mode can glow a little more, but it's still a whisper.
  - Nothing flashes, and nothing competes with the hero.
- **Still delightful.** Every theme still has the #144 DNA somewhere: an aurora, however small, that responds to the cursor.
  - It leans toward the cursor and brightens with movement. Movement adds energy that decays.
  - Add a small surprise you'd smile at on the second visit: birds, fireflies, a season glyph, a constellation, a ridge drawing itself.
  - Think "the subtle craft a perf-expert frontend dev would put on their own site", not "screensaver".
- **Respect the layout at all widths.** Margin effects should gracefully disappear on narrow screens rather than collide with text. Check widths of 1280 and 800.

## References from Josh's favorites

Pull from these, at a tiny scale:

- **#144** `aurora-follow`: the cursor-reactive aurora behavior.
- **#91** `parallax-adirondacks`: Adirondack ridges, pines, birds, and parallax. Josh liked that things sat "mostly off to the side / below".
- **#93** `seasons-forest`: seasons.
- **#135** `firefly-follow`: fireflies.
- **#166** `paddle-scroll`: mist on the water.
- **#215** `zj-night-sky`: night skies.

`themes/_aurora-a/aurora.js` (a low-res 2D aurora) and `themes/_aurora-d/kit.js` (a WebGL aurora) are available to import or copy. Don't edit them.

## Performance (Josh is a web-perf expert)

- **Small effects should be cheap effects.**
  - Size canvases to the effect's area, not the viewport, so a 1280×120 strip renders a 1280×120 canvas at low resolution.
  - Prefer CSS and SVG where they suffice.
- **Idle is (nearly) free.**
  - Stop loops when nothing changes, and throttle ambient drift to 20–30 fps on small canvases.
  - Pause when `document.hidden`.
  - Use IntersectionObserver so off-screen effects (the footer and section marks, for example) don't run until visible.
- WebGL is allowed. Cap the DPR, handle a null context, and lose the context on cleanup.
- Scroll-driven CSS must be compositor-only (see CONTRACT.md).
- Startup is cheap: defer setup to idle time or visibility.

## Process

- Work only on your assigned themes. Shared code goes in your own kit folder, named in your assignment.
- **Look at your work:**
  - Screenshot each theme in light and dark, at the top and scrolled (`--scroll 700`), and after moving the mouse; write a small headless Patchright script for that.
  - Also screenshot at an 800px-wide viewport.
  - Compare each against the plain site and against #241. Yours should look much closer to the plain site.
  - Iterate until it is tasteful.
- Run `~/.venvs/patchright/bin/python tools/errors.py <n>`. It must report 0 errors.
- Final report: 2–3 lines per theme, plus anything you're unsure about. Be honest about what you did not check.
