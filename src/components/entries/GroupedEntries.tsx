import { For, type JSX } from "solid-js";

import { CategorizedEntryList } from "./CategorizedEntryList";

export interface GroupedEntriesProps<Entry> {
	groups: [string, Entry[]][];
	renderEntry: (entry: Entry) => JSX.Element;
}

export function GroupedEntries<Entry>(props: GroupedEntriesProps<Entry>) {
	return (
		<For each={props.groups}>
			{([category, entries]) => (
				<CategorizedEntryList category={category}>
					<For each={entries}>{(entry) => props.renderEntry(entry)}</For>
				</CategorizedEntryList>
			)}
		</For>
	);
}
