import type { CollectionEntry } from "astro:content";
import { For } from "solid-js";

import { groupBy } from "../utils";
import { SpeakingEntry } from "./SpeakingEntry";
import styles from "./SpeakingEntryList.module.css";
import { SubHeading } from "./SubHeading";

export interface SpeakingEntryListProps {
	speakings: CollectionEntry<"speaking">[];
}

export function SpeakingEntryList(props: SpeakingEntryListProps) {
	return (
		<For
			each={Object.entries(
				groupBy(props.speakings, (speaking) => speaking.data.date.getFullYear())
			).sort(([a], [b]) => +b - +a)}
		>
			{([year, speakings]) => (
				<div>
					<SubHeading>{year}</SubHeading>

					<ul class={styles.list}>
						<For each={speakings}>
							{(speaking) => (
								<li class={styles.item}>
									<SpeakingEntry speaking={speaking} />
								</li>
							)}
						</For>
					</ul>
				</div>
			)}
		</For>
	);
}
