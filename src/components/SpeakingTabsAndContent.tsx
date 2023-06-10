import type { CollectionEntry } from "astro:content";
import { createMemo } from "solid-js";

import { groupBy } from "../utils";
import { SpeakingEntryList } from "./SpeakingEntryList";
import TabsAndContent from "./TabsAndContent";

const defaultValue = "All";

export interface SpeakingTabsAndContentProps {
	speakings: CollectionEntry<"speaking">[];
}

export function SpeakingTabsAndContent(props: SpeakingTabsAndContentProps) {
	const grouped = createMemo(() =>
		groupBy(props.speakings, (speaking) => speaking.data.category)
	);

	return (
		<TabsAndContent
			defaultValue={defaultValue}
			sections={{
				[defaultValue]: <SpeakingEntryList speakings={props.speakings} />,
				...Object.fromEntries(
					Object.entries(grouped())
						.sort(([a], [b]) => a.localeCompare(b))
						.map(([category, speakings]) => [
							category,
							<SpeakingEntryList speakings={speakings} />,
						])
				),
			}}
		/>
	);
}
