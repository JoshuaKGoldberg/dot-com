# Wave 23: Squiggles (#454–478)

Read `CONTRACT.md` first; it is binding. Use headless browsers only. Don't edit `themes/themes.js`, gallery files, or other agents' files. Your specs are the blurbs for #454–478 in `themes/themes.js`.

## Josh's request, verbatim

> 452 is the current best. it's looking great. i love it. now, i think the last area of work is going to be the squigglies. compared to all the nice changes made around them, they look too thick, clumsy, obvious. make 25 variations of cool different squiggly effects that play better with the latest and greatest in the page (452)

## Base

Every theme is **#452 `rn-dark-tuned`** exactly. That means:
- its typography (Redaction hero, Hedvig Sans UI, light Newsreader reading);
- the `gd-bloom` scenery;
- the blog sample;
- the play/pause motion toggle and outline footer heart, which another agent is adding to #449–453 right now.

Wrap #452's `activate` and import its CSS, so you inherit those changes automatically. **Change only the link squiggles.**

### Where the squiggle comes from today

- `site.css` around line 108: `.site-link::after` is a mask of `assets/squiggle.svg`, sized in `em`.
- `themes/_vs4/squiggle.js` and `base.css`: the per-theme hover treatment, with star-dot crests and so on, drawn on a small canvas.

Your themes replace both the resting squiggle and the hover treatment with their own. Disable the inherited ones cleanly within your themes. Don't edit `_vs4` or `site.css`.

Squiggles appear in:
- the hero social links (Bluesky / GitHub / Mastodon);
- the about paragraphs (typescript-eslint, Learning TypeScript, Sentry);
- item titles in the Recent writing, Projects and Speaking lists;
- the blog sample's "Flint" link;
- the footer "view source" link.

Make each treatment work in all of these, and scale it sensibly for big item titles versus small inline links.

## Direction

The page is now refined: hairline graph edges, tiny dark-sky stars, light Newsreader body, and a quiet Redaction hero. The squiggles should feel like they belong to that world.

**Thin, delicate, and quietly delightful.** Josh's complaint is "too thick, clumsy, obvious". As a rule of thumb:
- resting stroke about 1–1.25px at body size, up to about 1.5px under large titles;
- lower amplitude than today;
- muted color by default.

Each blurb names a distinct idea. Make them genuinely different from each other.

## Rules

- **Accessibility (WCAG 1.4.1).** Links must stay distinguishable from body text without relying on color alone. A visible underline or mark at rest is the safe default. For #471 ("hover only"), links must have ≥3:1 contrast against the surrounding body text, plus a non-color cue on focus and hover. Measure it and report it.
- **Focus.** Keyboard focus shows the hover treatment too, plus a visible focus ring.
- **Motion.** Hover motion is driven by mouse movement only, never cycling on its own. It holds still when the mouse stops, eases back on leave, and respects reduced motion and the new play/pause toggle (paused means static).
- **Wrapped links.** Multi-line links (long item titles that wrap) must get a correct squiggle on each line. Prefer approaches that handle wrapping:
  - `text-decoration` with `wavy`;
  - `background-image` with `box-decoration-break: clone`;
  - a per-line canvas or SVG via `getClientRects`.

  Test with a narrow viewport where titles wrap.
- **Performance.**
  - Prefer pure CSS: `text-decoration-style: wavy`, `text-decoration-thickness`, `text-underline-offset`, `text-decoration-skip-ink`, SVG data-URI backgrounds, and `mask`.
  - When you need canvas or SVG for hover, create it on hover and remove it after.
  - Nothing runs at rest.
  - No layout shift on hover.
- **Light and dark.** Both must look refined. Light mode uses deep-ink versions.

## Process

- Put scratch files in `/private/tmp/claude-501/-Users-josh-repos-dot-com/4db80127-f1c9-44f6-9d98-8e927dbb8cb0/scratchpad/_sq/`. Put shared code in `themes/_sq/`.
- **Look at your work.** For each theme, take zoomed crops at device scale factor 2:
  - the about paragraph's links, an item title, a wrapped item title at 375 wide, and the footer link;
  - at rest and mid-hover;
  - in dark and light.

  Make a contact sheet of all 25 at rest (dark) and one mid-hover. Critique them against #452's current squiggle and the rest of the page, and iterate.
- Run `~/.venvs/patchright/bin/python tools/errors.py 454-478`. It must report 0 errors. It takes minutes, so use a long timeout or run it in the background.
- **Final report.** One line per theme: the technique, stroke and amplitude, how the hover works, and anything you didn't check.
