import { cacheLayout } from "../cacheLayout";
import { Dwell } from "../Dwell";
import { footerDwell } from "../footerDwell";
import { createFrameTask, type FrameTask } from "../frameLoop";
import { clamp, damp, smoothstep } from "../math";
import { onPointer, pointer } from "../pointer";
import { onPause, onRootState, rootState } from "../rootState";
import { AuroraRenderer } from "./AuroraRenderer";
import { readPalette } from "./readPalette";

/** Opacity of the light when the pointer's lingered as long as it can matter. */
const peakOpacity = "0.9";

/** Pixels from the edge at which the pointer's as near as it can be, and not near. */
const reaches = {
	bottom: [360, 440],
	top: [100, 230],
} as const;

/** Light along an edge of the page that comes to life as the pointer lingers by it. */
export class AuroraBand {
	#cursor = 0;
	readonly #dwell: Dwell;
	readonly #edge: keyof typeof reaches;
	#flow = 0;
	readonly #measure: () => { bounds: DOMRect; opacity: number };
	#palette: readonly number[];
	#presence = 0;
	readonly #renderer = new AuroraRenderer();
	#stir = 0;
	readonly #task: FrameTask;
	#time = 12;

	constructor(host: HTMLElement, signal: AbortSignal) {
		this.#edge = host.getAttribute("edge") === "top" ? "top" : "bottom";
		this.#dwell = this.#edge === "top" ? new Dwell() : footerDwell;
		this.#measure = cacheLayout(
			() => ({
				bounds: host.getBoundingClientRect(),
				opacity: Number(getComputedStyle(host).opacity),
			}),
			signal,
		);
		this.#palette = readPalette();
		this.#task = createFrameTask((seconds) => this.#step(seconds), { signal });

		host.append(this.#renderer.canvas);

		onPause(() => {
			this.#rest();
		}, signal);
		onPointer(() => {
			if (this.#getNearness() > 0) {
				this.#task.wake();
			}
		}, signal);
		onRootState(() => {
			this.#palette = readPalette();
		}, signal);
		signal.addEventListener("abort", () => {
			this.#rest();
			this.#renderer.canvas.remove();
		});
	}

	/** How near the pointer is to the edge, from 0 to 1. */
	#getNearness() {
		if (!pointer.isPresent) {
			return 0;
		}

		const { bounds, opacity } = this.#measure();
		const [near, far] = reaches[this.#edge];
		const distance =
			this.#edge === "top" ? pointer.y - bounds.top : bounds.bottom - pointer.y;

		// Bands scroll away from, and into view with, their ends of the page
		return bounds.height ? smoothstep(far, near, distance) * opacity : 0;
	}

	#rest() {
		this.#dwell.reset();
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

		const { height, width } = this.#measure().bounds;
		const wasDrawn = this.#renderer.draw({
			uCursor: this.#cursor,
			uDark: rootState.isDark,
			uDwell: this.#dwell.level,
			uFlip: this.#edge === "bottom",
			uFlow: this.#flow,
			uPalette: this.#palette,
			uPresence: this.#presence,
			uSize: [width, height],
			uStir: this.#stir,
			uTime: this.#time,
		});

		this.#renderer.canvas.style.opacity = wasDrawn ? peakOpacity : "0";

		return true;
	}
}
