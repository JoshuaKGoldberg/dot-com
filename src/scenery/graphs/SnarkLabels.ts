import type { Region } from "./createRegions";
import type { LivingGraph, Snark } from "./GraphSimulation";

import { px } from "../css";
import { fadeAway } from "../fadeAway";
import { clamp, smoothstep } from "../math";

export interface PlacedGraph {
	graph: LivingGraph;
	region: Region;
}

interface Label {
	height: number;
	link: HTMLAnchorElement;
	width: number;
}

const spaceBelowSnark = 8;

export class SnarkLabels {
	readonly #host = document.querySelector<HTMLElement>("[data-snark-labels]");
	readonly #labels = new Map<Snark, Label>();
	readonly #onBlur: () => void;

	constructor(onBlur: () => void, signal: AbortSignal) {
		this.#onBlur = onBlur;
		signal.addEventListener("abort", () => {
			this.update([], 0);
		});
	}

	update(placed: PlacedGraph[], viewportHeight: number) {
		for (const [graph, { link }] of this.#labels) {
			if (!placed.some((other) => other.graph === graph)) {
				this.#labels.delete(graph);
				link.inert = true;
				fadeAway(link);
			}
		}

		for (const { graph, region } of placed) {
			const opacity = smoothstep(0.8, 1, graph.growth) * (1 - graph.fade);

			if (graph.kind === "snark" && opacity > 0) {
				const label = this.#labels.get(graph) ?? this.#create(graph, region);

				placeLabel(label, graph, region, viewportHeight);
				label.link.style.opacity = opacity.toFixed(3);
			}
		}
	}

	#create(snark: Snark, { bounds }: Region) {
		const link = document.createElement("a");

		link.href = `https://goldbergsnarks.com/g${snark.blocks.toString()}`;
		link.style.maxWidth = px(bounds.right - bounds.left);
		link.target = "_blank";
		link.textContent = `Goldberg snark G${snark.blocks.toString()}`;
		link.addEventListener("focus", () => {
			snark.isFocused = true;
		});
		link.addEventListener("blur", () => {
			snark.isFocused = false;
			this.#onBlur();
		});

		this.#host?.append(link);

		const label = { height: link.offsetHeight, link, width: link.offsetWidth };

		this.#labels.set(snark, label);

		return label;
	}
}

function placeLabel(
	{ height, link, width }: Label,
	{ isFocused, radius, x, y }: Snark,
	{ bounds, offset }: Region,
	viewportHeight: number,
) {
	const left = clamp(x - width / 2, bounds.left, bounds.right - width);
	const top = y - offset + radius + spaceBelowSnark;

	// Anything that can become focused should be somewhere it can be seen
	link.hidden = !isFocused && (top < -height || top > viewportHeight);
	link.style.translate = `${px(left)} ${px(top)}`;
}
