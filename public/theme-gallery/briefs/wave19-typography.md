# Wave 19: Typography (#386–400)

Read `CONTRACT.md` first; it is binding. Use headless browsers only. Don't edit `themes/themes.js`, gallery files, or other agents' files. Your specs are the blurbs for #386–400 in `themes/themes.js`.

## Josh's request, verbatim

> next, let's work on typography. I want the front stuff to say "Hello. I'm Josh. \n I'm a serious TypeScript developer." do 15 explorations of nice fonts for that that work for the site we have so far.

## Base

Every theme is **#385 `gd-bloom`**: the full current design, including the aurora, stars, graphs, footer and squiggles. Don't change any of its visuals. Each typography theme only:

1. Replaces the hero copy:
   - **Headline** (`.site-title`): `Hello. I'm Josh.`
   - **Second line** (`.site-tagline`): `I'm a serious TypeScript developer.`
   - Use real typographic apostrophes (’).
2. Sets fonts and typesetting for the hero, and harmonizes the rest of the site: headings, body, nav, list items, meta and the footer credit.

### Implementation pattern

Keep it tiny per theme. Make a shared helper in `themes/_type/`, for example `withType(baseActivate, { copy })`, which:

- rewrites the hero text on `root`, which the gallery restores pristine before each activation, so mutating it is safe;
- then calls `gd-bloom`'s `activate`;
- returns its cleanup.

Each `ty-*.css` should `@import "./gd-bloom.css";`, then load its fonts, then set its typography.

## Research to use

All three files are in `/private/tmp/claude-501/-Users-josh-repos-dot-com/4db80127-f1c9-44f6-9d98-8e927dbb8cb0/scratchpad/fonts/`:

- **`ai-slop.md`: fonts and patterns to avoid.** Never use Inter, Space Grotesk, Roboto, Open Sans, Lato, Poppins, DM Sans, Manrope, Outfit, Geist, or Montserrat. Avoid the "one italic serif accent word" trick, gradient or clipped text on headings, and the pill badge over a centered hero. Avoid hierarchy by weight only, with one family everywhere.
- **`latest.md`**: 2023–2026 faces with loading URLs, axes, and pairings.
- **`classic-personal.md`**: classics, admired personal sites, and the patterns worth stealing:
  - a serif with display personality plus a quiet sans or mono for UI;
  - the `opsz` axis;
  - hero `clamp()` sizing with line-height around 1 and tracking of -0.02 to -0.03em;
  - slightly lighter weights and off-white on dark backgrounds.

## The 15

Each blurb names the face. Before building, verify every font:
- it actually loads, so check `document.fonts` for the family and that rendering doesn't fall back;
- the axes you rely on exist on that font.

If a named font can't be loaded reliably (for example Redaction, Special Gothic, Mona Sans, Gambetta, Monaspace, Datatype, or Commit Mono), use the closest equivalent from the research notes. Say so in your report, and only substitute with something not on the avoid list.

Sources to use:
- Google Fonts css2 URLs, preferably with `display=swap` and only the weights and axes you need;
- Fontshare CSS for Gambetta;
- jsDelivr or GitHub releases for Monaspace, Commit Mono, and Mona Sans if they aren't on Google Fonts.

## Typesetting quality bar

Each exploration should feel like a deliberate typographic decision by someone with taste, not a font swap. For each one:

- **Hero sizing:** treat the headline and second line as a designed pair, with real size contrast and good rhythm. Use `text-wrap: balance`, and set line-height and tracking for that face. Make sure "Hello. I'm Josh." sits beautifully, and consider punctuation hanging or optical alignment where it helps.
- **Weights:** suit dark mode, so slightly lighter, and light mode. Use off-white rather than pure white on navy.
- **Rest of the page:** body, list, meta, and nav should pair well and stay readable, at 16–18px body size with comfortable line-height.
- **No layout regressions:** check the hero at 1280 and 800 wide, and the portrait alignment. Keep CLS low by matching fallback metrics with `size-adjust` or `ascent-override` where practical, or at least choose a close fallback.
- **Performance** (Josh is a perf expert): load only the weights and axes used, and preconnect if you use a remote host. Note each theme's total font payload in your report, from the network transfer sizes measured headlessly.

## Process

- Scratch files go in `/private/tmp/claude-501/-Users-josh-repos-dot-com/4db80127-f1c9-44f6-9d98-8e927dbb8cb0/scratchpad/_type/`.
- Screenshot the hero area of each theme in dark and light at 1280, plus one 800-wide shot. Make a contact sheet of all 15 heroes (dark), view it, and iterate until each is genuinely lovely.
- Run `~/.venvs/patchright/bin/python tools/errors.py 386-400`. It must report 0 errors. It takes minutes, so use a long timeout or run it in the background.
- **Final report:** 1–2 lines per theme covering the fonts used (and any substitutions), the hero treatment, and the font payload in KB. Be honest about anything you didn't check.

## Update: revisions from the Claude design-skills research

Read `/private/tmp/claude-501/-Users-josh-repos-dot-com/4db80127-f1c9-44f6-9d98-8e927dbb8cb0/scratchpad/fonts/claude-design-skills.md`. It covers Anthropic's `frontend-design` skill, the Anthropic aesthetics cookbook, Impeccable's `typeset`/`craft-floor`, and the Show HN slop analysis.

### Repurposed slots

Three slots are repurposed. Their old specs duplicated, or relied on, flagged patterns:
- **#390** was Cormorant. That face is now covered three times by Josh's picks (#401, #402, #406), and unguided Claude defaults to it. It becomes **`ty-extremes`**: Anybody, at weight 200 against a heavy compact line, with a 3x+ size jump.
- **#391** was Playfair 2, which is on the watchlist. It becomes **`ty-literata`**: a single family across its axes.
- **#400** was a monospace code-display hero, which falls under "monospace as a costume for technical". It becomes **`ty-schibsted`**: Schibsted Grotesk with Source Serif 4.

If you already built the old versions, delete their files. Then build the new ones per the blurbs.

### Rules that now apply to every `ty-*` theme

These come from `frontend-design` v1.1.1, the Anthropic cookbook, and Impeccable.

- **No single-word accents.** Never italicize, bold, or color one word in the hero ("Josh", "serious", "TypeScript"). Contrast comes from the whole line: the headline versus the second line.
- **No tracked all-caps eyebrows or labels**, and no all-caps section labels. Keep section headings in sentence case. Small caps for meta are fine only where a family has true small caps (`font-variant-caps`), and use them sparingly.
- **Monospace only for real code or data,** never as decoration. Mono for graph captions is fine.
- **Real hierarchy.** The headline and second line differ in size (aim for at least 2.5x on desktop), and usually in weight or style too, not by weight alone.
- **Dark-surface compensation** (Impeccable). In dark mode, give light text slightly more line-height, a touch more tracking, and one step more weight than in light mode, especially for body text. Implement this under `html.dark`.
- **Display tracking.** Never tighter than -0.04em; around -0.01 to -0.03em is typical. `text-wrap: balance` on headings and `pretty` on body. Keep body measure at 45–75ch.
- **Loading.** Load only the weights and axes used. Provide metric-matched fallbacks (`size-adjust`, `ascent-override`, `descent-override`) for the hero font at least.
- **Process.** For each theme, write a 3–5 line token plan as a comment at the top of its CSS: families, scale, weights, tracking, and the reason this face fits this brief. Then do a screenshot-critique loop at 375 and 1440 widths, listing concrete deltas rather than "looks good".
- **#404 (Instrument)** stays because Josh explicitly liked #57's fonts. Set it with whole-line contrast and no italic accent. Note in your report that it's a watchlist font.

When you're done, include a short table in your report: theme, fonts, the hero size ratio, and the payload in KB.
