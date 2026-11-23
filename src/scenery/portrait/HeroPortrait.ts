import type { Point } from "../geometry";

import { cacheLayout } from "../cacheLayout";
import { px } from "../css";
import { createFrameTask, type FrameTask } from "../frameLoop";
import { clamp, damp, interpolate, moveToward, smoothstep } from "../math";
import { onPointer, pointer } from "../pointer";
import { onPause, rootState } from "../rootState";
import { ConstellationCanvas } from "./ConstellationCanvas";
import { HeroEyes } from "./HeroEyes";
import { getPortraitPointer, portraitSize } from "./units";

const radius = portraitSize / 2;

/** Distances from the center at which the pointer enters and leaves the portrait. */
const enterRadius = radius * 1.04;
const leaveRadius = radius * 1.14;

const secondsBeforeEyes = 3.5;
const secondsBeforeLight = 1;
const secondsOfLight = 10;
const secondsToFullTilt = 8;

/** Light too faint to be visible. */
const darkness = 0.002;

/** How much further than at the edge the figure may lean, such as just outside it. */
const maximumLean = 1.3;

/**
 * A portrait that tilts toward the pointer, and slowly lights up as it's hovered.
 *
 * It's already complete without this. Nothing about it is replaced: this only
 * ever changes the opacity and transform of elements that were always there.
 */
export class HeroPortrait {
	#constellation: ConstellationCanvas | undefined;
	readonly #eyes: HeroEyes | undefined;
	readonly #figure: HTMLElement;
	readonly #host: HTMLElement;

	/** Smoothed amount the portrait is hovered, so that tilting is never abrupt. */
	#hover = 0;

	#hoveredSeconds = 0;
	#isHovered = false;

	/** Smoothed position of the pointer, in portrait units. */
	readonly #lean: Point = { x: 0, y: 0 };

	/** How lit up the portrait is, from 0 to 1. */
	#light = 0;

	readonly #lights: readonly HTMLElement[];
	readonly #measure: () => DOMRect;
	#seconds = 0;
	readonly #sky: HTMLElement;
	readonly #task: FrameTask;

	/** How much of its full tilt the portrait is up to yet, from 0 to 1. */
	#willingness = 0;

	constructor(host: HTMLElement, signal: AbortSignal) {
		const eyes = host.querySelector<SVGSVGElement>("[data-portrait=eyes]");
		const find = (part: string) =>
			Array.from(host.querySelectorAll<HTMLElement>(`[data-portrait=${part}]`));

		[this.#figure] = find("figure");
		this.#host = host;
		this.#lights = find("light");
		this.#measure = cacheLayout(() => host.getBoundingClientRect(), signal);
		[this.#sky] = find("sky");
		this.#task = createFrameTask((seconds) => this.#step(seconds), { signal });
		this.#eyes = eyes ? new HeroEyes(eyes, this.#measure, signal) : undefined;

		onPause(() => {
			this.#rest();
		}, signal);
		onPointer(() => {
			if (rootState.isPlaying) {
				this.#updateHovered();
			}
		}, signal);
	}

	#paintLight() {
		const level = smoothstep(0, 1, this.#light);
		const isLit = this.#light > darkness;

		for (const light of this.#lights) {
			light.style.setProperty("--light", level.toFixed(4));
		}

		this.#host.toggleAttribute("data-awake", isLit);

		if (isLit) {
			this.#constellation ??= new ConstellationCanvas(this.#sky);
			this.#constellation.paint(this.#lean, level, this.#seconds);
		} else {
			this.#constellation?.remove();
			this.#constellation = undefined;
		}
	}

	#rest() {
		this.#hover = 0;
		this.#hoveredSeconds = 0;
		this.#isHovered = false;
		this.#light = 0;
		this.#willingness = 0;
		this.#paintLight();
		this.#tilt();
	}

	#step(seconds: number) {
		this.#updateHovered();
		this.#seconds += seconds;

		if (this.#isHovered) {
			const { x, y } = getPortraitPointer(this.#measure());

			this.#hover = damp(this.#hover, 1, 5, seconds);
			this.#hoveredSeconds += seconds;
			this.#lean.x = damp(this.#lean.x, x, 7, seconds);
			this.#lean.y = damp(this.#lean.y, y, 7, seconds);
		} else {
			this.#hover = damp(this.#hover, 0, 1.6, seconds);
			this.#hoveredSeconds = 0;
		}

		this.#willingness = moveToward(
			this.#willingness,
			Number(this.#isHovered),
			seconds / secondsToFullTilt,
		);

		if (!this.#isHovered || this.#hoveredSeconds > secondsBeforeLight) {
			this.#light = moveToward(
				this.#light,
				Number(this.#isHovered),
				seconds / secondsOfLight,
			);
		}

		if (this.#hoveredSeconds > secondsBeforeEyes) {
			this.#eyes?.follow();
		}

		if (
			!this.#isHovered &&
			this.#hover < 0.001 &&
			!this.#light &&
			!this.#willingness
		) {
			this.#rest();

			return false;
		}

		this.#paintLight();
		this.#tilt();

		return true;
	}

	#tilt() {
		if (!this.#hover) {
			this.#figure.style.transform = "";

			return;
		}

		const strength =
			1.14 * interpolate(0.5, 1, smoothstep(0, 1, this.#willingness));
		const unit = this.#measure().width / portraitSize;
		const x =
			clamp(this.#lean.x / radius, -maximumLean, maximumLean) * this.#hover;
		const y =
			clamp(this.#lean.y / radius, -maximumLean, maximumLean) * this.#hover;

		this.#figure.style.transform = [
			`translate(${px(x * 4.8 * strength * unit)}, ${px((y * 3.2 - this.#hover * 4) * strength * unit)})`,
			`rotate(${(x * 0.025 * strength).toFixed(5)}rad)`,
			`scale(${(1 + 0.05 * this.#hover * strength).toFixed(5)})`,
		].join(" ");
	}

	/** Leaving takes going slightly farther than entering, so edges don't flicker. */
	#updateHovered() {
		const { x, y } = getPortraitPointer(this.#measure());

		this.#isHovered =
			pointer.isPresent &&
			Math.hypot(x, y) < (this.#isHovered ? leaveRadius : enterRadius);

		if (this.#isHovered) {
			this.#task.wake();
		}
	}
}
