import type { CollectionEntry } from "astro:content";

import { Tabs } from "@kobalte/core";
import clsx from "clsx";
import { For, createSignal } from "solid-js";

import { Squiggly } from "../Squiggly";
import { SpeakingsGrouped } from "./SpeakingsGrouped";
import styles from "./SpeakingsTabbed.module.css";

export interface SpeakingsTabbedProps {
	categories: Record<string, CollectionEntry<"speaking">[]>;
}

export function SpeakingsTabbed(props: SpeakingsTabbedProps) {
	const [selected, setSelected] = createSignal("Podcasts");

	return (
		<Tabs.Root
			aria-label="Tabs of speaking categories"
			onChange={setSelected}
			value={selected()}
		>
			<Tabs.List class={styles.tabsList}>
				<For each={Object.keys(props.categories)}>
					{(category) => {
						const active = () => category === selected();
						return (
							<Tabs.Trigger
								as={Squiggly}
								class={clsx(styles.trigger, active() && styles.active)}
								value={category}
								// @ts-expect-error - variant prop isn't in Trigger's polymorphic type
								// https://github.com/kobaltedev/kobalte/issues/285
								variant={active() ? "passive" : "onHover"}
							>
								{category}
							</Tabs.Trigger>
						);
					}}
				</For>
				{/* TODO: messing up dev vs server, only on client ... */}
				<Tabs.Indicator style={{ position: "absolute" }} />
			</Tabs.List>

			<For each={Object.entries(props.categories)}>
				{([category, speakings]) => (
					<Tabs.Content value={category}>
						<SpeakingsGrouped allSpeakings={speakings} />
					</Tabs.Content>
				)}
			</For>
		</Tabs.Root>
	);
}
