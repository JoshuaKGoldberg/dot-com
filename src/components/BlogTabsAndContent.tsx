import type { CollectionEntry } from "astro:content";

import { groupBy } from "../utils";
import { BlogEntryList } from "./BlogEntryList";
import TabsAndContent from "./TabsAndContent";

const defaultValue = "All";

export interface BlogTabsAndContentProps {
	posts: CollectionEntry<"blog">[];
}

export function BlogTabsAndContent(props: BlogTabsAndContentProps) {
	// eslint-disable-next-line solid/reactivity
	const grouped = groupBy(props.posts, (post) => post.data.category);

	return (
		<TabsAndContent
			defaultValue={defaultValue}
			sections={{
				[defaultValue]: <BlogEntryList posts={props.posts} />,
				...Object.fromEntries(
					Object.entries(grouped).map(([category, posts]) => [
						category,
						<BlogEntryList posts={posts} />,
					])
				),
			}}
		/>
	);
}
