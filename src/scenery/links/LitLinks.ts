import { cacheLayout } from "../cacheLayout";
import { px } from "../css";
import { followLight } from "../followLight";
import { createFrameTask, type FrameTask } from "../frameLoop";
import { headerDwell } from "../headerDwell";
import { clamp, damp, moveToward } from "../math";
import { onPointer, pointer } from "../pointer";
import { onPause } from "../rootState";

interface Coloring {
	/** How close the pointer is, from 0 to 1. */
	nearness: number;

	/** Degrees from the link's usual hue. */
	shift: number;

	/** Where the light is, as it catches up to the pointer. */
	x: number;
}

interface MeasuredLink {
	bounds: DOMRect;
	link: HTMLElement;

	/** Distance from the pointer, in pixels, within which the link reacts to it. */
	reach: number;
}

/** Links for what's currently being shown react before they're hovered. */
const currentReach = 72;

/** Any others are only lit while they're hovered. */
const otherReach = 1;

/** How far links' hues shift, in degrees, with the pointer at one of their ends. */
const shiftAtEnds = 220;

/** Farthest that links' hues shift, in degrees. */
const maximumShift = 110;

/** Fastest that links' hues shift, in degrees per second. */
const maximumShiftSpeed = 140;

/** As long as --transitionMedium, which links transition for when paused. */
const fadeMilliseconds = 280;

/** Changes too small to be visible. */
const settled = { nearness: 0.005, shift: 0.2 };

const currentSelector =
	"[data-header-link][aria-current], [role=tab][aria-selected=true] > *";

const selector = `[data-header-link], ${currentSelector}`;

/** Lights up header links and current tabs in shifting colors where the pointer is near them. */
export class LitLinks {
	readonly #colorings = new Map<HTMLElement, Coloring>();
	readonly #measureLinks: () => MeasuredLink[];
	readonly #task: FrameTask;

	constructor(signal: AbortSignal) {
		this.#measureLinks = cacheLayout(measureLinks, signal);
		this.#task = createFrameTask((seconds) => this.#step(seconds), { signal });

		const clear = () => {
			for (const link of this.#colorings.keys()) {
				link.style.setProperty("--nearness", "0");
				setTimeout(() => {
					if (!this.#colorings.has(link)) {
						resetColor(link);
					}
				}, fadeMilliseconds);
			}

			this.#colorings.clear();
		};

		onPause(clear, signal);
		onPointer(() => {
			if (this.#measureLinks().some(getNearness)) {
				this.#task.wake();
			}
		}, signal);
		signal.addEventListener("abort", clear);
	}

	#step(seconds: number) {
		const measured = this.#measureLinks();

		for (const { bounds, link } of measured) {
			if (!this.#colorings.has(link)) {
				this.#colorings.set(link, {
					nearness: 0,
					shift: 0,
					x: getLightTarget(bounds),
				});
			}
		}

		for (const [link, coloring] of this.#colorings) {
			const found = measured.find((other) => other.link === link);
			const bounds = found?.bounds;
			const nearness = found ? getNearness(found) : 0;
			const shift = bounds ? getShift(bounds) * nearness : 0;

			coloring.nearness = damp(coloring.nearness, nearness, 6, seconds);
			coloring.shift = moveToward(
				coloring.shift,
				damp(coloring.shift, shift, 5, seconds),
				maximumShiftSpeed * seconds,
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

/** Closest to the pointer that the link can be lit. */
function getLightTarget({ left, right }: DOMRect) {
	return clamp(pointer.x, left, right);
}

/** How close the pointer is, from 0 to 1. */
function getNearness({ bounds, reach }: MeasuredLink) {
	const { bottom, left, right, top } = bounds;

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
