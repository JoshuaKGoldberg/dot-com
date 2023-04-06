import type { CollectionEntry } from "astro:content";

import styles from "./BlogEntry.module.css";

export interface BlogEntryProps {
  post: CollectionEntry<"blog">;
}

export function BlogEntry(props: BlogEntryProps) {
  return (
    <article class={styles.blogEntry}>
      {/* todo: i'd need to make a specific thumbnail per blog image */}
      {/* (should look into experimental assets features ) */}
      <div
        class={styles.imageArea}
        style={{
          "background-image": `url('/images/${props.post.data.image}')`,
        }}
      />
      <div>
        <a class={styles.title} href={`/blog/${props.post.slug}`}>
          {props.post.data.title}
        </a>
        <div class={styles.description}>{props.post.data.description}</div>
        <div class={styles.tidbits}>
          <div>
            {props.post.data.date.toString().split(" ").slice(1, 4).join(" ")}
          </div>
          <div>{props.post.data.minutesRead}</div>
        </div>
      </div>
    </article>
  );
}
