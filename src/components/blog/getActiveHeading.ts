/**
 * Finds the heading of the section currently being read: the last one scrolled
 * past a reading line a third of the way down the viewport. None is active at
 * the very top of the page.
 *
 * Over the last screen of scrolling, the reading line slides down to the bottom
 * of the viewport. Headings too close to the end of the page to ever reach the
 * reading line still become active in order, ending on the last one.
 */
export function getActiveHeading(headings: HTMLElement[]) {
	if (scrollY <= 0) {
		return undefined;
	}

	const scrollMax = document.documentElement.scrollHeight - innerHeight;
	const slideLength = Math.min(innerHeight, scrollMax);
	const slideProgress =
		slideLength > 0
			? Math.min(
					Math.max(scrollY - (scrollMax - slideLength), 0),
					slideLength,
				) / slideLength
			: 0;
	const readingLine = (innerHeight * (1 + 2 * slideProgress)) / 3;

	let active: HTMLElement | undefined;

	for (const heading of headings) {
		// Headings that aren't shown (e.g. in closed <details>) can't be being read
		if (!heading.checkVisibility()) {
			continue;
		}

		if (heading.getBoundingClientRect().top > readingLine) {
			break;
		}

		active = heading;
	}

	return active;
}

function decodeHash() {
	try {
		return decodeURIComponent(location.hash.slice(1));
	} catch {
		return undefined;
	}
}

/**
 * Finds the heading in the URL's hash, if the page is still where following a
 * link to it left it. That heading may be too close to the end of the page or
 * to a next heading to be active by position alone.
 */
export function getLinkedHeading(headings: HTMLElement[]) {
	const id = decodeHash();
	const linked = id && headings.find((heading) => heading.id === id);
	if (!linked || !linked.checkVisibility()) {
		return undefined;
	}

	const scrollPaddingTop =
		parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) ||
		0;
	const linkedScrollY = Math.max(
		Math.min(
			linked.getBoundingClientRect().top + scrollY - scrollPaddingTop,
			document.documentElement.scrollHeight - innerHeight,
		),
		0,
	);

	// Content shifting during a smooth scroll can leave it a pixel or two off
	return Math.abs(scrollY - linkedScrollY) < 4 ? linked : undefined;
}
