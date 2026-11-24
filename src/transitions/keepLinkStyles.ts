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
			const shift = squiggle.getPropertyValue("--shift");

			return { color, filter, link, opacity, rise, shift };
		},
	);

	return () => {
		const duration = readMilliseconds("--transitionMedium");
		const squiggle = {
			duration: readMilliseconds("--transitionSquiggle"),
			pseudoElement: "::after",
		};

		for (const { color, filter, link, opacity, rise, shift } of links) {
			const current = getAriaCurrent(link.getAttribute("href") ?? "", pathname);

			if (current) {
				link.setAttribute("aria-current", current);
			} else {
				link.removeAttribute("aria-current");
			}

			link.animate([{ color, offset: 0 }], duration);
			link.animate(
				[{ "--rise": rise, "--shift": shift, filter, offset: 0, opacity }],
				squiggle,
			);
		}
	};
}
