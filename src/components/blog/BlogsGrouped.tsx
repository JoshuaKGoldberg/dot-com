import { groupBy } from "~/utils";

import { GroupedEntries } from "../entries/GroupedEntries";
import { BlogEntry, type BlogEntryData } from "./BlogEntry";

export interface BlogsGroupedProps {
	blogs: BlogEntryData[];
}

export function BlogsGrouped(props: BlogsGroupedProps) {
	return (
		<GroupedEntries
			groups={Object.entries(
				groupBy(props.blogs, (blog) => blog.date.getUTCFullYear()),
			).sort(([a], [b]) => +b - +a)}
			renderEntry={(blog) => <BlogEntry blog={blog} />}
		/>
	);
}
