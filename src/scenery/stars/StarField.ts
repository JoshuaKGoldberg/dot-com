import { cacheLayout } from "../cacheLayout";
import { resizeCanvas } from "../canvas";
import { type Column, measureColumn, minimumMargin } from "../column";
import { Dwell } from "../Dwell";
import { fadeAwayPainting } from "../fadeAway";
import { footerDwell } from "../footerDwell";
import { createFrameTask, type FrameTask } from "../frameLoop";
import {
	createRegions,
	type FooterBounds,
	measureFooter,
} from "../graphs/createRegions";
import { GraphSimulation } from "../graphs/GraphSimulation";
import { paintGraph } from "../graphs/paintGraphs";
import { clamp, interpolate } from "../math";
import { onPageScroll, pageScroll } from "../pageScroll";
import { onPointer, pointer } from "../pointer";
import { onPause, onRootState, rootState } from "../rootState";
import { onTheme, theme } from "../theme";
import {
	createStars,
	linkedDepth,
	parallaxRates,
	type Star,
} from "./createStars";
import { paintStars } from "./paintStars";
import { overscan, type Sky } from "./sky";
import { lightRadius, StarLights } from "./StarLights";
import { StarLinks } from "./StarLinks";

/** How far into the column the pointer still counts as being by its margin. */
const reach = 160;

/**
 * Stars behind the whole page, with constellations that form around the pointer
 * in the margins. Everything's on one canvas and in one set of coordinates.
 */
export class StarField {
	readonly #canvas = document.createElement("canvas");
	#column: Column;
	readonly #context = this.#canvas.getContext("2d");
	readonly #graphs = new GraphSimulation(Math.random);
	readonly #growing: FrameTask;
	#height = 0;
	readonly #host: HTMLElement;
	readonly #leftDwell = new Dwell();
	readonly #lights = new StarLights();
	readonly #links = new StarLinks();
	#marginStars: Star[] = [];
	readonly #measureFooter: () => FooterBounds;
	#paintedScroll = 0;
	readonly #rightDwell = new Dwell();
	readonly #scrolling: FrameTask;
	#seconds = 0;
	#stars: Star[] = [];
	#width = 0;

	constructor(host: HTMLElement, signal: AbortSignal) {
		this.#column = measureColumn();
		this.#growing = createFrameTask((seconds) => this.#grow(seconds), {
			signal,
		});
		this.#host = host;
		this.#measureFooter = cacheLayout(measureFooter, signal);
		this.#scrolling = createFrameTask(() => this.#scroll(), {
			isSmooth: true,
			signal,
		});

		host.append(this.#canvas);

		const resize = () => {
			this.#resize();
		};

		const resizes = new ResizeObserver(resize);

		// Resizes the window are also when its pixel ratio may have changed
		addEventListener("resize", resize, { signal });
		document.addEventListener("astro:page-load", resize, { signal });
		resizes.observe(host);

		onPageScroll(() => {
			this.#scrolling.wake();
		}, signal);
		onPause(() => {
			if (this.#graphs.graphs.length || this.#lights.lit.length) {
				fadeAwayPainting(this.#canvas);
			}

			this.#rest();
		}, signal);
		onPointer(() => {
			if (this.#isNearMargin() || this.#isNearFooter()) {
				this.#growing.wake();
			}
		}, signal);
		onRootState(() => {
			this.#paint();
		}, signal);
		onTheme(() => {
			this.#paint();
		}, signal);
		signal.addEventListener("abort", () => {
			resizes.disconnect();
			this.#canvas.remove();
		});
	}

	#createSky(): Sky {
		return {
			darkness: theme.darkness,
			dwell: { left: this.#leftDwell.level, right: this.#rightDwell.level },
			period: this.#height + overscan * 2,
			scroll: rootState.isPlaying ? pageScroll.top : 0,
			width: this.#width,
		};
	}

	#getRegions({ dwell, scroll }: Sky) {
		return createRegions({
			column: this.#column,
			dwell,
			footer: this.#measureFooter(),
			height: this.#height,
			marginOffset: scroll * parallaxRates[linkedDepth],
			width: this.#width,
		});
	}

	/** How near the pointer is to a margin, given how far it is into the column. */
	#getNearness(margin: number, distance: number) {
		return pointer.isPresent && margin > minimumMargin
			? 1 - clamp(distance / reach)
			: 0;
	}

	/** Advances everything that's been brought out by the pointer. */
	#grow(seconds: number) {
		const { left, right } = this.#column;
		const isDwelling = [
			this.#leftDwell.step(seconds, this.#getNearness(left, pointer.x - left)),
			this.#rightDwell.step(
				seconds,
				this.#getNearness(this.#width - right, right - pointer.x),
			),
			this.#isNearFooter(),
		].some(Boolean);
		const sky = this.#createSky();

		this.#seconds += seconds;
		this.#lights.step(seconds, this.#marginStars, sky);
		this.#links.relink(
			this.#lights.lit.filter(({ star }) => star.depth === linkedDepth),
			sky,
		);
		this.#links.step(seconds);
		this.#graphs.step(
			seconds,
			this.#getRegions(sky),
			{ height: this.#height },
			pointer.isPresent ? pointer : undefined,
		);
		this.#paint();

		return (
			isDwelling ||
			this.#lights.lit.length > 0 ||
			!this.#links.isEmpty ||
			this.#graphs.graphs.length > 0
		);
	}

	#isNearFooter() {
		const { band } = this.#measureFooter();

		return (
			footerDwell.level > 0 ||
			(pointer.isPresent && !!band && pointer.y > band.top)
		);
	}

	#isNearMargin() {
		return (
			pointer.isPresent &&
			(pointer.x < this.#column.left + lightRadius ||
				pointer.x > this.#column.right - lightRadius)
		);
	}

	#paint() {
		const context = this.#context;
		if (!context) {
			return;
		}

		const sky = this.#createSky();
		const { height, width } = this.#canvas;
		const ratio = height / this.#height;

		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(0, 0, width, height);
		context.setTransform(ratio, 0, 0, ratio, 0, 0);

		paintStars(context, this.#stars, sky);
		this.#lights.paint(context, sky, this.#seconds);
		this.#links.paint(context, this.#column, sky);
		this.#paintGraphs(context, sky);

		context.globalAlpha = 1;
		this.#paintedScroll = sky.scroll;
	}

	#paintGraphs(context: CanvasRenderingContext2D, sky: Sky) {
		if (!this.#graphs.graphs.length) {
			return;
		}

		const regions = this.#getRegions(sky);
		const scene = {
			column: this.#column,
			darkness: sky.darkness,
			pointer: pointer.isPresent ? pointer : undefined,
			seconds: this.#seconds,
		};

		for (const graph of this.#graphs.graphs) {
			const region = regions.find(({ name }) => name === graph.region);

			if (region) {
				paintGraph(
					context,
					graph,
					region.offset,
					interpolate(0.45, 1, region.dwell),
					scene,
				);
			}
		}
	}

	#resize() {
		const { clientHeight, clientWidth } = this.#host;
		const column = measureColumn();
		const wasCleared = resizeCanvas(this.#canvas, clientWidth, clientHeight);

		if (
			clientHeight !== this.#height ||
			clientWidth !== this.#width ||
			column.left !== this.#column.left ||
			column.right !== this.#column.right
		) {
			this.#column = column;
			this.#height = clientHeight;
			this.#width = clientWidth;
			this.#rest();
			this.#stars = createStars({
				column,
				period: clientHeight + overscan * 2,
				width: clientWidth,
			});
			this.#marginStars = this.#stars.filter(
				({ x }) => x < column.left || x > column.right,
			);
		} else if (!wasCleared) {
			return;
		}

		this.#paint();
	}

	/** Immediately removes everything that's been brought out by the pointer. */
	#rest() {
		this.#graphs.clear();
		this.#leftDwell.reset();
		this.#lights.clear();
		this.#links.clear();
		this.#rightDwell.reset();
	}

	/** Keeps stars' parallax up to date with the page. */
	#scroll() {
		if (this.#paintedScroll === pageScroll.top) {
			return false;
		}

		this.#paint();

		return true;
	}
}
