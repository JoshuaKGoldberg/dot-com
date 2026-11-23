import { cacheLayout } from "../cacheLayout";
import { angleToHue, depthColor, hueDriftRate } from "../color";
import { type Column, measureColumn, minimumMargin } from "../column";
import { px } from "../css";
import { dwells } from "../dwells";
import { createFrameTask } from "../frameLoop";
import { GraphSimulation, type Region } from "../graphs/GraphSimulation";
import { paintGraph } from "../graphs/paintGraphs";
import { clamp, damp, interpolate, smoothstep } from "../math";
import { pointer, watchPointer } from "../pointer";
import { rootState, watchRootState } from "../rootState";
import { SceneryElement } from "../SceneryElement";
import {
	createStars,
	linkedDepth,
	parallaxRates,
	type Star,
} from "./createStars";
import { getScreenY, overscan, paintStars, type Sky } from "./paintStars";
import { StarLinks } from "./StarLinks";
const maximumPixelRatio = 1.5;

/** How far from a margin, or above the footer's, the pointer is still near it. */
const reach = 160;

const glowRadius = 150;

/**
 * Stars behind the whole page, with constellations that form around the pointer
 * in the margins. Everything's on one canvas and in one set of coordinates.
 */
export class StarFieldElement extends SceneryElement {
	readonly #canvas = document.createElement("canvas");
	#column: Column = { left: 0, right: 0 };
	readonly #context = this.#canvas.getContext("2d");
	readonly #getFooterBounds = cacheLayout(() => ({
		band: document
			.querySelector("aurora-band[edge=bottom]")
			?.getBoundingClientRect(),
		footer: document.querySelector("footer")?.getBoundingClientRect(),
	}));
	readonly #graphs = new GraphSimulation(Math.random);
	readonly #growing = createFrameTask((seconds) => this.#grow(seconds));
	#height = 0;
	#isLit = false;
	readonly #links = new StarLinks();
	#marginStars: Star[] = [];
	#paintedScroll = 0;
	readonly #scrolling = createFrameTask(
		() => {
			const isMoving = this.#paintedScroll !== this.#scroll;

			if (isMoving) {
				this.#paint();
			}

			return isMoving;
		},
		{ isSmooth: true },
	);

	#seconds = 0;
	#stars: Star[] = [];
	#width = 0;

	get #scroll() {
		return rootState.isPlaying ? document.body.scrollTop : 0;
	}

	protected connect() {
		this.append(this.#canvas);

		const listeners = new AbortController();
		const { signal } = listeners;
		const resizes = new ResizeObserver(() => {
			this.#resize();
		});

		resizes.observe(this);

		document.addEventListener(
			"astro:page-load",
			() => {
				this.#resize();
			},
			{ signal },
		);

		// Scroll events don't bubble, and each navigation replaces the scrolling body
		document.addEventListener(
			"scroll",
			({ target }) => {
				if (target === document.body && rootState.isPlaying) {
					this.#scrolling.wake();
				}
			},
			{ capture: true, passive: true, signal },
		);

		const unwatchPointer = watchPointer(() => {
			if (
				rootState.isPlaying &&
				(this.#isNearMargin() || dwells.bottom.level > 0)
			) {
				this.#growing.wake();
			}
		});
		const unwatchRootState = watchRootState(() => {
			if (!rootState.isPlaying) {
				this.#rest();
			}

			this.#paint();
		});

		return () => {
			listeners.abort();
			resizes.disconnect();
			unwatchPointer();
			unwatchRootState();
			this.#rest();
			this.#scrolling.sleep();
			this.#canvas.remove();
		};
	}

	#createSky(): Sky {
		return {
			dwell: { left: dwells.left.level, right: dwells.right.level },
			isDark: rootState.isDark,
			period: this.#height + overscan * 2,
			scroll: this.#scroll,
			width: this.#width,
		};
	}

	#getRegions(): Region[] {
		const { band, footer } = this.#getFooterBounds();
		const offset = this.#scroll * parallaxRates[linkedDepth];
		const margin = { limit: 11, offset, rate: 1 };

		return [
			{
				...margin,
				bounds: {
					bottom: this.#height,
					left: 0,
					right: this.#column.left,
					top: 0,
				},
				dwell: dwells.left.level,
				name: "left",
			},
			{
				...margin,
				bounds: {
					bottom: this.#height,
					left: this.#column.right,
					right: this.#width,
					top: 0,
				},
				dwell: dwells.right.level,
				name: "right",
			},
			...(band
				? [
						{
							avoid: footer,
							bounds: {
								bottom: band.bottom,
								left: 0,
								right: this.#width,
								top: band.top,
							},
							dwell: dwells.bottom.level,
							limit: 8,
							name: "bottom" as const,
							offset: -band.top,
							rate: 0.3,
						},
					]
				: []),
		];
	}

	/** Advances everything that's been brought out by the pointer. */
	#getNearness(side: "left" | "right") {
		const { left, right } = this.#column;
		const margin = side === "left" ? left : this.#width - right;

		if (!pointer.isPresent || margin < minimumMargin) {
			return 0;
		}

		return (
			1 -
			clamp((side === "left" ? pointer.x - left : right - pointer.x) / reach)
		);
	}

	#grow(seconds: number) {
		const here = pointer.isPresent ? pointer : undefined;
		const sky = this.#createSky();

		this.#seconds += seconds;

		const isDwelling = [
			dwells.left.step(seconds, this.#getNearness("left")),
			dwells.right.step(seconds, this.#getNearness("right")),
			dwells.bottom.level > 0,
		].some(Boolean);
		const lit =
			this.#isLit || this.#isNearMargin() ? this.#lightStars(seconds, sky) : [];

		this.#isLit = lit.length > 0;
		this.#links.relink(
			lit.filter(({ star }) => star.depth === linkedDepth),
			sky,
		);
		this.#links.step(seconds);
		this.#graphs.step(
			seconds,
			this.#getRegions(),
			{ height: this.#height },
			here,
		);

		const isAlive =
			isDwelling ||
			lit.length > 0 ||
			!this.#links.isEmpty ||
			this.#graphs.graphs.length > 0;

		if (isAlive || this.#wasAlive) {
			this.#paint();
		}

		this.#wasAlive = isAlive;

		return isAlive;
	}

	#isNearMargin() {
		return (
			pointer.isPresent &&
			(pointer.x < this.#column.left + glowRadius ||
				pointer.x > this.#column.right - glowRadius)
		);
	}

	/**
	 * Brightens the margins' stars around the pointer, and dims the rest.
	 * @returns Stars that are at all lit.
	 */
	#lightStars(seconds: number, sky: Sky) {
		const { isPresent, x: pointerX, y: pointerY } = pointer;
		const lit = [];

		for (const star of this.#marginStars) {
			// Most stars are nowhere near the pointer, so they need to be skipped quickly
			if (!star.glow && Math.abs(star.x - pointerX) > glowRadius) {
				continue;
			}

			const y = getScreenY(star.y, star.depth, sky);
			const distance = Math.hypot(star.x - pointerX, y - pointerY);
			const target = isPresent ? smoothstep(glowRadius, 0, distance) : 0;

			if (!target && !star.glow) {
				continue;
			}

			star.glow = damp(
				star.glow,
				target,
				target > star.glow ? 2 : 0.9,
				seconds,
			);

			if (star.glow < 0.01) {
				star.glow = 0;
				continue;
			}

			lit.push({
				distance,
				hue: angleToHue(star.x - pointerX, y - pointerY),
				star,
			});
		}

		return lit;
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
		this.#paintGlow(context, sky);
		this.#links.paint(context, this.#column, sky);
		this.#paintGraphs(context);
		context.globalAlpha = 1;
		this.#paintedScroll = sky.scroll;
	}

	#paintGlow(context: CanvasRenderingContext2D, sky: Sky) {
		for (const star of this.#marginStars) {
			if (!star.glow) {
				continue;
			}

			const y = getScreenY(star.y, star.depth, sky);
			const hue =
				angleToHue(star.x - pointer.x, y - pointer.y) +
				this.#seconds * hueDriftRate;

			context.fillStyle = depthColor(hue, 0.7, sky.isDark);
			context.globalAlpha = star.glow * star.alpha * 0.7;
			context.beginPath();
			context.arc(
				star.x,
				y,
				star.radius * (1 + star.glow * 0.25),
				0,
				Math.PI * 2,
			);
			context.fill();
		}
	}

	#paintGraphs(context: CanvasRenderingContext2D) {
		if (!this.#graphs.graphs.length) {
			return;
		}

		const scene = {
			column: this.#column,
			isDark: rootState.isDark,
			pointer: pointer.isPresent ? pointer : undefined,
			seconds: this.#seconds,
		};
		const regions = this.#getRegions();

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
		const { clientHeight, clientWidth } = this;
		const ratio = Math.min(devicePixelRatio, maximumPixelRatio);
		const column = measureColumn();

		if (
			clientHeight === this.#height &&
			clientWidth === this.#width &&
			column.left === this.#column.left &&
			column.right === this.#column.right
		) {
			this.#paint();

			return;
		}

		this.#column = column;
		this.#height = clientHeight;
		this.#width = clientWidth;
		this.#canvas.height = Math.round(clientHeight * ratio);
		this.#canvas.width = Math.round(clientWidth * ratio);
		this.#canvas.style.height = px(clientHeight);
		this.#canvas.style.width = px(clientWidth);
		this.#rest();
		this.#stars = createStars({
			column,
			period: clientHeight + overscan * 2,
			width: clientWidth,
		});
		this.#marginStars = this.#stars.filter(
			({ x }) => x < column.left || x > column.right,
		);
		this.#paint();
	}

	/** Immediately removes everything that's been brought out by the pointer. */
	#wasAlive = false;

	#rest() {
		dwells.left.stop();
		dwells.right.stop();
		this.#graphs.clear();
		this.#growing.sleep();
		this.#links.clear();

		for (const star of this.#marginStars) {
			star.glow = 0;
		}
	}
}
