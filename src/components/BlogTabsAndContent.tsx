import type { CollectionEntry } from "astro:content";

import TabsAndContent from "./TabsAndContent";
import { BlogEntryList } from "./BlogEntryList";

const defaultValue = "All";

export interface BlogEntryListProps {
  posts: CollectionEntry<"blog">[];
}

export function BlogTabsAndContent(props: BlogEntryListProps) {
  const filter = (tag: string) =>
    props.posts.filter((post) => post.data.tags.includes(tag));

  return (
    <TabsAndContent
      defaultValue={defaultValue}
      sections={{
        [defaultValue]: <BlogEntryList posts={props.posts} />,
        Interpersonal: <BlogEntryList posts={filter("interpersonal")} />,
        Personal: <BlogEntryList posts={filter("personal")} />,
        Tech: <BlogEntryList posts={filter("tech")} />,
        "TypeScript Contribution Diary": (
          <BlogEntryList posts={filter("typescript contribution diary")} />
        ),
      }}
    />
  );
}
