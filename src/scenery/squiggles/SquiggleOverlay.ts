import { cacheLayout } from "../cacheLayout";
import { createFrameTask } from "../frameLoop";
import { getDistance } from "../geometry";
import { clamp } from "../math";
import { onPageScroll, pageScroll } from "../pageScroll";
import { onPointer, pointer } from "../pointer";
import { onPause } from "../rootState";
import { type LinkLine, Squiggle } from "./Squiggle";

interface MeasuredLink {
	lines: LinkLine[];
	link: HTMLElement;
}

const forcedColors = matchMedia("(forced-colors: active)");

const reach = 96;

/** Links that have squiggles, other than those that show what's current. */
const selector =
	"[data-squiggle]:not([data-squiggle=current]), article a:not(:has(img))";

/** It's inside of the page's scrolling content, so squiggles stay with their links. */
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

		for (const { lines, link } of this.#measureLinks()) {
			const nearness = isPresent ? clamp(1 - getNearest(lines) / reach) : 0;
			let squiggle = this.#squiggles.get(link);

			if (!squiggle && nearness) {
				squiggle = new Squiggle(link, this.#host);
				this.#squiggles.set(link, squiggle);
			}

			if (squiggle) {
				squiggle.target = nearness;
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

function getNearest(lines: readonly LinkLine[]) {
	const { x, y } = pointer;

	return Math.min(
		...lines.map((line) => getDistance({ x, y: y + pageScroll.top }, line)),
	);
}

/** Finds each line of each link that's on screen, or almost, in the page's coordinates. */
function measureLinks(): MeasuredLink[] {
	const scroll = pageScroll.top;

	return Array.from(
		document.querySelectorAll<HTMLElement>(selector),
		(link) => ({
			lines: Array.from(link.getClientRects())
				.filter(
					({ bottom, top, width }) =>
						width > 1 && bottom > -reach && top < innerHeight + reach,
				)
				.map(({ bottom, left, right, top }) => ({
					bottom: bottom + scroll,
					left,
					right,
					top: top + scroll,
				})),
			link,
		}),
	).filter(
		({ lines, link }) =>
			// Contents of closed details still have positions, despite not being visible
			lines.length && link.checkVisibility({ visibilityProperty: true }),
	);
}
