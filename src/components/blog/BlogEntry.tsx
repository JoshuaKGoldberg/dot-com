import { ContentEntry } from "../entries/ContentEntry";
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
			description={props.blog.description}
			image={{ ...props.blog.image, variant: "round" }}
			subtitle={
				<DateAndMinutes date={props.blog.date} minutes={props.blog.minutes} />
			}
			title={props.blog.title}
			url={`/blog/${props.blog.id}`}
			widths="full"
		/>
	);
}
