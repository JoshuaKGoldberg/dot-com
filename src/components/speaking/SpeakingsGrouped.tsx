import type { CollectionEntry } from "astro:content";

import { For } from "solid-js";

import { groupBy } from "~/utils";

import { CategorizedEntryList } from "../entries/CategorizedEntryList";
import { GroupedEntries } from "../entries/GroupedEntries";
import { SpeakingEntry } from "./SpeakingEntry";

export interface SpeakingsGroupedProps {
	allSpeakings: CollectionEntry<"speaking">[];
}

export function SpeakingsGrouped(props: SpeakingsGroupedProps) {
	const now = Date.now();

	const previous = () =>
		props.allSpeakings
			.filter((speaking) => +speaking.data.date < now)
			.sort((a, b) => +b.data.date - +a.data.date);

	const upcoming = () =>
		props.allSpeakings
			.filter((speaking) => +speaking.data.date > now)
			.sort((a, b) => +a.data.date - +b.data.date);

	return (
		<>
			{upcoming().length ? (
				<CategorizedEntryList category="Upcoming">
					<For each={upcoming()}>
						{(speaking) => <SpeakingEntry speaking={speaking} />}
					</For>
				</CategorizedEntryList>
			) : null}
			<GroupedEntries
				groups={Object.entries(
					groupBy(previous(), (speaking) => yearOrUpcoming(speaking.data.date)),
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
