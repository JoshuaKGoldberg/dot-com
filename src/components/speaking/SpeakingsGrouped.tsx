import type { CollectionEntry } from "astro:content";

import { For } from "solid-js";

import { groupBy } from "~/utils";

import { EntryList } from "../EntryList";
import { GroupedEntries } from "../GroupedEntries";
import { SpeakingEntry } from "./SpeakingEntry";

export interface SpeakingsGroupedProps {
	previous: CollectionEntry<"speaking">[];
	upcoming: CollectionEntry<"speaking">[];
}

export function SpeakingsGrouped(props: SpeakingsGroupedProps) {
	return (
		<>
			<EntryList category="Upcoming">
				<For each={props.upcoming}>
					{(speaking) => <SpeakingEntry speaking={speaking} />}
				</For>
			</EntryList>
			<GroupedEntries
				groups={Object.entries(
					groupBy(
						props.previous
							// TODO: when I add in tabs, then I'll add in non-talks
							.filter((speaking) => speaking.data.category === "Talks"),
						(speaking) => yearOrUpcoming(speaking.data.date)
					)
				).sort(([a], [b]) => (a === "Upcoming" ? -1 : +b - +a))}
				renderEntry={(speaking) => <SpeakingEntry speaking={speaking} />}
			/>
		</>
	);
}

const now = Date.now();

function yearOrUpcoming(date: Date) {
	return +date < now ? date.getFullYear() : "Upcoming";
}
