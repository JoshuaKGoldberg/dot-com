import type { CollectionEntry } from "astro:content";

import { TabbedEntryCategories } from "../tabs/TabbedEntryCategories";
import { SpeakingsGrouped } from "./SpeakingsGrouped";

export interface SpeakingsTabbedProps {
	categories: Record<string, CollectionEntry<"speaking">[]>;
}

export function SpeakingsTabbed(props: SpeakingsTabbedProps) {
	return (
		<TabbedEntryCategories
			renderCategory={(speakings) => (
				<SpeakingsGrouped allSpeakings={speakings} />
			)}
			categories={props.categories}
			collection="speaking"
		/>
	);
}
