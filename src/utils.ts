export function groupBy<T, K extends number | string>(
	items: T[],
	getKey: (item: T) => K,
) {
	const grouped = {} as Record<K, T[]>;

	for (const item of items) {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		(grouped[getKey(item)] ??= []).push(item);
	}

	return Object.fromEntries(
		Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)),
	) as typeof grouped;
}

/** Whether a link is to the current page or, other than for the homepage, its section. */
export function isCurrentPath(href: string, pathname: string) {
	return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
