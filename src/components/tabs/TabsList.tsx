import type { JSX } from "solid-js";

import { Tabs } from "@kobalte/core";

import styles from "./TabsList.module.css";

export interface TabsListProps {
	children: JSX.Element;
	label: string;
}

export function TabsList(props: TabsListProps) {
	return (
		<Tabs.List aria-label={props.label} class={styles.tabsList}>
			{props.children}
			<Tabs.Indicator class={styles.indicator} />
		</Tabs.List>
	);
}
