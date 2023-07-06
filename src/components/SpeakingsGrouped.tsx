import type { CollectionEntry } from "astro:content";
import { For } from "solid-js";

import { groupBy } from "../utils";
import { EntryList } from "./EntryList";
import { SpeakingEntry } from "./SpeakingEntry";

export interface SpeakingsGroupedProps {
	speakings: CollectionEntry<"speaking">[];
}

export function SpeakingsGrouped(props: SpeakingsGroupedProps) {
	return (
		<For
			each={Object.entries(
				groupBy(
					props.speakings
						// TODO: when I add in tabs, then I'll add in non-talks
						.filter((speaking) => speaking.data.category === "Talks"),
					(speaking) => yearOrUpcoming(speaking.data.date)
				)
			).sort(([a], [b]) => (a === "Upcoming" ? -1 : +b - +a))}
		>
			{([year, speakings]) => (
				<EntryList category={year}>
					<For each={speakings}>
						{(speaking) => <SpeakingEntry speaking={speaking} />}
					</For>
				</EntryList>
			)}
		</For>
	);
}

const now = Date.now();

function yearOrUpcoming(date: Date) {
	return +date < now ? date.getFullYear() : "Upcoming";
}
