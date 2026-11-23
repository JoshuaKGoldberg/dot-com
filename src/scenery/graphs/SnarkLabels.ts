import type { Rectangle } from "../geometry";
import type { LivingGraph, Region, SnarkState } from "./GraphSimulation";

import { px } from "../css";
import { fadeAway } from "../fadeAway";
import { clamp, smoothstep } from "../math";

export interface PlacedGraph {
	graph: LivingGraph;
	region: Region;
}

interface Label {
	link: HTMLAnchorElement;
	width: number;
}

const href = "https://mathworld.wolfram.com/GoldbergSnark.html";

/** Space between snarks and their labels, and between labels and their region's sides. */
const margin = 8;

/** Links beneath snarks that are done growing, to what they are. */
export class SnarkLabels {
	readonly #host = document.querySelector<HTMLElement>("[data-snark-labels]");
	readonly #labels = new Map<LivingGraph, Label>();
	readonly #onRelease: () => void;

	/** @param onRelease Called when a snark's label stops being focused. */
	constructor(onRelease: () => void, signal: AbortSignal) {
		this.#onRelease = onRelease;
		signal.addEventListener("abort", () => {
			this.update([], 0);
		});
	}

	/** Moves labels to where their snarks now are, adding and removing any as needed. */
	update(placed: PlacedGraph[], height: number) {
		for (const [graph, { link }] of this.#labels) {
			if (!placed.some((other) => other.graph === graph)) {
				this.#labels.delete(graph);
				link.inert = true;
				fadeAway(link);
			}
		}

		for (const { graph, region } of placed) {
			const opacity = smoothstep(0.8, 1, graph.growth) * (1 - graph.fade);

			if (graph.snark && opacity > 0) {
				const label =
					this.#labels.get(graph) ??
					this.#create(graph, graph.snark, region.bounds);

				placeLabel(label, graph, region, height);
				label.link.style.opacity = opacity.toFixed(3);
			}
		}
	}

	#create(graph: LivingGraph, snark: SnarkState, { left, right }: Rectangle) {
		const link = document.createElement("a");

		link.href = href;
		link.style.maxWidth = px(right - left);
		link.target = "_blank";
		link.textContent = `Goldberg snark G${snark.blocks.toString()}`;
		link.addEventListener("focus", () => {
			snark.isFocused = true;
		});
		link.addEventListener("blur", () => {
			snark.isFocused = false;
			this.#onRelease();
		});

		this.#host?.append(link);

		const label = { link, width: link.offsetWidth };

		this.#labels.set(graph, label);

		return label;
	}
}

function placeLabel(
	{ link, width }: Label,
	{ radius, x, y }: LivingGraph,
	{ bounds, offset }: Region,
	height: number,
) {
	const left = clamp(x - width / 2, bounds.left, bounds.right - width);
	const top = y - offset + radius + margin;

	// Anything that's focusable should be somewhere it can be seen
	link.hidden = top < 0 || top > height;
	link.style.translate = `${px(left)} ${px(top)}`;
}
