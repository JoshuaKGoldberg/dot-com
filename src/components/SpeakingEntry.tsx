import type { CollectionEntry } from "astro:content";
import { For } from "solid-js";

import { Anchor } from "./Anchor";
import styles from "./SpeakingEntry.module.css";
import { Text } from "./Text";

export interface SpeakingEntryProps {
	speaking: CollectionEntry<"speaking">;
}

export function SpeakingEntry(props: SpeakingEntryProps) {
	return (
		<Text as="article" class={styles.speakingEntry} fontWeight="medium">
			<Text
				as="a"
				fontSize="medium"
				fontWeight="bold"
				href={props.speaking.data.href}
			>
				{props.speaking.data.title}
			</Text>
			<div class={styles.event}>
				{props.speaking.data.event && props.speaking.data.event}
			</div>
			{props.speaking.data.links && (
				<div class={styles.links}>
					<For each={Object.entries(props.speaking.data.links)}>
						{([key, value]) => <Anchor href={value}>{key}</Anchor>}
					</For>
				</div>
			)}
		</Text>
	);
}
