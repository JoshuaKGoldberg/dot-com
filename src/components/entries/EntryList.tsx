import type { JSX } from "solid-js";

import styles from "./EntryList.module.css";

export interface EntryListProps {
	children: JSX.Element;
}

export function EntryList(props: EntryListProps) {
	return <ul class={styles.entryList}>{props.children}</ul>;
}
