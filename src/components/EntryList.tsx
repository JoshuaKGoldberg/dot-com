import type { JSX } from "solid-js";

import styles from "./EntryList.module.css";
import { Text } from "./Text";

export interface EntryListProps {
	category: string;
	children: JSX.Element;
}

export function EntryList(props: EntryListProps) {
	return (
		<>
			<Text
				as="h2"
				class={styles.subHeading}
				fontWeight="light"
				fontSize="medium"
			>
				{props.category}
			</Text>
			<ul class={styles.entries}>{props.children}</ul>
		</>
	);
}
