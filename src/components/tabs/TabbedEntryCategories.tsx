import { Tabs } from "@kobalte/core";
import { For, type JSX, createSignal } from "solid-js";

import { TabsList } from "../tabs/TabsList";
import { TabsSquiggly } from "./TabsSquiggly";
import { TabsTrigger } from "./TabsTrigger";

export interface TabbedEntryCategoriesProps<Entry> {
	categories: Record<string, Entry[]>;
	collection: string;
	renderCategory: (entries: Entry[]) => JSX.Element;
}

export function TabbedEntryCategories<Entry>(
	props: TabbedEntryCategoriesProps<Entry>,
) {
	const [selected, setSelected] = createSignal(
		// Initial value set to the first category after "All"
		// eslint-disable-next-line solid/reactivity
		Object.keys(props.categories)[1],
	);

	return (
		<Tabs.Root
			aria-label={`Tabs of ${props.collection} categories`}
			onChange={setSelected}
			value={selected()}
		>
			<TabsList>
				<For each={Object.keys(props.categories)}>
					{(category) => (
						<TabsTrigger value={category}>
							<TabsSquiggly active={category === selected()}>
								{category}
							</TabsSquiggly>
						</TabsTrigger>
					)}
				</For>
			</TabsList>

			<For each={Object.entries(props.categories)}>
				{([category, entries]) => (
					<Tabs.Content value={category}>
						{props.renderCategory(entries)}
					</Tabs.Content>
				)}
			</For>
		</Tabs.Root>
	);
}
