import { cacheLayout } from "../cacheLayout";
import { px, readMilliseconds } from "../css";
import { followLight } from "../followLight";
import { createFrameTask } from "../frameLoop";
import { getDistance } from "../geometry";
import { headerDwell } from "../headerDwell";
import { clamp, damp, moveToward } from "../math";
import { onPointer, pointer } from "../pointer";
import { onPause } from "../rootState";

interface Coloring {
	nearness: number;

	/** Degrees from the link's usual hue. */
	shift: number;
	x: number;
}

interface MeasuredLink {
	bounds: DOMRect;
	link: HTMLElement;
	reach: number;
}

/** Links for what's currently being shown react before they're hovered. */
const currentReach = 72;
const otherReach = 1;

const maximumShift = 110;
const maximumShiftPerSecond = 140;

/** At either end of a link, before it's limited to the maximum. */
const shiftAtEnds = 220;

/** Changes too small to be visible. */
const settled = { nearness: 0.005, shift: 0.2 };

const currentSelector =
	"[data-header-link][aria-current], [role=tab][aria-selected=true] > *";

const selector = `[data-header-link], [data-lit-icon], ${currentSelector}`;

/** Lights up header links, icons, and current tabs where the pointer is near them. */
export class LitLinks {
	readonly #colorings = new Map<HTMLElement, Coloring>();
	readonly #measureLinks: () => MeasuredLink[];
	readonly #wake: () => void;

	constructor(signal: AbortSignal) {
		this.#measureLinks = cacheLayout(measureLinks, signal);
		this.#wake = createFrameTask((seconds) => this.#step(seconds), { signal });

		const clear = () => {
			for (const link of this.#colorings.keys()) {
				link.style.setProperty("--nearness", "0");
				setTimeout(() => {
					if (!this.#colorings.has(link)) {
						resetColor(link);
					}
				}, readMilliseconds("--transitionMedium"));
			}

			this.#colorings.clear();
		};

		onPause(clear, signal);
		onPointer(() => {
			if (this.#measureLinks().some(getNearness)) {
				this.#wake();
			}
		}, signal);
		signal.addEventListener("abort", clear);
	}

	#step(seconds: number) {
		const measured = this.#measureLinks();

		for (const near of measured) {
			if (getNearness(near) && !this.#colorings.has(near.link)) {
				this.#colorings.set(near.link, {
					nearness: 0,
					shift: 0,
					x: getLightTarget(near.bounds),
				});
			}
		}

		for (const [link, coloring] of this.#colorings) {
			const found = measured.find((other) => other.link === link);
			const bounds = found?.bounds;
			const nearness = found ? getNearness(found) : 0;
			const shift = bounds && nearness ? getShift(bounds) * nearness : 0;

			coloring.nearness = damp(coloring.nearness, nearness, 6, seconds);
			coloring.shift = moveToward(
				coloring.shift,
				damp(coloring.shift, shift, 5, seconds),
				maximumShiftPerSecond * seconds,
			);

			if (bounds && nearness) {
				coloring.x = followLight(coloring.x, getLightTarget(bounds), seconds);
			}

			if (
				!nearness &&
				coloring.nearness < settled.nearness &&
				Math.abs(coloring.shift) < settled.shift
			) {
				resetColor(link);
				this.#colorings.delete(link);
			} else {
				if (bounds) {
					link.style.setProperty("--lightX", px(coloring.x - bounds.left));
				}

				link.dataset.lit = "";
				link.style.setProperty("--glare", headerDwell.level.toFixed(3));
				link.style.setProperty("--hueShift", coloring.shift.toFixed(1));
				link.style.setProperty("--nearness", coloring.nearness.toFixed(3));
			}
		}

		return this.#colorings.size > 0;
	}
}

function getLightTarget({ left, right }: DOMRect) {
	return clamp(pointer.x, left, right);
}

function getNearness({ bounds, reach }: MeasuredLink) {
	return pointer.isPresent
		? clamp(1 - getDistance(pointer, bounds) / reach)
		: 0;
}

function getShift({ left, right, width }: DOMRect) {
	const offset = (pointer.x - (left + right) / 2) / (Math.max(1, width) / 2);

	return clamp(offset * shiftAtEnds, -maximumShift, maximumShift);
}

function measureLinks(): MeasuredLink[] {
	return Array.from(
		document.querySelectorAll<HTMLElement>(selector),
		(link) => ({
			bounds: link.getBoundingClientRect(),
			link,
			reach: link.matches(currentSelector) ? currentReach : otherReach,
		}),
	);
}

function resetColor(link: HTMLElement) {
	delete link.dataset.lit;
	link.style.removeProperty("--glare");
	link.style.removeProperty("--hueShift");
	link.style.removeProperty("--lightX");
	link.style.removeProperty("--nearness");
}
