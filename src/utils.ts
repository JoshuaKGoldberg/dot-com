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

/** The aria-current of a link: whether it's to the current page, or to its section. */
export function getCurrent(href: string, pathname: string) {
	const path = pathname.replace(/(?<=.)\/$/, "");

	if (path === href) {
		return "page";
	}

	return href !== "/" && path.startsWith(`${href}/`) ? "true" : undefined;
}
