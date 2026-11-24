import { For } from "solid-js";

import { groupBy } from "~/utils";

import { CategorizedEntryList } from "../entries/CategorizedEntryList";
import { GroupedEntries } from "../entries/GroupedEntries";
import { type SpeakingData, SpeakingEntry } from "./SpeakingEntry";

export interface SpeakingsGroupedProps {
	allSpeakings: SpeakingData[];

	/** From when the page was built, so that hydrating renders the same entries. */
	now: number;
}

export function SpeakingsGrouped(props: SpeakingsGroupedProps) {
	const previous = () =>
		props.allSpeakings
			.filter((speaking) => +speaking.date < props.now)
			.sort((a, b) => +b.date - +a.date);

	const upcoming = () =>
		props.allSpeakings
			.filter((speaking) => +speaking.date >= props.now)
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
					groupBy(previous(), (speaking) => speaking.date.getUTCFullYear()),
				).sort(([a], [b]) => +b - +a)}
				renderEntry={(speaking) => <SpeakingEntry speaking={speaking} />}
			/>
		</>
	);
}
