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
				fontSize="medium"
				fontWeight="light"
				id={props.category.toLowerCase().replaceAll(/\s+/g, "-")}
			>
				{props.category}
			</Text>
			<ul class={styles.entries}>{props.children}</ul>
		</>
	);
}
