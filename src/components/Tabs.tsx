import { Tabs } from "@kobalte/core";
import { For } from "solid-js";

import styles from "./Tabs.module.css";
import { SquigglyIfActive } from "./SquigglyIfActive";

export interface Tab {
	info: string;
	title: string;
}

export interface TabsProps {
	currentValue: string;
	defaultValue: string;
	onValueChange: (value: string) => void;
	tabs: Tab[];
}

export default function (props: TabsProps) {
	return (
		<Tabs.Root
			class={styles.root}
			defaultValue={props.defaultValue}
			onValueChange={props.onValueChange}
		>
			<Tabs.List class={styles.list}>
				<For each={props.tabs}>
					{({ info, title }) => (
						<Tabs.Trigger value={title}>
							<SquigglyIfActive
								as="span"
								active={title === props.currentValue}
								align="left"
								info={info}
								title={title}
							/>
						</Tabs.Trigger>
					)}
				</For>
				<Tabs.Indicator />
			</Tabs.List>
		</Tabs.Root>
	);
}
