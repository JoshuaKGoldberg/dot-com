import type { JSX } from "solid-js";

import { slugify } from "~/utils";

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
				font="display"
				fontSize="medium"
				id={slugify(props.category)}
				tone="strong"
			>
				{props.category}
			</Text>
			<EntryList>{props.children}</EntryList>
		</>
	);
}
