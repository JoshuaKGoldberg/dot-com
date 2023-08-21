import type { CollectionEntry } from "astro:content";

import { ContentEntry } from "../ContentEntry";
import { DateAndMinutes } from "./DateAndMinutes";
import { createBlogTitle } from "./utils";

export interface BlogEntryProps {
	blog: CollectionEntry<"blog">;
}

export function BlogEntry(props: BlogEntryProps) {
	const url = () => `/blog/${props.blog.slug}`;

	return (
		<ContentEntry
			image={
				props.blog.data.image && {
					alt: props.blog.data.image.src,
					src: `/blog/${props.blog.data.image.src}`,
					variant: "round",
				}
			}
			subtitle={
				<DateAndMinutes body={props.blog.body} date={props.blog.data.pubDate} />
			}
			description={props.blog.data.description}
			title={createBlogTitle(props.blog)}
			url={url()}
			widths="full"
		/>
	);
}
