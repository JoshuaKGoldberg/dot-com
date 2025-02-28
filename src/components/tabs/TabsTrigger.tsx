import type { JSX } from "solid-js";

import { Tabs } from "@kobalte/core";

import styles from "./TabsTrigger.module.css";

export interface TabsTriggerProps {
	children: JSX.Element;
	value: string;
}

export function TabsTrigger(props: TabsTriggerProps) {
	return (
		<Tabs.Trigger class={styles.trigger} value={props.value}>
			{props.children}
		</Tabs.Trigger>
	);
}
