import { For } from "solid-js";

import { groupBy } from "~/utils";

import { CategorizedEntryList } from "../entries/CategorizedEntryList";
import { GroupedEntries } from "../entries/GroupedEntries";
import { type SpeakingData, SpeakingEntry } from "./SpeakingEntry";

export interface SpeakingsGroupedProps {
	allSpeakings: SpeakingData[];
}

export function SpeakingsGrouped(props: SpeakingsGroupedProps) {
	const now = Date.now();

	const previous = () =>
		props.allSpeakings
			.filter((speaking) => +speaking.date < now)
			.sort((a, b) => +b.date - +a.date);

	const upcoming = () =>
		props.allSpeakings
			.filter((speaking) => +speaking.date > now)
			.sort((a, b) => +a.date - +b.date);

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
					groupBy(previous(), (speaking) => yearOrUpcoming(speaking.date)),
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
