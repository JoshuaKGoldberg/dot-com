import type { CollectionEntry } from "astro:content";
import { For } from "solid-js";

import { groupBy } from "../utils";
import { SpeakingEntry } from "./SpeakingEntry";
import styles from "./SpeakingEntryList.module.css";
import TabsAndContent from "./TabsAndContent";

export interface SpeakingEntryListProps {
	speakings: CollectionEntry<"speaking">[];
}

export function SpeakingEntryList(props: SpeakingEntryListProps) {
	return (
		<ul class={styles.list}>
			<For each={props.speakings}>
				{(speaking) => (
					<li class={styles.item}>
						<SpeakingEntry speaking={speaking} />
					</li>
				)}
			</For>
		</ul>
	);
}
