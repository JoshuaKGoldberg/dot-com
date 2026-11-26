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
 * @returns Whether there was one.
 */
export function openLinkedPhoto(scroll: boolean) {
	const details = getLinkedPhoto();
	if (!details) {
		return false;
	}

	const image = details.querySelector("img[data-sizes-open]");
	// Sizes first, as making it eager starts it loading at whatever size it has then
	if (image instanceof HTMLImageElement && image.dataset.sizesOpen) {
		image.sizes = image.dataset.sizesOpen;
		image.fetchPriority = "high";
		image.loading = "eager";
	}

	details.open = true;

	const gallery = details.closest("[data-photo-gallery]");
	if (gallery instanceof HTMLElement) {
		measure(gallery);
	}

	if (scroll) {
		const item = details.parentElement;
		const scrollToItem = () => {
			item?.scrollIntoView({ behavior: "instant", block: "start" });
		};

		// Right away, rather than waiting for the browser to glide there once it's loaded
		scrollToItem();

		if (document.readyState === "loading") {
			// Again once the rest of the page is parsed, as it may not have been long enough to,
			// unless the visitor has already scrolled somewhere else themselves
			const scrolledTo = scrollY;
			document.addEventListener(
				"readystatechange",
				() => {
					if (Math.abs(scrollY - scrolledTo) < 2) {
						scrollToItem();
					}
				},
				{ once: true },
			);

			// The browser would otherwise also scroll there itself once loaded, even then,
			// so the address only links to whichever photo is open from that point on
			const gallery = details.closest("[data-photo-gallery]");
			if (gallery instanceof HTMLElement) {
				gallery.dataset.linksOnLoad = "";
				history.replaceState(
					history.state,
					"",
					location.href.replace(/#.*/, ""),
				);
				addEventListener(
					"load",
					() => {
						delete gallery.dataset.linksOnLoad;
						const open = gallery.querySelector(":scope > .item:has(> [open])");
						if (open) {
							history.replaceState(
								history.state,
								"",
								`${location.href.replace(/#.*/, "")}#${encodeURIComponent(open.id)}`,
							);
						}
					},
					{ once: true },
				);
			}
		}
	}

	return true;
}

/**
 * Whether this visit is going back, forward, or reloading,
 * which keep the scroll position they had rather than scrolling to any linked photo.
 */
export function isTraversing() {
	// Full loads, which the browser restores the scroll position of itself
	if (document.readyState === "loading") {
		const navigation = performance.getEntriesByType("navigation")[0] as
			PerformanceNavigationTiming | undefined;
		return navigation?.type === "back_forward" || navigation?.type === "reload";
	}

	// Pages the router swaps in, as the site's head remembers for scripts that load after it
	return (
		(globalThis as { routerNavigation?: { type?: string } }).routerNavigation
			?.type === "traverse"
	);
}

/** Lays the gallery out, then shows it, as it's hidden until then so as not to jump around. */
export function prepareGallery(
	gallery: HTMLElement,
	traversing = isTraversing(),
) {
	if (gallery.hasAttribute("data-prepared")) {
		return;
	}

	// Its photos start loading only from now on, once it can say which to load first
	gallery.dataset.preparing = "";

	// Whatever happens, it's shown, as no photo is worth hiding the rest
	try {
		layOutGallery(gallery, traversing);
	} finally {
		gallery.dataset.prepared = "";
	}
}

/** Opens any linked photo, then lays the gallery out around it. */
export function layOutGallery(gallery: HTMLElement, traversing: boolean) {
	// Without a linked photo to load first, the first few are the ones to see first
	if (!openLinkedPhoto(!traversing)) {
		for (const image of gallery.querySelectorAll("img[data-eager]")) {
			if (image instanceof HTMLImageElement) {
				image.loading = "eager";
			}
		}
	}

	measure(gallery);

	// The router restores the scroll position before the gallery is laid out, which can change its height
	if (traversing && document.readyState !== "loading") {
		const state = history.state as null | {
			scrollX?: number;
			scrollY?: number;
		};
		scrollTo({
			behavior: "instant",
			left: state?.scrollX ?? scrollX,
			top: state?.scrollY ?? scrollY,
		});
	}
}
