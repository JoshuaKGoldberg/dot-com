export function groupBy<T, K extends number | string>(
	items: T[],
	getKey: (item: T) => K,
) {
	const grouped = {} as Record<K, T[]>;

	for (const item of items) {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		(grouped[getKey(item)] ??= []).push(item);
	}

	return grouped;
}
