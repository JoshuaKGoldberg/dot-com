import { Tabs } from "@kobalte/core";
import { For, type JSX, createSignal } from "solid-js";

import { TabsList } from "../tabs/TabsList";
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
	const [selected, setSelected] = createSignal(
		Object.keys(props.initialCategories)[1],
	);

	return (
		<Tabs.Root
			aria-label={`Tabs of ${props.collection} categories`}
			onChange={setSelected}
			value={selected()}
		>
			<TabsList>
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
					<Tabs.Content value={category}>
						{props.renderCategory(entries)}
					</Tabs.Content>
				)}
			</For>
		</Tabs.Root>
	);
}
