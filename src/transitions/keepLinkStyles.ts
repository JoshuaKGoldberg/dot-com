import { readMilliseconds } from "~/scenery/css";
import { getAriaCurrent } from "~/utils";

/**
 * Changes which header link is current, as the page they're on does.
 *
 * Moving elements between pages cancels their transitions, and has them seem to not
 * be hovered. So links animate from exactly how they looked just before that.
 * @returns Starts animating, for once links are on the new page.
 */
export function keepLinkStyles({ pathname }: URL) {
	const links = Array.from(
		document.querySelectorAll<HTMLAnchorElement>("[data-header-link]"),
		(link) => {
			const { color } = getComputedStyle(link);
			const squiggle = getComputedStyle(link, "::after");
			const { filter, opacity } = squiggle;
			const rise = squiggle.getPropertyValue("--rise");

			return { color, filter, link, opacity, rise };
		},
	);

	return () => {
		const duration = readMilliseconds("--transitionMedium");

		for (const { color, filter, link, opacity, rise } of links) {
			const current = getAriaCurrent(link.getAttribute("href") ?? "", pathname);

			if (current) {
				link.setAttribute("aria-current", current);
			} else {
				link.removeAttribute("aria-current");
			}

			const squiggle = { duration, pseudoElement: "::after" };

			link.animate([{ color, offset: 0 }], duration);
			link.animate([{ "--rise": rise, filter, offset: 0, opacity }], squiggle);
		}
	};
}
