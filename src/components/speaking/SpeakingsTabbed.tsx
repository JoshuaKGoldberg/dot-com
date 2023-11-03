import type { CollectionEntry } from "astro:content";

import { Tabs } from "@kobalte/core";
import clsx from "clsx";
import { For, createSignal } from "solid-js";

import { groupBy } from "~/utils";

import { Squiggly } from "../Squiggly";
import { SpeakingsGrouped } from "./SpeakingsGrouped";
import styles from "./SpeakingsTabbed.module.css";

export interface SpeakingsTabbedProps {
	allSpeakings: CollectionEntry<"speaking">[];
}

export function SpeakingsTabbed(props: SpeakingsTabbedProps) {
	const categories = () => ({
		All: props.allSpeakings,
		...groupBy(props.allSpeakings, (speaking) => speaking.data.category),
	});

	const [selected, setSelected] = createSignal("Talks");

	return (
		<Tabs.Root
			aria-label="Tabs of speaking categories"
			onChange={setSelected}
			value={selected()}
		>
			<Tabs.List class={styles.tabsList}>
				<For each={Object.keys(categories())}>
					{(category) => {
						const active = () => category === selected();
						return (
							<Tabs.Trigger
								as={Squiggly}
								class={clsx(styles.trigger, active() && styles.active)}
								value={category}
								// TODO: fade-out animation is borked?
								// @ts-expect-error - variant prop isn't in Trigger's polymorphic type?
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

			<For each={Object.entries(categories())}>
				{([category, speakings]) => (
					<Tabs.Content value={category}>
						<SpeakingsGrouped allSpeakings={speakings} />
					</Tabs.Content>
				)}
			</For>
		</Tabs.Root>
	);
}
