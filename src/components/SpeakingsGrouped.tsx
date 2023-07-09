import type { CollectionEntry } from "astro:content";

import { groupBy } from "../utils";
import { GroupedEntries } from "./GroupedEntries";
import { SpeakingEntry } from "./SpeakingEntry";

export interface SpeakingsGroupedProps {
	speakings: CollectionEntry<"speaking">[];
}

export function SpeakingsGrouped(props: SpeakingsGroupedProps) {
	return (
		<GroupedEntries
			groups={Object.entries(
				groupBy(
					props.speakings
						// TODO: when I add in tabs, then I'll add in non-talks
						.filter((speaking) => speaking.data.category === "Talks"),
					(speaking) => yearOrUpcoming(speaking.data.date)
				)
			).sort(([a], [b]) => (a === "Upcoming" ? -1 : +b - +a))}
			renderEntry={(speaking) => <SpeakingEntry speaking={speaking} />}
		/>
	);
}

const now = Date.now();

function yearOrUpcoming(date: Date) {
	return +date < now ? date.getFullYear() : "Upcoming";
}
