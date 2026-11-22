# Wave 17: Fog Lake (#376–380)

Read `CONTRACT.md` first; it's binding. Use headless browsers only. Don't edit `themes/themes.js`, gallery files, or other agents' files. Your specs are the blurbs for #376–380 in `themes/themes.js`.

## Josh's notes, verbatim

> http://localhost:4400/#374-vs2-dock-fog looks WONDERFUL in dark mode, but seems ... off? in light mode. make 5 more variations of it, with better light mode colors. also, remove the dock from these 5 variations. and do some better things with the footer text, it looks weirdly out of place. idk what to do with it

> i LOVE the effects in http://localhost:4400/#371-vs2-dock-mirror, especially the circuitry and parallax and top colors/etc.

## Starting point

Start from **#374 `vs2-dock-fog`**: kit `themes/_vs2/`, theme config `themes/vs2-dock-fog.js`. Copy the kit to `themes/_vs3/` and don't edit `_vs2`. Read `briefs/wave16-lake-stars.md` and `briefs/wave15-valley-stars.md`; every rule there still holds.

- **Keep #374's dark mode exactly as wonderful as it is.** Same composition, fog, aurora, ridges and reflection. The only change is that there's no dock.
- **Use #371's effects:** circuit edges between lit stars, the three-layer star parallax, and #371's top aurora colors and modes. Diff `vs2-dock-mirror.js` against `vs2-dock-fog.js` to see the config differences.
- **Remove the dock completely**, including any dock-specific fog pooling.

## Why #374's light mode looks off

I screenshotted it, so you don't have to rediscover this:

- **Washed out.** The sky, ridges, fog and water are all near-white (#f0–#fd). There's no depth and no sense of place, and the scene reads as bleached rather than as a light-mode landscape.
- **The aurora** is pale mint smudges with no structure.
- **Stars** on the white sky read as grey dust or dirt specks.
- **The ridges** are barely distinguishable from the sky, and the water is the same white as the sky.

## Light mode for these five

Each variant gets its own intentional light palette, named in its blurb:

| Theme | Palette |
| --- | --- |
| #376 | rose-peach dawn |
| #377 | cool misty blue morning |
| #378 | warm cream and sage golden hour |
| #379 | icy blue-white winter day |
| #380 | periwinkle blue hour |

- **The page stays a light page.** The upper page and content area keep the site's near-white background (`#fdffff`) or a very slight tint. All the color goes into the footer scene and the top band.
- **The footer scene needs real tonal range,** but stays soft.
  - The sky gradient carries the palette's hue.
  - The ridges are clearly but gently darker than the sky, with an atmospheric perspective of 2–3 layers.
  - The fog is a lighter veil with its own subtle tint.
  - The water is slightly deeper than the sky, with a visible reflection.
  - Think of a soft watercolor or a hazy morning photograph. It should never be grey-on-white.
- **The aurora in light mode** is a pastel version of the palette (teal, lilac, rose, gold) with the same rounded, folded structure as dark mode. It shouldn't be shapeless mint blobs.
- **Stars in light mode** are never grey specks.
  - Either render them as tiny pale highlights with a faint tint, nearly invisible at rest and appearing near the cursor, over tinted sky,
  - or keep them only where the scene sky is tinted enough for them to read as light points.
  - Over the near-white page area they should be essentially invisible unless the cursor is near.
- **Top band in light mode:** the same palette logic, still monotonic from the top edge down.
- **Keep text AA-readable everywhere,** with no scrims.

## Footer text ("Made with 💙 in Boston / using Astro, Solid, and TypeScript. / view source")

Josh: "it looks weirdly out of place. idk what to do with it."

Right now it floats centered over the horizon or water with no relationship to the scene or to the page's structure. Each variant tries a different treatment, named in its blurb:

- **#376: horizon caption.** Small, letter-spaced, muted text set to sit just above the horizon line. The lake shows a faint mirrored reflection of it: a vertically flipped, low-opacity copy, compressed vertically and gently wavering. The text stays crisp and the reflection is decorative, with `aria-hidden`.
- **#377: column sign-off.** Move the credit out of the scenery. Put it at the top of the footer, aligned to the content column's left edge like the rest of the page, with a hairline rule above, smaller muted text, and "view source" as a normal link. The scenery then reads as a pure end-cap below it.
- **#378: star-chart label.** The credit is set small, letter-spaced and in small caps, up in the footer's sky region above the aurora, like a label on a star chart. It can carry a tiny star or marker glyph and a faint leader line. "view source" is a quiet link.
- **#379: emerging from fog.** The credit sits in the fog band and fades or condenses into view as it scrolls in, using a compositor-friendly opacity or `translate` scroll animation, and is fully readable once in view. Don't blur the text itself.
- **#380: map legend.** Split the credit into the footer's bottom corners, like a map's legend and credits. Put "Made with 💙 in Boston" bottom-left and "Astro · Solid · TypeScript · view source" bottom-right, small and letter-spaced, sitting on the lake's near shore.

In every variant:
- Keep the credit's content and links.
- Keep it readable in both modes.
- It should feel like it belongs, both to the page's typography (League Spartan) and to the scene.
- Make sure there's generous space below it before the page ends, unless the layout puts it at the top of the footer, as #377 does.

## Process

- Scratch files go in `/private/tmp/claude-501/-Users-josh-repos-dot-com/4db80127-f1c9-44f6-9d98-8e927dbb8cb0/scratchpad/_vs3/`.
- **Look at your work.** For each theme, take dark and light screenshots at the top, at `--scroll 900`, and at the footer. Compare dark against #374 to confirm it's unchanged apart from the dock.
- **Light mode is the main deliverable,** so judge each palette critically and iterate. Ask whether it reads as a beautiful light-mode landscape, or as bleached or grey.
- **The footer text treatment** should be checked at 1280 and 800 wide.
- Run `~/.venvs/patchright/bin/python tools/errors.py <n>`; it must report 0 errors. It takes minutes, so use a long timeout or run it in the background.
- **Final report:** 2–3 lines per theme. Be honest about what you didn't check.
