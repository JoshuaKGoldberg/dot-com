import type { CollectionEntry } from "astro:content";

import { TabbedEntryCategories } from "../tabs/TabbedEntryCategories";
import { SpeakingsGrouped } from "./SpeakingsGrouped";

export interface SpeakingsTabbedProps {
	categories: Record<string, CollectionEntry<"speaking">[]>;
}

export function SpeakingsTabbed(props: SpeakingsTabbedProps) {
	return (
		<TabbedEntryCategories
			initialCategories={props.categories}
			collection="speaking"
			renderCategory={(speakings) => (
				<SpeakingsGrouped allSpeakings={speakings} />
			)}
		/>
	);
}
