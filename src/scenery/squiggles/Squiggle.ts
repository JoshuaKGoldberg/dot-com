import type { Rectangle } from "../geometry";

import { px } from "../css";
import { fadeAway } from "../fadeAway";
import { followLight } from "../followLight";
import { damp, interpolate, smoothstep } from "../math";
import { drawWave } from "./drawWave";

const namespace = "http://www.w3.org/2000/svg";

/** Links with text at least this large have thicker squiggles. */
const largeFontSize = 20;

/** Same shape as the static squiggles' images, so that changing from one is seamless. */
const amplitude = 1.6;
const period = 14;
const restingHeight = 0.25;

/** Vertical center of squiggles within their elements. */
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
	readonly link: HTMLElement;

	/** How close the pointer is, from 0 to 1. */
	target = 0;

	get isSettled() {
		return this.target === 0 && this.#near < settled;
	}

	#drawn: DrawnLine[] = [];
	readonly #fontSize: number;

	/** Where the highlight is, as it catches up to the pointer. */
	#highlightX: number | undefined;

	readonly #layer: HTMLElement;
	#lines: readonly LinkLine[] = [];
	#near = 0;
	readonly #offset: number;
	#phase = 0;

	/** Whether the link has a squiggle even when the pointer isn't near. */
	readonly #rests: boolean;

	constructor(link: HTMLElement, layer: HTMLElement) {
		this.link = link;
		this.#fontSize = parseFloat(getComputedStyle(link).fontSize);
		this.#layer = layer;
		this.#offset = getOffset(link);
		this.#rests = link.dataset.squiggle !== "onHover";
		link.dataset.squiggleLive = "";
	}

	remove() {
		delete this.link.dataset.squiggleLive;

		for (const { svg } of this.#drawn) {
			if (this.isSettled) {
				svg.remove();
			} else {
				fadeAway(svg);
			}
		}
	}

	/** Paints over the link's lines, or where they last were if it's since left the page. */
	paint(lines = this.#lines) {
		this.#lines = lines;

		while (this.#drawn.length > lines.length) {
			this.#drawn.pop()?.svg.remove();
		}

		for (const [index, { bottom, left, right }] of lines.entries()) {
			const line = (this.#drawn[index] ??= createLine(this.#layer));

			this.#paintLine(line, left, bottom, right - left);
		}
	}

	step(seconds: number, pointerX: number) {
		const highlightX = this.#highlightX ?? pointerX;

		this.#highlightX = followLight(highlightX, pointerX, seconds);
		this.#near = damp(this.#near, this.target, 10, seconds);
		this.#phase -= seconds * this.#near * this.#near * Math.PI * 1.8;
	}

	#paintLine(
		{ base, gradient, highlight, highlightMask, svg }: DrawnLine,
		left: number,
		bottom: number,
		width: number,
	) {
		const near = smoothstep(0, 1, this.#near);
		const path = drawWave({
			amplitude: amplitude * interpolate(restingHeight, 1, near),
			period,
			phase: this.#phase,
			width,
			y: center,
		});
		const thickness = String(this.#fontSize >= largeFontSize ? 2.5 : 2);

		svg.style.transform = `translate(${px(left)}, ${px(snap(bottom + this.#offset) - center)})`;
		svg.style.opacity = String(this.#rests && this.link.isConnected ? 1 : near);
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

	const gradient = createGradient(id, [
		["0", "var(--squiggleStart)"],
		["0.17", "var(--squiggleStart)"],
		["0.5", "var(--squiggleMiddle)"],
		["0.83", "var(--squiggleEnd)"],
		["1", "var(--squiggleEnd)"],
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
	const svg = createElement("svg", { height: "12" }, [
		gradient,
		highlightMask,
		base,
		highlight,
	]);

	layer.append(svg);

	return { base, gradient, highlight, highlightMask, svg };
}

/** How far a link's squiggle is below the bottom of each of its lines. */
function getOffset(link: HTMLElement) {
	const { content, height, marginTop } = getComputedStyle(link, "::after");

	return content === "none"
		? -0.5
		: parseFloat(marginTop) + parseFloat(height) / 2;
}

/** Rounds to whole screen pixels, as the browser does for static squiggles. */
function snap(value: number) {
	return Math.round(value * devicePixelRatio) / devicePixelRatio;
}
