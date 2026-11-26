# astro-check-links

An [Astro integration](https://docs.astro.build/en/guides/integrations-guide) that checks links in your built site point to pages, files, and heading anchors that exist in it.

After each `astro build`, it reports links that would 404 or scroll to nothing:

- Links to pages and files, from `<a>`, `<img>` and `srcset`, `<link>`, `<script>`, `<source>`, `<video>`, and other elements
- Heading anchors, such as `/blog/my-post#some-heading` and `#some-heading`
- `url()`s and `@import`s in stylesheets, `<style>` elements, and `style` attributes
- Absolute links to your own site, using Astro's [`site`](https://docs.astro.build/en/reference/configuration-reference/#site)
- Links on every built page, including pages nothing links to

It serves your build from a local server, much like a static host would, so it needs no network connection.
Paths have to match files' case exactly, as they do on most hosts.
Links to other sites aren't checked.
Broken absolute links to your own site are reported by their path.

```plaintext
[astro-check-links] Found 2 broken link(s).

  On:   /blog/my-post/
  Link: /blog/other-post#no-such-heading
  Text: an outdated heading
  Why:  Fragment identifier '#no-such-heading' not found on page

  On:   /blog/my-post/
  Link: /images/no-such-image.png
  Why:  HTTP 404
```

## Usage

Add `checkLinks()` to your Astro config's `integrations`, after any integrations that change built pages:

```ts
import { defineConfig } from "astro/config";

import { checkLinks } from "astro-check-links";

export default defineConfig({
	integrations: [checkLinks()],
	site: "https://www.example.com",
});
```

`astro-check-links` respects your Astro config's [`base`](https://docs.astro.build/en/reference/configuration-reference/#base), so links that leave it are reported as broken.
Links to pages may leave out `.html`, as many hosts serve `/about.html` for `/about`, so it works with any [`build.format`](https://docs.astro.build/en/reference/configuration-reference/#buildformat).

It only knows about files in the build, not your host's own rules, such as `_redirects` files.
If a server adds other files or routes, such as [on-demand rendered pages](https://docs.astro.build/en/guides/on-demand-rendering) and endpoints, add them to [`ignore`](#ignore).

A few links aren't checked:

- Fragments with a [text directive](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment/Text_fragments), like `#:~:text=hello`, as they match text rather than only ids
- Heading anchors on pages whose HTML contains both `content="noindex` and `nofollow`, which [linkinator](https://github.com/JustinBeckwith/linkinator) treats as "not found" pages

`astro-check-links` requires Node.js 22 or newer.

## Options

### `aliases`

Other origins your site is served from, whose absolute links should be checked like links to `site`.
Defaults to `[]`.

```ts
checkLinks({
	aliases: ["https://example.com"],
});
```

### `failOnBrokenLinks`

Whether broken links fail the build.
When `false`, they're logged as a warning instead.
Defaults to `true`.

You might only want broken links to fail the build in CI, so they don't block deploys:

```ts
checkLinks({
	failOnBrokenLinks: !!process.env.GITHUB_ACTIONS,
});
```

### `ignore`

Links not to check, such as to files served by something other than the build.
Defaults to `[]`.

Strings match the start of a link's path, including any `base`, and regular expressions are tested against the path.
Paths are tested both as written and decoded, so `"/my files/"` and `"/my%20files/"` both match `/my%20files/notes.pdf`.
Links on pages under ignored paths aren't checked either.

```ts
checkLinks({
	ignore: ["/downloads/", /\.pdf$/],
});
```
