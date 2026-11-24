import { groupBy } from "~/utils";

import type { SpeakingData } from "./SpeakingEntry";

import { TabbedEntryCategories } from "../tabs/TabbedEntryCategories";
import { SpeakingsGrouped } from "./SpeakingsGrouped";

export interface SpeakingsTabbedProps {
	now: number;
	speakings: SpeakingData[];
}

export function SpeakingsTabbed(props: SpeakingsTabbedProps) {
	const categories = () => ({
		All: props.speakings,
		...groupBy(props.speakings, (speaking) => speaking.category),
	});

	return (
		<TabbedEntryCategories
			collection="speaking"
			initialCategories={categories()}
			renderCategory={(speakings) => (
				<SpeakingsGrouped allSpeakings={speakings} now={props.now} />
			)}
		/>
	);
}
