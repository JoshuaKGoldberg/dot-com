import type { Dwell } from "../Dwell";

import { cacheLayout } from "../cacheLayout";
import { px, readMilliseconds } from "../css";
import { footerDwell } from "../footerDwell";
import { createFrameTask } from "../frameLoop";
import { headerDwell } from "../headerDwell";
import { clamp, damp, smoothstep } from "../math";
import { onPointer, pointer } from "../pointer";
import { onPause, rootState } from "../rootState";
import { onTheme, theme } from "../theme";
import { AuroraRenderer } from "./AuroraRenderer";
import { readPalette } from "./readPalette";

const peakOpacity = "0.9";

/** Pixels from the edge that count as fully near, and as not near. */
const reaches = {
	bottom: ({ height }: DOMRect) => [height, height + 80] as const,
	top: () => [100, 230] as const,
};

export class AuroraBand {
	#cursor = 0;
	readonly #dwell: Dwell;
	readonly #edge: keyof typeof reaches;
	#flow = 0;
	readonly #host: HTMLElement;
	readonly #measure: () => { bounds: DOMRect; opacity: number };
	#palette: readonly number[] | undefined;
	#presence = 0;
	readonly #renderer = new AuroraRenderer();
	#stir = 0;
	#time = 12;
	readonly #wake: () => void;

	constructor(host: HTMLElement, signal: AbortSignal) {
		this.#edge = host.getAttribute("edge") === "top" ? "top" : "bottom";
		this.#dwell = this.#edge === "top" ? headerDwell : footerDwell;
		this.#host = host;
		this.#measure = cacheLayout(
			() => ({
				bounds: host.getBoundingClientRect(),
				opacity: Number(getComputedStyle(host).opacity),
			}),
			signal,
		);
		this.#wake = createFrameTask((seconds) => this.#step(seconds), { signal });

		host.append(this.#renderer.canvas);

		onPause(() => {
			this.#rest();
		}, signal);
		onPointer(() => {
			if (this.#getNearness() > 0) {
				this.#wake();
			}
		}, signal);
		onTheme(() => {
			this.#palette = undefined;
		}, signal);
		keepPlace(host, signal);
		signal.addEventListener("abort", () => {
			this.#rest();
			this.#renderer.canvas.remove();
		});
	}

	#getNearness() {
		if (!pointer.isPresent) {
			return 0;
		}

		const { bounds, opacity } = this.#measure();
		const [near, far] = reaches[this.#edge](bounds);
		const distance =
			this.#edge === "top" ? pointer.y - bounds.top : bounds.bottom - pointer.y;

		// Bands scroll away from, and into view with, their ends of the page
		return bounds.height ? smoothstep(far, near, distance) * opacity : 0;
	}

	#rest() {
		this.#dwell.reset();
		this.#presence = 0;
		this.#renderer.canvas.style.opacity = "0";
		delete this.#host.dataset.awake;
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

		this.#palette ??= readPalette();

		const { height, width } = this.#measure().bounds;
		const wasDrawn = this.#renderer.draw({
			uCursor: this.#cursor,
			uDark: theme.darkness,
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
		this.#host.dataset.awake = "";

		return true;
	}
}

/**
 * Pages may have bands in different places, such as if they're scrolled, so they
 * move from where they were on the last page instead of suddenly being elsewhere.
 */
function keepPlace(host: HTMLElement, signal: AbortSignal) {
	let keyframe: Keyframe;

	document.addEventListener(
		"astro:before-swap",
		() => {
			const { top } = host.getBoundingClientRect();

			keyframe = {
				offset: 0,
				opacity: getComputedStyle(host).opacity,
				transform: `translateY(${px(top - host.offsetTop)})`,
			};
		},
		{ signal },
	);
	document.addEventListener(
		"astro:after-swap",
		() => {
			if (rootState.isPlaying) {
				host.animate([keyframe], {
					duration: readMilliseconds("--transitionMedium"),
					easing: "ease-in-out",
				});
			}
		},
		{ signal },
	);
}
