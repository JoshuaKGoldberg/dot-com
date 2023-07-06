import type { CollectionEntry } from "astro:content";

import { ContentEntry } from "./ContentEntry";

export interface SpeakingEntryProps {
	speaking: CollectionEntry<"speaking">;
}

export function SpeakingEntry(props: SpeakingEntryProps) {
	return (
		<ContentEntry
			subtitle={props.speaking.data.event}
			links={
				props.speaking.data.links && Object.entries(props.speaking.data.links)
			}
			title={props.speaking.data.title}
			url={props.speaking.data.href}
			widths="third"
		/>
	);
}
