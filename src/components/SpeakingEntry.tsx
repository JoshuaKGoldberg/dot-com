import type { CollectionEntry } from "astro:content";
import { For } from "solid-js";

import styles from "./SpeakingEntry.module.css";
import { Text } from "./Text";

export interface SpeakingEntryProps {
	speaking: CollectionEntry<"speaking">;
}

export function SpeakingEntry(props: SpeakingEntryProps) {
	return (
		<Text as="article" class={styles.speakingEntry} fontWeight="medium">
			<Text as="div" fontWeight="bolder">
				{props.speaking.data.title}
			</Text>
			<div class={styles.event}>
				{props.speaking.data.event && props.speaking.data.event}
			</div>
			<div class={styles.links}>
				<For each={Object.entries(props.speaking.data.links)}>
					{([key, value]) => <a href={value}>{key}</a>}
				</For>
			</div>
		</Text>
	);
}
