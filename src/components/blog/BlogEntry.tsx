import type { CollectionEntry } from "astro:content";

import { ContentEntry } from "../ContentEntry";
import { DateAndMinutes } from "./DateAndMinutes";

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
			title={props.blog.data.title
				// TODO: use a markdown renderer
				.replaceAll("`", "")}
			description={props.blog.data.description}
			url={url()}
			widths="full"
		/>
	);
}
