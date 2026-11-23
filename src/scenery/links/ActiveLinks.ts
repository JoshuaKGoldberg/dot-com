import { cacheLayout } from "../cacheLayout";
import { createFrameTask, type FrameTask } from "../frameLoop";
import { clamp, damp, moveToward } from "../math";
import { onPointer, pointer } from "../pointer";
import { onPause } from "../rootState";

interface Coloring {
	/** How close the pointer is, from 0 to 1. */
	nearness: number;

	/** Degrees from the link's usual hue. */
	shift: number;
}

interface MeasuredLink {
	bounds: DOMRect;
	link: HTMLElement;
}

/** Distance from the pointer, in pixels, within which links' colors react to it. */
const reach = 72;

/** Farthest that links' hues shift, in degrees, with the pointer at one of their ends. */
const maximumShift = 110;

/** Fastest that links' hues shift, in degrees per second. */
const maximumSpeed = 70;

/** Changes too small to be visible. */
const settled = { nearness: 0.005, shift: 0.2 };

/** Links and tabs for what's currently being shown. */
const selector =
	"[data-header-link][aria-current], [role=tab][aria-selected=true] > *";

/** Slowly shifts the colors of active links as the pointer moves around them. */
export class ActiveLinks {
	readonly #colorings = new Map<HTMLElement, Coloring>();
	readonly #measureLinks: () => MeasuredLink[];
	readonly #task: FrameTask;

	constructor(signal: AbortSignal) {
		this.#measureLinks = cacheLayout(measureLinks, signal);
		this.#task = createFrameTask((seconds) => this.#step(seconds), { signal });

		const clear = () => {
			for (const link of this.#colorings.keys()) {
				resetColor(link);
			}

			this.#colorings.clear();
		};

		onPause(clear, signal);
		onPointer(() => {
			if (this.#measureLinks().some(({ bounds }) => getNearness(bounds))) {
				this.#task.wake();
			}
		}, signal);
		signal.addEventListener("abort", clear);
	}

	#step(seconds: number) {
		const measured = this.#measureLinks();

		for (const { link } of measured) {
			if (!this.#colorings.has(link)) {
				this.#colorings.set(link, { nearness: 0, shift: 0 });
			}
		}

		for (const [link, coloring] of this.#colorings) {
			const bounds = measured.find((other) => other.link === link)?.bounds;
			const nearness = bounds ? getNearness(bounds) : 0;
			const shift = bounds ? getShift(bounds) * nearness : 0;

			coloring.nearness = damp(coloring.nearness, nearness, 3, seconds);
			coloring.shift = moveToward(
				coloring.shift,
				damp(coloring.shift, shift, 2.5, seconds),
				maximumSpeed * seconds,
			);

			if (
				!nearness &&
				coloring.nearness < settled.nearness &&
				Math.abs(coloring.shift) < settled.shift
			) {
				resetColor(link);
				this.#colorings.delete(link);
			} else {
				link.style.setProperty("--hueShift", coloring.shift.toFixed(1));
				link.style.setProperty("--nearness", coloring.nearness.toFixed(3));
			}
		}

		return this.#colorings.size > 0;
	}
}

/** How close the pointer is, from 0 to 1. */
function getNearness({ bottom, left, right, top }: DOMRect) {
	return pointer.isPresent
		? clamp(
				1 -
					Math.hypot(
						Math.max(left - pointer.x, 0, pointer.x - right),
						Math.max(top - pointer.y, 0, pointer.y - bottom),
					) /
						reach,
			)
		: 0;
}

/** Hue shift for which end of the link the pointer is toward, in degrees. */
function getShift({ left, right, width }: DOMRect) {
	const offset = (pointer.x - (left + right) / 2) / (width / 2);

	return clamp(offset, -1, 1) * maximumShift;
}

function measureLinks(): MeasuredLink[] {
	return Array.from(
		document.querySelectorAll<HTMLElement>(selector),
		(link) => ({ bounds: link.getBoundingClientRect(), link }),
	);
}

function resetColor(link: HTMLElement) {
	link.style.removeProperty("--hueShift");
	link.style.removeProperty("--nearness");
}
