# Wave 20: Typography II (#409–428), with a blog sample

Read `CONTRACT.md` first; it's binding. Use headless browsers only. Don't edit `themes/themes.js`, gallery files, or other agents' files. Your specs are the blurbs for #409–428 in `themes/themes.js`.

## Josh's request, verbatim

> favorites are: 386, 387, 392 (really like this), 396. do 20 more explorations that use that area/style/examples of fonts, and also add 3 example blog post paragraphs to the page so we can see how they look there. use those researched skillz on how to make things look good.

His favorites from wave 19 (`themes/ty-*`, helper in `themes/_type/`):

- **#386 `ty-newsreader`**: Newsreader.
- **#387 `ty-source-serif`**: Source Serif 4.
- **#392 `ty-redaction`**: Redaction. He *really* likes it. It's on Google Fonts as separate families: `Redaction`, `Redaction 10`, `20`, `35`, `50`, `70` and `100`, where higher numbers mean more pixel decay.
- **#396 `ty-hedvig`**: Hedvig Letters Serif and Sans.

Study those four first: their CSS token plans, hero treatments and screenshots. They set the bar and the direction.

## Base and implementation

- **Base theme.** Same as wave 19: every theme is **#385 `gd-bloom`** with the hero copy `Hello. I’m Josh.` and `I’m a serious TypeScript developer.`
- **Helper.** Reuse `themes/_type/with-type.js` by importing it, not editing it. If you need more, put a new helper in `themes/_type2/`.
- **Fonts.** All of them are free.
  - Everything except Zodiak and Erode is on Google Fonts (OFL), so load it from the css2 URLs.
  - Zodiak and Erode come from Fontshare under the ITF Free Font License: `https://api.fontshare.com/v2/css?f[]=zodiak@…`.
  - Commit Mono is OFL. Self-host it from its GitHub release or load it via jsDelivr or Fontsource.
  - Load only the weights and axes you use. Verify in headless Chrome that every font actually loads (`document.fonts`, and no fallback rendering).

### The blog sample (new, in every #409–428 theme)

Inject a sample blog-post excerpt into the page, after `.site-about` and before the first `.site-section`. Use semantic markup: `<article class="t2-post">` with an `<h2>` title, a meta line, and three `<p>` paragraphs. Use exactly this text:

- Title: **If I Wrote a Linter, Part 4: Summary**
- Meta: `June 10, 2025 · 5 minute read`
- ¶1: Over the last three posts I’ve sketched what a linter built today could look like: one that treats type information as a first-class input rather than an expensive add-on, runs rules in parallel by default, and reports problems in the same vocabulary developers already use in their editors.
- ¶2: None of these ideas are new on their own. What’s changed is that the pieces finally fit together: native-speed parsers, a TypeScript compiler being ported to Go, and a generation of developers who expect `--fix` to just work. The hard part isn’t writing a *faster* linter; it’s keeping one fast once real projects with real configs show up.
- ¶3: If you’ve ever silenced a lint rule because it was slow, noisy, or wrong, I’d love to hear about it. Those moments are the best signal we have for what a better tool should do, and they’re why [Flint](https://github.com/flint-fyi/flint) exists as a prototype instead of a manifesto.

Formatting:

- `--fix` is inline `<code>`.
- *faster* is `<em>`.
- Flint is a `.site-link`, so it gets the squiggle.
- Typeset it as a real reading experience:
  - body 17–19px;
  - measure 60–72ch;
  - line-height 1.55–1.75 for serif body;
  - real italics;
  - inline code in a mono that harmonizes with the serif, sized to match its x-height;
  - `text-wrap: pretty`;
  - `hanging-punctuation` where supported.
- It must look like a post on Josh's real blog, with no card or box around it.

## Rules (from the research; binding)

Read `/private/tmp/claude-501/-Users-josh-repos-dot-com/4db80127-f1c9-44f6-9d98-8e927dbb8cb0/scratchpad/fonts/claude-design-skills.md`, plus `ai-slop.md`, `latest.md` and `classic-personal.md` in the same folder. Apply these rules:

- **Token plan first.** Before building each theme, write a 3–5 line comment at the top of its CSS covering families, scale, weights, tracking, and why this face fits this site. Then check it against "the generic default you'd produce for any similar page" and revise it. That's the frontend-design skill's process.
- **No single-word accents** in the hero, whether italic, bold or color. Get contrast from whole lines.
- **No tracked all-caps eyebrows or labels.** Section headings stay in sentence case.
- **Monospace only for real code.** In this wave that's the `--fix` code in the blog post.
- **Real hierarchy.** The headline should be at least 2.5× the size of the second line on desktop, not separated by weight alone. Use a coherent modular scale across the hero, the post title, section titles, body, and meta.
- **Dark-surface compensation (Impeccable).** In dark mode, give light text slightly more line-height, a touch more tracking, and one step more weight, especially in the blog body. Implement it under `html.dark`.
- **Tracking.** Never tighter than -0.04em at display sizes. Body text is untracked.
- **Wrapping.** `text-wrap: balance` on headings, `pretty` on body.
- **Fallbacks.** Provide metric-matched fallbacks (`size-adjust`, `ascent-override`, `descent-override`) for the hero font and the body font.
- **Redaction.** Use its decay deliberately: cleaner at large sizes and more decayed at small sizes, or an intentional single level. Don't use heavy decay for body text.
- **#417's resolve/decay animation.** Do it by crossfading stacked copies of the headline set in different Redaction cuts, using opacity only. Keep the copies `aria-hidden`, except for one real heading. Respect reduced motion.
- **Process.** For each theme, run a screenshot-critique loop at 375 and 1440 widths, in dark and light, covering the hero and the blog sample. List concrete deltas rather than "looks good", and fix them.
- **Divergence.** These are explorations around one area, but each must be visibly distinct from the others in scale, weight, rhythm and pairing. They should not be near-duplicates.

## Process and report

- Put scratch files in `/private/tmp/claude-501/-Users-josh-repos-dot-com/4db80127-f1c9-44f6-9d98-8e927dbb8cb0/scratchpad/_type2/`.
- Make contact sheets (dark) of all 20: one of the heroes and one of the blog samples. View them and iterate.
- Run `~/.venvs/patchright/bin/python tools/errors.py 409-428`. It must report 0 errors. It takes minutes, so use a long timeout or run it in the background.
- Final report: a table with columns theme, fonts, source/licence, hero ratio, and font payload KB, plus 1 line per theme on its typographic idea. Be honest about what you didn't check.
