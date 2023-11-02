import { For, type JSX } from "solid-js";

import { EntryList } from "./EntryList";

export interface GroupedEntriesProps<Entry> {
	groups: [string, Entry[]][];
	renderEntry: (entry: Entry) => JSX.Element;
}

export function GroupedEntries<Entry>(props: GroupedEntriesProps<Entry>) {
	return (
		<For each={props.groups}>
			{([category, entries]) => (
				<EntryList category={category}>
					<For each={entries}>{(entry) => props.renderEntry(entry)}</For>
				</EntryList>
			)}
		</For>
	);
}
