import type { CollectionEntry } from "astro:content";

import styles from "./BlogEntry.module.css";

export interface BlogEntryProps {
  post: CollectionEntry<"blog">;
}

export function BlogEntry(props: BlogEntryProps) {
  return (
    <article class={styles.blogEntry}>
      <img alt="" src={`/images/${props.post.data.image}`} />
      <div>
        <a href={`/blog/${props.post.slug}`}>{props.post.data.title}</a>
      </div>
    </article>
  );
}
