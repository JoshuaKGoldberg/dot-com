const selector = "header, hero-portrait, .hero-image, [data-layer=figure]";

/** Keeps anything out of view from sliding to or from where it's next in view. */
export function skipOffscreen() {
	for (const element of document.querySelectorAll<HTMLElement>(selector)) {
		const { bottom, top } = element.getBoundingClientRect();

		element.style.viewTransitionName =
			bottom > 0 && top < innerHeight ? "" : "none";
	}
}
