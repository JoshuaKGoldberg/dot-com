export function groupBy<T, K extends number | string>(
	items: T[],
	getKey: (item: T) => K,
) {
	const grouped = {} as Record<K, T[]>;

	for (const item of items) {
		(grouped[getKey(item)] ??= []).push(item);
	}

	return Object.fromEntries(
		Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)),
	) as typeof grouped;
}
