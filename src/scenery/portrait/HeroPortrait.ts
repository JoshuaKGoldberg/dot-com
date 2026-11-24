import type { Point } from "../geometry";

import { cacheLayout } from "../cacheLayout";
import { px } from "../css";
import { createFrameTask } from "../frameLoop";
import { clamp, damp, interpolate, moveToward, smoothstep } from "../math";
import { onPointer, pointer } from "../pointer";
import { onPause } from "../rootState";
import { ConstellationCanvas } from "./ConstellationCanvas";
import { getPortraitPointer } from "./getPortraitPointer";
import { portraitSize } from "./sizes";

const radius = portraitSize / 2;

/** Distances from the center at which the pointer enters and leaves the portrait. */
const enterRadius = radius * 1.04;
const leaveRadius = radius * 1.14;

const secondsBeforeLight = 1;

/** How many times sooner than the rest of its light that the portrait's glow peaks. */
const glowHeadStart = 2.5;

const secondsOfLight = 10;
const secondsToFullTilt = 8;

const minimumLight = 0.002;

/** How much further than at the edge the figure may lean, such as just outside it. */
const maximumLean = 1.3;

/** Distances, in portrait units, that parts move by when fully leaned. */
const haloDistance = 7;
const figureDistance = { x: 4.8, y: 3.2 };

const figureLift = 4;
const figureRadians = 0.025;
const figureGrowth = 0.05;

/** Of the figure's movement, before and after it's been hovered for a while. */
const strengths = [0.57, 1.14] as const;

/**
 * A portrait that tilts toward the pointer, and slowly lights up as it's hovered.
 *
 * It's already complete without this. Nothing about it is replaced: this only
 * ever changes the opacity and transform of elements that were always there.
 */
export class HeroPortrait {
	#constellation: ConstellationCanvas | undefined;
	readonly #figure: HTMLElement;
	readonly #glow: HTMLElement;
	readonly #halos: readonly HTMLElement[];
	readonly #host: HTMLElement;

	/** Smoothed amount the portrait is hovered, so that tilting is never abrupt. */
	#hover = 0;

	#hoveredSeconds = 0;
	#isHovered = false;

	/** Smoothed position of the pointer, in portrait units. */
	readonly #lean: Point = { x: 0, y: 0 };

	#light = 0;
	readonly #lights: readonly HTMLElement[];
	readonly #measure: () => DOMRect;
	#seconds = 0;
	readonly #sky: HTMLElement;
	readonly #wake: () => void;

	/** How much of its full tilt the portrait is up to yet, from 0 to 1. */
	#willingness = 0;

	constructor(host: HTMLElement, signal: AbortSignal) {
		const find = (part: string) =>
			Array.from(host.querySelectorAll<HTMLElement>(`[data-portrait=${part}]`));

		[this.#figure] = find("figure");
		[this.#glow] = find("glow");
		this.#halos = find("halo");
		this.#host = host;
		this.#lights = find("light");
		this.#measure = cacheLayout(() => host.getBoundingClientRect(), signal);
		[this.#sky] = find("sky");
		this.#wake = createFrameTask((seconds) => this.#step(seconds), { signal });

		onPause(() => {
			this.#rest();
		}, signal);
		onPointer(() => {
			this.#updateHovered();
		}, signal);
	}

	/** CSS would run these as often as the screen refreshes, so they're paused there. */
	#animateLight() {
		for (const animation of this.#host.getAnimations({ subtree: true })) {
			if (animation instanceof CSSAnimation) {
				animation.currentTime = this.#seconds * 1000;
			}
		}
	}

	#paintLight() {
		const level = smoothstep(0, 1, this.#light);
		const isLit = this.#light > minimumLight;

		for (const light of this.#lights) {
			light.style.opacity = level.toFixed(4);
		}

		this.#glow.style.opacity = clamp(level * glowHeadStart).toFixed(4);

		if (isLit) {
			this.#animateLight();
			this.#constellation ??= new ConstellationCanvas(this.#sky);
			this.#constellation.paint(
				this.#lean,
				level,
				this.#seconds,
				this.#measure().width,
			);
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

		const strength = interpolate(
			...strengths,
			smoothstep(0, 1, this.#willingness),
		);
		const unit = this.#measure().width / portraitSize;
		const x =
			clamp(this.#lean.x / radius, -maximumLean, maximumLean) * this.#hover;
		const y =
			clamp(this.#lean.y / radius, -maximumLean, maximumLean) * this.#hover;

		for (const halo of this.#halos) {
			const distance =
				Number(halo.style.getPropertyValue("--direction")) *
				haloDistance *
				unit;

			halo.style.transform = `translate(${px(x * distance)}, ${px(y * distance)})`;
		}

		this.#figure.style.transform = [
			`translate(${px(x * figureDistance.x * strength * unit)}, ${px((y * figureDistance.y - this.#hover * figureLift) * strength * unit)})`,
			`rotate(${(x * figureRadians * strength).toFixed(5)}rad)`,
			`scale(${(1 + figureGrowth * this.#hover * strength).toFixed(5)})`,
		].join(" ");
	}

	/** Leaving takes going slightly farther than entering, so edges don't flicker. */
	#updateHovered() {
		const { x, y } = getPortraitPointer(this.#measure());

		this.#isHovered =
			pointer.isPresent &&
			Math.hypot(x, y) < (this.#isHovered ? leaveRadius : enterRadius);

		if (this.#isHovered) {
			this.#wake();
		}
	}
}
