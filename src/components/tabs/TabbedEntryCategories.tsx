import { Tabs } from "@kobalte/core";
import { createSignal, For, type JSX } from "solid-js";

import { TabsList } from "../tabs/TabsList";
import styles from "./TabbedEntryCategories.module.css";
import { TabsSquiggly } from "./TabsSquiggly";
import { TabsTrigger } from "./TabsTrigger";

export interface TabbedEntryCategoriesProps<Entry> {
	collection: string;
	initialCategories: Record<string, Entry[]>;
	renderCategory: (entries: Entry[]) => JSX.Element;
}

export function TabbedEntryCategories<Entry>(
	props: TabbedEntryCategoriesProps<Entry>,
) {
	const initial = Object.keys(props.initialCategories)[1];
	const [hasChanged, setHasChanged] = createSignal(false);
	const [selected, setSelected] = createSignal(initial);

	return (
		<Tabs.Root
			onChange={(category) => {
				setHasChanged(true);
				setSelected(category);
			}}
			value={selected()}
		>
			<TabsList label={`Tabs of ${props.collection} categories`}>
				<For each={Object.keys(props.initialCategories)}>
					{(category) => (
						<TabsTrigger value={category}>
							<TabsSquiggly active={category === selected()}>
								{category}
							</TabsSquiggly>
						</TabsTrigger>
					)}
				</For>
			</TabsList>

			<For each={Object.entries(props.initialCategories)}>
				{([category, entries]) => (
					<Tabs.Content
						class={hasChanged() ? styles.changed : undefined}
						value={category}
					>
						{props.renderCategory(entries)}
					</Tabs.Content>
				)}
			</For>
		</Tabs.Root>
	);
}
