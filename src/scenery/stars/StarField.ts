import { cacheLayout } from "../cacheLayout";
import { resizeCanvas } from "../canvas";
import { type Column, measureColumn, minimumMargin } from "../column";
import { Dwell } from "../Dwell";
import { crossfadePainting, fadeAwayPainting } from "../fadeAway";
import { footerDwell } from "../footerDwell";
import { createFrameTask } from "../frameLoop";
import { createRegions, measureFooter } from "../graphs/createRegions";
import { GraphSimulation } from "../graphs/GraphSimulation";
import { paintGraph } from "../graphs/paintGraphs";
import { SnarkLabels } from "../graphs/SnarkLabels";
import { clamp, interpolate } from "../math";
import { onPageScroll, pageScroll } from "../pageScroll";
import { onPointer, pointer } from "../pointer";
import { onPause, onRootState, rootState } from "../rootState";
import { onTheme, theme } from "../theme";
import { createStars, type Star } from "./createStars";
import { paintStars } from "./paintStars";
import { linkedDepth, overscan, parallaxRates, type Sky } from "./sky";
import { StarLights } from "./StarLights";
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
	#height = 0;
	readonly #host: HTMLElement;
	readonly #labels: SnarkLabels;
	readonly #leftDwell = new Dwell();
	readonly #lights = new StarLights();
	readonly #links = new StarLinks();
	#marginStars: Star[] = [];
	readonly #measureFooter: () => ReturnType<typeof measureFooter>;
	#paintedDarkness = theme.darkness;
	#paintedScroll = 0;
	readonly #rightDwell = new Dwell();

	/** How far the sky has scrolled, other than from the current page scrolling. */
	#scrollBefore = 0;

	#seconds = 0;
	#stars: Star[] = [];
	readonly #wakeGrowing: () => void;
	#width = 0;

	constructor(host: HTMLElement, signal: AbortSignal) {
		this.#column = measureColumn();
		this.#host = host;
		this.#measureFooter = cacheLayout(measureFooter, signal);
		this.#wakeGrowing = createFrameTask((seconds) => this.#grow(seconds), {
			signal,
		});
		this.#labels = new SnarkLabels(this.#wakeGrowing, signal);

		host.append(this.#canvas);

		const resize = () => {
			this.#resize();
		};

		const resizes = new ResizeObserver(resize);

		// Also fires when only the pixel ratio changes
		addEventListener("resize", resize, { signal });
		document.addEventListener("astro:page-load", resize, { signal });
		resizes.observe(host);

		document.addEventListener(
			"astro:after-swap",
			() => {
				this.#keepScroll();

				if (this.#graphs.graphs.length) {
					this.#wakeGrowing();
				}
			},
			{ signal },
		);
		onPageScroll(
			createFrameTask(() => this.#scroll(), { isSmooth: true, signal }),
			signal,
		);
		onPause(() => {
			fadeAwayPainting(this.#canvas);
			this.#graphs.clear();
			this.#leftDwell.reset();
			this.#lights.clear();
			this.#links.clear();
			this.#rightDwell.reset();
		}, signal);
		onPointer(() => {
			if (
				this.#isNearMargin() ||
				this.#isNearFooter() ||
				this.#graphs.graphs.length
			) {
				this.#wakeGrowing();
			}
		}, signal);
		onTheme(() => {
			if (!rootState.isPlaying && theme.darkness !== this.#paintedDarkness) {
				crossfadePainting(this.#canvas);
			}

			this.#paint();
		}, signal);
		onRootState(() => {
			if (rootState.isPlaying) {
				this.#keepScroll();
			}

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
			scroll: rootState.isPlaying
				? this.#scrollBefore + pageScroll.top
				: this.#paintedScroll,
			width: this.#width,
		};
	}

	#getNearness() {
		const { left, right } = this.#column;
		const get = (margin: number, distance: number) =>
			pointer.isPresent && margin > minimumMargin
				? 1 - clamp(distance / reach)
				: 0;

		return {
			left: get(left, pointer.x - left),
			right: get(this.#width - right, right - pointer.x),
		};
	}

	#getRegions({ dwell, scroll }: Sky) {
		return createRegions({
			column: this.#column,
			dwell,
			footer: this.#measureFooter().bounds,
			height: this.#height,
			marginOffset: scroll * parallaxRates[linkedDepth],
			width: this.#width,
		});
	}

	#grow(seconds: number) {
		const nearness = this.#getNearness();
		const isDwelling = [
			this.#leftDwell.step(seconds, nearness.left),
			this.#rightDwell.step(seconds, nearness.right),
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
		this.#graphs.step(seconds, this.#getRegions(sky), this.#height, pointer);
		this.#paint();

		return (
			isDwelling ||
			this.#lights.lit.length > 0 ||
			!this.#links.isEmpty ||
			this.#graphs.isActive(pointer)
		);
	}

	#isNearFooter() {
		const { bounds } = this.#measureFooter();

		return (
			footerDwell.level > 0 ||
			(pointer.isPresent && !!bounds && pointer.y > bounds.aurora.top)
		);
	}

	#isNearMargin() {
		const { left, right } = this.#getNearness();

		return left > 0 || right > 0;
	}

	/** Has the sky stay where it was last painted, wherever the page has since gone. */
	#keepScroll() {
		this.#scrollBefore = this.#paintedScroll - pageScroll.top;
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
		this.#paintedDarkness = sky.darkness;
		this.#paintedScroll = sky.scroll;
	}

	#paintGraphs(context: CanvasRenderingContext2D, sky: Sky) {
		if (!this.#graphs.graphs.length) {
			this.#labels.update([], this.#height);

			return;
		}

		const regions = this.#getRegions(sky);
		const scene = {
			column: this.#column,
			darkness: sky.darkness,
			seconds: this.#seconds,
		};

		const placed = this.#graphs.graphs.flatMap((graph) => {
			const region = regions.get(graph.region);

			return region ? [{ graph, region }] : [];
		});

		for (const { graph, region } of placed) {
			paintGraph(
				context,
				graph,
				region.offset,
				graph.kind === "snark" ? 1 : interpolate(0.45, 1, region.dwell),
				scene,
			);
		}

		this.#labels.update(placed, this.#height);
	}

	#resize() {
		const { clientHeight, clientWidth } = this.#host;
		const column = measureColumn();
		const areMarginsMoved =
			clientWidth !== this.#width ||
			column.left !== this.#column.left ||
			column.right !== this.#column.right;
		const areStarsMoved = areMarginsMoved || clientHeight !== this.#height;

		if (
			(areMarginsMoved && this.#graphs.graphs.length) ||
			(areStarsMoved && this.#lights.lit.length)
		) {
			crossfadePainting(this.#canvas);
		}

		const wasCleared = resizeCanvas(this.#canvas, clientWidth, clientHeight);

		if (areMarginsMoved) {
			this.#graphs.clear();
		}

		if (areStarsMoved) {
			this.#column = column;
			this.#height = clientHeight;
			this.#lights.clear();
			this.#links.clear();
			this.#stars = createStars({
				column,
				period: clientHeight + overscan * 2,
				width: clientWidth,
			});
			this.#marginStars = this.#stars.filter(
				({ x }) => x < column.left || x > column.right,
			);
			this.#width = clientWidth;
		}

		if (areStarsMoved || wasCleared) {
			this.#paint();
		}
	}

	#scroll() {
		if (this.#paintedScroll === this.#createSky().scroll) {
			return false;
		}

		this.#paint();

		return true;
	}
}
