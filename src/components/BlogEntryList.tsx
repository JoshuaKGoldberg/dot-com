import { For } from "solid-js";
import type { CollectionEntry } from "astro:content";

import { BlogEntry } from "./BlogEntry";
import styles from "./BlogEntryList.module.css";

export interface BlogEntryListProps {
  posts: CollectionEntry<"blog">[];
}

export function BlogEntryList(props: BlogEntryListProps) {
  return (
    <ul class={styles.list}>
      <For each={props.posts}>
        {(post) => (
          <li class={styles.item}>
            <BlogEntry post={post} />
          </li>
        )}
      </For>
    </ul>
  );
}
