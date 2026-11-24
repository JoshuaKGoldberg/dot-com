import { readMilliseconds } from "~/scenery/css";
import { getAriaCurrent } from "~/utils";

/**
 * Changes which header link is current, as the page they're on does.
 *
 * Moving elements between pages cancels their transitions, and has them seem to not
 * be hovered. So links transition from exactly how they looked just before that.
 * @returns Function that starts transitioning, to call once links are on the new page.
 */
export function keepLinkStyles({ pathname }: URL) {
	const links = Array.from(
		document.querySelectorAll<HTMLAnchorElement>("[data-header-link]"),
		(link) => {
			const { color } = getComputedStyle(link);
			const squiggle = getComputedStyle(link, "::after");
			const held = {
				"--heldFilter": squiggle.filter,
				"--heldOpacity": squiggle.opacity,
				// Safari doesn't round integers that are being transitioned
				"--heldRise": Math.round(
					Number(squiggle.getPropertyValue("--rise")),
				).toString(),
			};
			const traveled = getTravel(link)?.currentTime ?? null;

			return { color, held, link, traveled };
		},
	);

	return () => {
		const duration = readMilliseconds("--transitionMedium");

		for (const { color, held, link } of links) {
			const current = getAriaCurrent(link.getAttribute("href") ?? "", pathname);

			if (current) {
				link.setAttribute("aria-current", current);
			} else {
				link.removeAttribute("aria-current");
			}

			link.animate([{ color, offset: 0 }], duration);
			link.dataset.held = "";

			for (const [property, value] of Object.entries(held)) {
				link.style.setProperty(property, value);
			}
		}

		for (const { held, link, traveled } of links) {
			// Reading any style has it take effect, for what's next to transition from
			getComputedStyle(link, "::after").getPropertyValue("opacity");
			delete link.dataset.held;

			for (const property of Object.keys(held)) {
				link.style.removeProperty(property);
			}

			// Safari cancels transitions of it once the pages' transition is finished
			if (link.ariaCurrent) {
				link.animate([{ "--rise": held["--heldRise"], offset: 0 }], {
					duration: readMilliseconds("--transitionSquiggle"),
					pseudoElement: "::after",
				});
			}

			const travel = getTravel(link);
			if (travel && traveled !== null) {
				travel.currentTime = traveled;
			}
		}
	};
}

function getTravel(link: HTMLElement) {
	return link
		.getAnimations({ subtree: true })
		.find((animation) => animation instanceof CSSAnimation);
}
