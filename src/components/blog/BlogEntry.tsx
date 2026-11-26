import { ContentEntry } from "../entries/ContentEntry";
import { InlineMarkdown } from "../InlineMarkdown";
import { DateAndMinutes } from "./DateAndMinutes";

export interface BlogEntryData {
	date: Date;
	description: string;
	id: string;
	image: { alt: string; src: string };
	minutes: number;
	title: string;
}

export interface BlogEntryProps {
	blog: BlogEntryData;
}

export function BlogEntry(props: BlogEntryProps) {
	return (
		<ContentEntry
			description={<InlineMarkdown text={props.blog.description} />}
			image={{ ...props.blog.image, variant: "round" }}
			subtitle={
				<DateAndMinutes date={props.blog.date} minutes={props.blog.minutes} />
			}
			title={<InlineMarkdown insideLink text={props.blog.title} />}
			url={`/blog/${props.blog.id}`}
			widths="full"
		/>
	);
}
