import type { CollectionEntry } from "astro:content";

import { ContentEntry } from "../ContentEntry";

export interface SpeakingEntryProps {
	speaking: CollectionEntry<"speaking">;
}

export function SpeakingEntry(props: SpeakingEntryProps) {
	return (
		<ContentEntry
			description={props.speaking.data.title}
			links={
				props.speaking.data.links && Object.entries(props.speaking.data.links)
			}
			subtitle={[
				props.speaking.data.date.toLocaleString("default", {
					month: "short",
					day: "numeric",
				}),
				props.speaking.data.location,
			]
				.filter(Boolean)
				.join(" - ")}
			title={props.speaking.data.event}
			url={props.speaking.data.href}
			widths="third"
		/>
	);
}
