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
			description={props.blog.data.description}
			image={{
				src: `/blog/${props.blog.data.image.src}`,
				variant: "round",
			}}
			subtitle={
				<DateAndMinutes body={props.blog.body} date={props.blog.data.date} />
			}
			title={props.blog.data.title}
			url={url()}
			widths="full"
		/>
	);
}
