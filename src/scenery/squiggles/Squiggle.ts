import type { Rectangle } from "../geometry";

import { px } from "../css";
import { fadeAway } from "../fadeAway";
import { followLight } from "../followLight";
import { damp, interpolate, smoothstep } from "../math";
import { drawWave } from "./drawWave";

const namespace = "http://www.w3.org/2000/svg";

const largeFontSize = 20;

/** Same shape as the static squiggles' images, so that changing from one is seamless. */
const amplitude = 1.6;
const period = 14;
const restingHeight = 0.25;

const center = 6;

const settled = 0.004;

/** A line of a link's text, in the page's coordinates. */
export type LinkLine = Rectangle;

interface DrawnLine {
	base: SVGPathElement;
	gradient: SVGLinearGradientElement;
	highlight: SVGPathElement;
	highlightMask: SVGLinearGradientElement;
	svg: SVGSVGElement;
}

let nextId = 0;

/**
 * A link's squiggle that rises and wiggles as the pointer comes close to it.
 * Links that wrap onto multiple lines have a squiggle on each line.
 */
export class Squiggle {
	/** How close the pointer is, from 0 to 1. */
	target = 0;

	get isSettled() {
		return this.target === 0 && this.#near < settled;
	}

	readonly #drawn: DrawnLine[] = [];
	#highlightX: number | undefined;
	readonly #isAlwaysVisible: boolean;
	readonly #layer: HTMLElement;
	readonly #link: HTMLElement;
	#near = 0;
	readonly #offset: number;
	readonly #opacity: number;
	#phase = 0;
	readonly #restingHeight: number;
	readonly #restingThickness: number;
	readonly #riseSpeed: number;
	readonly #thickness: number;
	readonly #waveSpeed: number;

	constructor(link: HTMLElement, layer: HTMLElement) {
		const { content, height, marginTop } = getComputedStyle(link, "::after");
		const isStraight = content === "none";
		const styles = getComputedStyle(link);
		const thickness = styles.getPropertyValue("--squiggleThickness");

		this.#isAlwaysVisible = link.dataset.squiggle !== "onHover";
		this.#layer = layer;
		this.#link = link;
		this.#opacity =
			parseFloat(styles.getPropertyValue("--squiggleOpacity") || "100%") / 100;
		this.#restingHeight = isStraight ? 0 : restingHeight;
		this.#riseSpeed = Number(
			styles.getPropertyValue("--squiggleRiseSpeed") || 1,
		);
		this.#waveSpeed = Number(
			styles.getPropertyValue("--squiggleWaveSpeed") || 1,
		);
		this.#thickness = thickness
			? parseFloat(thickness)
			: parseFloat(styles.fontSize) >= largeFontSize
				? 2.5
				: 2;
		this.#restingThickness = thickness ? this.#thickness : this.#thickness - 1;
		this.#offset = isStraight
			? this.#thickness / -2
			: parseFloat(marginTop) + parseFloat(height) / 2;
		link.dataset.squiggleLive = "";
	}

	/** Keeps looking as it does now, as moving to a new page restarts transitions. */
	freeze() {
		for (const { svg } of this.#drawn) {
			svg.style.filter = getComputedStyle(svg).filter;
			svg.style.transition = "none";
		}
	}

	/** Fades away where it was on screen, now that its link's page is gone. */
	leave(scrolled: number) {
		for (const { svg } of this.#drawn) {
			svg.style.translate = `0 ${px(scrolled)}`;
			fadeAway(svg);
		}
	}

	paint(lines: readonly LinkLine[]) {
		while (this.#drawn.length > lines.length) {
			this.#drawn.pop()?.svg.remove();
		}

		for (const [index, { bottom, left, right }] of lines.entries()) {
			const line = (this.#drawn[index] ??= createLine(this.#layer));

			this.#paintLine(line, left, bottom, right - left);
		}
	}

	remove() {
		delete this.#link.dataset.squiggleLive;

		for (const { svg } of this.#drawn) {
			if (this.isSettled) {
				svg.remove();
			} else {
				fadeAway(svg);
			}
		}
	}

	step(seconds: number, pointerX: number) {
		const highlightX = this.#highlightX ?? pointerX;

		this.#highlightX = followLight(highlightX, pointerX, seconds);
		this.#near = damp(this.#near, this.target, 10 * this.#riseSpeed, seconds);
		this.#phase -=
			seconds * this.#near * this.#near * this.#waveSpeed * Math.PI * 1.8;
	}

	#paintLine(
		{ base, gradient, highlight, highlightMask, svg }: DrawnLine,
		left: number,
		bottom: number,
		width: number,
	) {
		const near = smoothstep(0, 1, this.#near);
		const path = drawWave({
			amplitude: amplitude * interpolate(this.#restingHeight, 1, near),
			period,
			phase: this.#phase,
			width,
			y: center,
		});
		const thickness = String(
			interpolate(this.#restingThickness, this.#thickness, near),
		);

		svg.style.transform = `translate(${px(left)}, ${px(snap(bottom + this.#offset) - center)})`;
		svg.style.opacity = String(
			this.#opacity * (this.#isAlwaysVisible ? 1 : near),
		);
		svg.style.setProperty("--resting", String(1 - near));
		svg.setAttribute("width", String(width));
		svg.toggleAttribute("data-hovered", this.target === 1);

		for (const element of [base, highlight]) {
			element.setAttribute("d", path);
			element.setAttribute("stroke-width", thickness);
		}

		// Ends fade out at rest, and fill in as the pointer comes closer
		const faded = String(near);
		gradient.setAttribute("x2", String(width));
		gradient.firstElementChild?.setAttribute("stop-opacity", faded);
		gradient.lastElementChild?.setAttribute("stop-opacity", faded);

		const highlightX = (this.#highlightX ?? left) - left;
		const reach = interpolate(40, 94, near);
		highlightMask.setAttribute("x1", String(highlightX - reach));
		highlightMask.setAttribute("x2", String(highlightX + reach));
		highlight.style.opacity = String(near * 0.8);
	}
}

function createElement<Name extends keyof SVGElementTagNameMap>(
	name: Name,
	attributes: Record<string, string>,
	children: SVGElement[] = [],
) {
	const element = document.createElementNS(namespace, name);

	for (const [key, value] of Object.entries(attributes)) {
		element.setAttribute(key, value);
	}

	element.append(...children);

	return element;
}

function createGradient(id: string, stops: [offset: string, color: string][]) {
	return createElement(
		"linearGradient",
		{ gradientUnits: "userSpaceOnUse", id },
		stops.map(([offset, color]) =>
			createElement("stop", {
				offset,
				style: `stop-color: ${color}`,
			}),
		),
	);
}

function createLine(layer: HTMLElement): DrawnLine {
	nextId += 1;

	const id = `squiggle-${nextId.toString()}`;
	const highlightId = `${id}-highlight`;

	const end = mixGray("var(--squiggleEnd)");
	const start = mixGray("var(--squiggleStart)");
	const gradient = createGradient(id, [
		["0", start],
		["0.17", start],
		["0.5", mixGray("var(--squiggleMiddle)")],
		["0.83", end],
		["1", end],
	]);
	const highlightMask = createGradient(highlightId, [
		["0", "transparent"],
		["0.5", "var(--squiggleHighlight)"],
		["1", "transparent"],
	]);
	const base = createElement("path", {
		fill: "none",
		stroke: `url(#${id})`,
		"stroke-linecap": "round",
	});
	const highlight = createElement("path", {
		fill: "none",
		stroke: `url(#${highlightId})`,
		"stroke-linecap": "round",
	});
	const svg = createElement("svg", { height: String(center * 2) }, [
		gradient,
		highlightMask,
		base,
		highlight,
	]);

	layer.append(svg);

	return { base, gradient, highlight, highlightMask, svg };
}

function mixGray(color: string) {
	return `color-mix(in srgb, ${color}, var(--squiggleGray) calc(var(--squiggleGrayness) * var(--resting)))`;
}

/** Rounds to whole screen pixels, as the browser does for static squiggles. */
function snap(value: number) {
	return Math.round(value * devicePixelRatio) / devicePixelRatio;
}
