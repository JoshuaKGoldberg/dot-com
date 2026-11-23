import { getCurrent } from "~/utils";

const duration = 280;

/**
 * Changes which header link is current, as the page they're on does.
 *
 * Moving elements between pages cancels their transitions, and has them seem to not
 * be hovered. So links animate from exactly how they looked just before that.
 * @returns Starts animating, for once links are on the new page.
 */
export function keepLinkStyles() {
	const links = Array.from(
		document.querySelectorAll<HTMLElement>("[data-header-link]"),
		(link) => {
			const { color } = getComputedStyle(link);
			const { filter, maskPosition, opacity } = getComputedStyle(
				link,
				"::after",
			);

			return { color, filter, link, maskPosition, opacity };
		},
	);

	return () => {
		for (const { color, filter, link, maskPosition, opacity } of links) {
			const current = getCurrent(
				link.getAttribute("href") ?? "",
				location.pathname,
			);

			if (current) {
				link.setAttribute("aria-current", current);
			} else {
				link.removeAttribute("aria-current");
			}

			const squiggle = { duration, pseudoElement: "::after" };

			link.animate([{ color, offset: 0 }], duration);
			link.animate([{ filter, offset: 0, opacity }], squiggle);
			link.animate([{ maskPosition, offset: 0 }], {
				...squiggle,
				easing: "steps(12)",
			});
		}
	};
}
