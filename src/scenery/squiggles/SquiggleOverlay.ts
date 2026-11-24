import { cacheLayout } from "../cacheLayout";
import { createFrameTask } from "../frameLoop";
import { getDistance, type Rectangle } from "../geometry";
import { clamp } from "../math";
import { onPageScroll, pageScroll } from "../pageScroll";
import { onPointer, pointer } from "../pointer";
import { onPause } from "../rootState";
import { measureLines } from "./measureLines";
import { type LinkLine, Squiggle } from "./Squiggle";

interface MeasuredLink {
	/** What's hovered, which can extend past the ends of lines. */
	boxes: Rectangle[];
	lines: LinkLine[];
	link: HTMLElement;
}

const forcedColors = matchMedia("(forced-colors: active)");

const reach = 96;

/** Links that have squiggles, other than those that show what's current. */
const selector =
	"[data-squiggle]:not([data-squiggle=current]), article a:not(:has(img))";

/** Squiggles are inside of the page's scrolling content, so they stay with their links. */
export class SquiggleOverlay {
	readonly #host: HTMLElement;
	readonly #measureLinks: () => MeasuredLink[];
	#needsScan = false;
	readonly #squiggles = new Map<HTMLElement, Squiggle>();
	readonly #wake: () => void;

	constructor(host: HTMLElement, signal: AbortSignal) {
		this.#host = host;
		this.#measureLinks = cacheLayout(measureLinks, signal);
		this.#wake = createFrameTask((seconds) => this.#step(seconds), { signal });

		const clear = () => {
			this.#clear();
		};

		const scan = () => {
			this.#needsScan = true;
			this.#wake();
		};

		document.addEventListener(
			"astro:before-swap",
			() => {
				this.#leave();
			},
			{ signal },
		);
		addEventListener("resize", markWrapped, { signal });
		document.addEventListener("focusin", markWrapped, { signal });
		// Taps only start hovering links after their pointerover
		document.addEventListener("mouseover", markWrapped, { signal });
		void document.fonts.ready.then(markWrapped);
		document.addEventListener("focusin", scan, { signal });
		document.addEventListener("focusout", scan, { signal });
		onPageScroll(() => {
			if (pointer.isPresent || this.#squiggles.size) {
				scan();
			}
		}, signal);
		onPause(clear, signal);
		onPointer(scan, signal);
		signal.addEventListener("abort", clear);
	}

	#clear() {
		for (const squiggle of this.#squiggles.values()) {
			squiggle.remove();
		}

		this.#squiggles.clear();
	}

	#leave() {
		const squiggles = [...this.#squiggles.values()];
		const top = pageScroll.top;

		for (const squiggle of squiggles) {
			squiggle.freeze();
		}

		this.#squiggles.clear();

		document.addEventListener(
			"astro:after-swap",
			() => {
				for (const squiggle of squiggles) {
					squiggle.leave(pageScroll.top - top);
				}
			},
			{ once: true },
		);
	}

	#scan() {
		// Links keep their own underlines then, as these aren't shown
		const isPresent = pointer.isPresent && !forcedColors.matches;

		for (const { boxes, link } of this.#measureLinks()) {
			const nearness = isPresent ? clamp(1 - getNearest(boxes) / reach) : 0;
			let squiggle = this.#squiggles.get(link);

			if (!squiggle && nearness) {
				squiggle = new Squiggle(link, this.#host);
				this.#squiggles.set(link, squiggle);
			}

			if (squiggle) {
				squiggle.isNear = nearness > 0;
				squiggle.target = link.matches(":focus-visible") ? 1 : nearness;
			}
		}
	}

	#step(seconds: number) {
		if (this.#needsScan || !pointer.isPresent) {
			this.#needsScan = false;
			this.#scan();
		}

		const measured = this.#measureLinks();

		for (const [link, squiggle] of this.#squiggles) {
			const lines = measured.find((other) => other.link === link)?.lines;

			squiggle.step(seconds, pointer.x);

			if (squiggle.isSettled || !lines) {
				squiggle.remove();
				this.#squiggles.delete(link);
			} else {
				squiggle.paint(lines);
			}
		}

		return this.#squiggles.size > 0;
	}
}

function getNearest(boxes: readonly Rectangle[]) {
	const { x, y } = pointer;

	return Math.min(
		...boxes.map((box) => getDistance({ x, y: y + pageScroll.top }, box)),
	);
}

/** Static squiggles can't follow lines themselves, so links that have one are marked. */
function markWrapped() {
	for (const link of document.querySelectorAll<HTMLElement>(
		"[data-squiggle=onHover]:is(:focus, :hover)",
	)) {
		link.toggleAttribute("data-wrapped", measureLines(link).length > 1);
	}
}

/** Finds each line of each link that's on screen, or almost, in the page's coordinates. */
function measureLinks(): MeasuredLink[] {
	const scroll = pageScroll.top;
	const isOnScreen = ({ bottom, left, right, top }: Rectangle) =>
		right - left > 1 && bottom > -reach && top < innerHeight + reach;
	const toPage = ({ bottom, left, right, top }: Rectangle) => ({
		bottom: bottom + scroll,
		left,
		right,
		top: top + scroll,
	});

	return Array.from(
		document.querySelectorAll<HTMLElement>(selector),
		(link) => {
			const boxes = Array.from(link.getClientRects()).filter(isOnScreen);

			return {
				boxes: boxes.map(toPage),
				lines: boxes.length
					? measureLines(link).filter(isOnScreen).map(toPage)
					: [],
				link,
			};
		},
	).filter(
		({ boxes, link }) =>
			// Contents of closed details still have positions, despite not being visible
			boxes.length && link.checkVisibility({ visibilityProperty: true }),
	);
}
