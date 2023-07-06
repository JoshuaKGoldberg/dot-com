import type { CollectionEntry } from "astro:content";

import { ContentEntry } from "./ContentEntry";

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
			title={props.speaking.data.event}
			url={props.speaking.data.href}
			widths="third"
		/>
	);
}
