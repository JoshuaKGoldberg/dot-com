todo file

typescript export: export interface Props {}

when the page is no longer broken, put something to that effect in the terminal

## why so classname-y:

<header class="astro-3EF6KSR2">
  <span class="astro-3EF6KSR2">Joshypoo McSwaggins</span>
  <div class="astro-3EF6KSR2">
    <a class="link astro-3EF6KSR2" href="/blog">
          Blog
        </a><a class="link astro-3EF6KSR2" href="https://learningtypescript.com">
          Book
        </a><a class="link astro-3EF6KSR2" href="/projects">
          Projects
        </a>
  </div>
</header>
---

autofixer didn't auto-import <For />

not a fan of this error message
(thanks Elian for mentioning cause - content/blog is empty

```shell
$ pnpm astro sync

> joshuakgoldberg-dot-com-next@0.0.1 astro /Users/josh/repos/joshuakgoldberg-dot-com-next
> astro "sync"

11:16:08 AM [content] "blog" is not a collection. Check your content config for typos.
11:16:08 AM [content] Types generated 322ms
```

I thought this should work, rendering JSX for solid in .astro
but a bug for me to file is that the line number is offset (file is ~26 lines line)
3d71c6c..297fe38

```
 error   Expected ">" but found "posts"
  File:
    /Users/josh/repos/joshuakgoldberg-dot-com-next/src/pages/blog.astro:36:37
^C%
```
