import { cacheLayout } from "../cacheLayout";
import { dwells } from "../dwells";
import { createFrameTask } from "../frameLoop";
import { clamp, damp, smoothstep } from "../math";
import { pointer, watchPointer } from "../pointer";
import { rootState, watchRootState } from "../rootState";
import { SceneryElement } from "../SceneryElement";
import { AuroraRenderer } from "./AuroraRenderer";

/** Opacity of the light when the pointer's lingered as long as it can matter. */
const peakOpacity = "0.9";

/** From these distances, in pixels, the pointer's fully near and not at all near. */
const reaches = {
	bottom: [0, 80],
	top: [100, 230],
} as const;

const palettes = {
	dark: [
		[56, 255, 153],
		[51, 191, 255],
		[173, 115, 255],
		[255, 102, 158],
	],
	light: [
		[60, 175, 140],
		[80, 150, 205],
		[160, 115, 200],
		[225, 120, 150],
	],
};

const normalizedPalettes = {
	dark: palettes.dark.flat().map((channel) => channel / 255),
	light: palettes.light.flat().map((channel) => channel / 255),
};

/** Light along an edge of the page that comes to life as the pointer lingers by it. */
export class AuroraBandElement extends SceneryElement {
	#cursor = 0;
	readonly #edge = this.getAttribute("edge") === "top" ? "top" : "bottom";
	readonly #dwell = dwells[this.#edge];
	#flow = 0;
	readonly #getBounds = cacheLayout(() => this.getBoundingClientRect());
	#presence = 0;
	readonly #renderer = new AuroraRenderer();
	#stir = 0;
	readonly #task = createFrameTask((seconds) => this.#step(seconds));

	#time = 12;

	protected connect() {
		this.append(this.#renderer.canvas);

		const unwatch = [
			watchPointer(() => {
				// The rest of the time, the pointer moving can't make any difference
				if (rootState.isPlaying && this.#getNearness() > 0) {
					this.#task.wake();
				}
			}),
			watchRootState(() => {
				if (!rootState.isPlaying) {
					this.#rest();
				}
			}),
		];

		return () => {
			this.#rest();

			for (const stop of unwatch) {
				stop();
			}
		};
	}

	/** How near the pointer is to the edge, from 0 to 1. */
	#getNearness() {
		if (!pointer.isPresent) {
			return 0;
		}

		const [near, far] = reaches[this.#edge];

		if (this.#edge === "top") {
			// The band scrolls away with the top of the page
			return (
				smoothstep(far, near, pointer.y) *
				clamp(1 - document.body.scrollTop / 400)
			);
		}

		// The band scrolls in with the end of the page
		const { top } = this.#getBounds();

		return top < innerHeight
			? smoothstep(far, near, Math.max(0, top - pointer.y))
			: 0;
	}

	#rest() {
		this.#task.sleep();
		this.#dwell.stop();
		this.#presence = 0;
		this.#renderer.canvas.style.opacity = "0";
	}

	#step(seconds: number) {
		const nearness = this.#getNearness();

		if (!this.#dwell.step(seconds, nearness)) {
			this.#rest();

			return false;
		}

		// Before the pointer's had any influence, its light starts where it is
		this.#cursor =
			this.#presence < 0.02
				? pointer.x
				: damp(this.#cursor, pointer.x, 3, seconds);
		this.#stir = damp(
			this.#stir,
			clamp(Math.abs(pointer.x - this.#cursor) / 150),
			1,
			seconds,
		);
		this.#presence = damp(
			this.#presence,
			nearness,
			nearness > this.#presence ? 2.5 : 0.7,
			seconds,
		);
		this.#flow = damp(
			this.#flow,
			this.#presence * this.#dwell.level,
			0.9,
			seconds,
		);
		this.#time += seconds * (0.2 + this.#stir * 0.4 + this.#flow * 0.7);

		this.#renderer.canvas.style.opacity = peakOpacity;
		this.#renderer.draw({
			uCursor: this.#cursor,
			uDark: rootState.isDark,
			uDwell: this.#dwell.level,
			uFlip: this.#edge === "bottom",
			uFlow: this.#flow,
			uPalette: normalizedPalettes[rootState.isDark ? "dark" : "light"],
			uPresence: this.#presence,
			uSize: [this.#getBounds().width, this.#getBounds().height],
			uStir: this.#stir,
			uTime: this.#time,
		});

		return true;
	}
}
