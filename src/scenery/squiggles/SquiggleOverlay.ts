import { cacheLayout } from "../cacheLayout";
import { createFrameTask, type FrameTask } from "../frameLoop";
import { clamp } from "../math";
import { onPageScroll, pageScroll } from "../pageScroll";
import { onPointer, pointer } from "../pointer";
import { onPause } from "../rootState";
import { type LinkLine, Squiggle } from "./Squiggle";

interface MeasuredLink {
	lines: LinkLine[];
	link: HTMLElement;
}

/** Distance from the pointer, in pixels, within which squiggles react to it. */
const reach = 96;

/** Links that have squiggles, other than those that show what's current. */
const selector =
	"[data-squiggle]:not([data-squiggle=current]), article a:not(:has(img))";

/**
 * Draws the squiggles of links that are near the pointer.
 * It's inside of the page's scrolling content, so squiggles stay with their links.
 */
export class SquiggleOverlay {
	readonly #host: HTMLElement;
	readonly #measureLinks: () => MeasuredLink[];
	#needsScan = false;
	readonly #squiggles = new Map<HTMLElement, Squiggle>();
	readonly #task: FrameTask;

	constructor(host: HTMLElement, signal: AbortSignal) {
		this.#host = host;
		this.#measureLinks = cacheLayout(measureLinks, signal);
		this.#task = createFrameTask((seconds) => this.#step(seconds), { signal });

		const clear = () => {
			this.#clear();
		};

		const scan = () => {
			this.#needsScan = true;
			this.#task.wake();
		};

		onPageScroll(scan, signal);
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

	#scan() {
		const { isPresent } = pointer;

		for (const { lines, link } of this.#measureLinks()) {
			const nearness = isPresent ? clamp(1 - getDistance(lines) / reach) : 0;
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

			if (!link.isConnected) {
				squiggle.target = 0;
			}

			squiggle.step(seconds, pointer.x);

			// Links that leave the page fade out, but ones scrolled away are just gone
			if (squiggle.isSettled || (link.isConnected && !lines)) {
				squiggle.remove();
				this.#squiggles.delete(link);
			} else {
				squiggle.paint(lines);
			}
		}

		return this.#squiggles.size > 0;
	}
}

function getDistance(lines: readonly LinkLine[]) {
	const pointerY = pointer.y + pageScroll.top;

	return Math.min(
		...lines.map(({ bottom, left, right, top }) =>
			Math.hypot(
				Math.max(left - pointer.x, 0, pointer.x - right),
				Math.max(top - pointerY, 0, pointerY - bottom),
			),
		),
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
