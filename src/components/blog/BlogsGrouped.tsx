import type { CollectionEntry } from "astro:content";

import { groupBy } from "~/utils";

import { GroupedEntries } from "../entries/GroupedEntries";
import { BlogEntry } from "./BlogEntry";

export interface BlogsGroupedProps {
	blogs: CollectionEntry<"blog">[];
}

export function BlogsGrouped(props: BlogsGroupedProps) {
	return (
		<GroupedEntries
			groups={Object.entries(
				groupBy(props.blogs, (blog) =>
					new Date(blog.data.pubDate).getFullYear(),
				),
			).sort(([a], [b]) => +b - +a)}
			renderEntry={(blog) => <BlogEntry blog={blog} />}
		/>
	);
}
