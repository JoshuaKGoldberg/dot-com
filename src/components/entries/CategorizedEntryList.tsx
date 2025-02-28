import type { JSX } from "solid-js";

import { Text } from "../Text";
import styles from "./CategorizedEntryList.module.css";
import { EntryList } from "./EntryList";

export interface EntryListProps {
	category: string;
	children: JSX.Element;
}

export function CategorizedEntryList(props: EntryListProps) {
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
			<EntryList>{props.children}</EntryList>
		</>
	);
}
