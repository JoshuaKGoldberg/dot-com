export function groupBy<T>(items: T[], getKey: (item: T) => string) {
	const grouped: Record<string, T[]> = {};

	for (const item of items) {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		(grouped[getKey(item)] ??= []).push(item);
	}

	return grouped;
}
