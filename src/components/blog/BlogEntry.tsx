import type { CollectionEntry } from "astro:content";

import { ContentEntry } from "../entries/ContentEntry";
import { DateAndMinutes } from "./DateAndMinutes";

export interface BlogEntryProps {
	blog: CollectionEntry<"blog">;
}

export function BlogEntry(props: BlogEntryProps) {
	const url = () => `/blog/${props.blog.slug}`;

	return (
		<ContentEntry
			description={props.blog.data.description}
			image={{
				alt: props.blog.data.image.alt,
				src: props.blog.data.image.src.src,
				variant: "round",
			}}
			subtitle={
				<DateAndMinutes body={props.blog.body} date={props.blog.data.pubDate} />
			}
			title={props.blog.data.title
				// TODO: use a markdown renderer
				.replaceAll("`", "")}
			url={url()}
			widths="full"
		/>
	);
}
