// These use nothing from outside this file, not even its imports or variables,
// as the gallery also copies them into the page as-is to run before it's first painted.

/** Finds the photo that the page's #hash links to, if there is one. */
export function getLinkedPhoto() {
	let id;
	try {
		id = decodeURIComponent(location.hash.slice(1));
	} catch {
		return undefined;
	}

	const details = id
		? document.getElementById(id)?.querySelector(":scope > details")
		: undefined;

	return details instanceof HTMLDetailsElement &&
		details.closest("[data-photo-gallery]")
		? details
		: undefined;
}

/**
 * Browsers without grid-lanes get masonry from a grid of short rows instead,
 * with each photo spanning as many rows as it, and the gap after it, are tall.
 */
export function measure(gallery: HTMLElement) {
	if (CSS.supports("display", "grid-lanes")) {
		return;
	}

	// Short enough to look exact, but not so short as to need too many grid lines
	const rowHeight = 4;
	const gap = parseFloat(getComputedStyle(gallery).columnGap);
	const items = [...gallery.children] as HTMLElement[];

	// Reading every height before writing any lays the page out once, not per photo
	const heights = items.map(
		(item) => item.firstElementChild?.getBoundingClientRect().height ?? 0,
	);

	items.forEach((item, index) => {
		const rows = Math.ceil((heights[index] + gap) / rowHeight);
		item.style.setProperty("--rows", rows.toString());
	});

	gallery.dataset.masonry = "";
}

/**
 * Opens the photo that the page's #hash links to, if there is one,
 * having it load its larger size straight away rather than its smaller one first.
 */
export function openLinkedPhoto() {
	const details = getLinkedPhoto();
	if (!details) {
		return;
	}

	const image = details.querySelector("img[data-sizes-open]");
	if (image instanceof HTMLImageElement && image.dataset.sizesOpen) {
		image.fetchPriority = "high";
		image.loading = "eager";
		image.sizes = image.dataset.sizesOpen;
	}

	details.open = true;

	// Right away, rather than waiting for the browser to scroll there once it's loaded
	const gallery = details.closest("[data-photo-gallery]");
	if (gallery instanceof HTMLElement) {
		measure(gallery);
	}

	details.parentElement?.scrollIntoView({
		behavior: "instant",
		block: "start",
	});
}

/** Lays the gallery out, then shows it, as it's hidden until then so as not to jump around. */
export function prepareGallery(gallery: HTMLElement) {
	openLinkedPhoto();
	measure(gallery);
	gallery.dataset.prepared = "";
}
