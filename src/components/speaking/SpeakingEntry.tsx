import type { CollectionEntry } from "astro:content";

import { ContentEntry } from "../entries/ContentEntry";

export type SpeakingData = CollectionEntry<"speaking">["data"];

export interface SpeakingEntryProps {
	speaking: SpeakingData;
}

export function SpeakingEntry(props: SpeakingEntryProps) {
	return (
		<ContentEntry
			description={props.speaking.title}
			descriptionSize="small"
			links={props.speaking.links && Object.entries(props.speaking.links)}
			subtitle={[
				props.speaking.date.toLocaleString("en-US", {
					day: "numeric",
					month: "short",
					timeZone: "GMT",
				}),
				props.speaking.location,
			]
				.filter(Boolean)
				.join(" - ")}
			title={props.speaking.event}
			url={props.speaking.href}
			widths="third"
		/>
	);
}
