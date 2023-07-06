import { clsx } from "clsx";
import type { JSX } from "solid-js";

import styles from "./EntryList.module.css";
import { SubHeading } from "./SubHeading";

export interface EntryListProps {
	category: string;
	children: JSX.Element;
	class?: string | undefined;
}

export function EntryList(props: EntryListProps) {
	return (
		<div class={clsx(styles.entryList, props.class)}>
			<SubHeading>{props.category}</SubHeading>
			<ul class={styles.entries}>{props.children}</ul>
		</div>
	);
}
