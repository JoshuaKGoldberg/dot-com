import type { Point } from "../geometry";
import type { Graph } from "./createGraph";

import { smoothstep } from "../math";

export interface LivingEdge {
	from: number;

	/** When in the graph's growth this edge starts, from 0 to 1. */
	order: number;

	to: number;
}

/** Portions of a graph's growth and dissolve that each individual edge takes. */
const growthPortion = 0.22;
const fadePortion = 0.3;

/** How much of an edge is drawn, from 0 to 1. Edges dissolve last in, first out. */
export function getEdgeReveal(
	{ fade, growth }: { fade: number; growth: number },
	order: number,
) {
	const growthStart = order * (1 - growthPortion);
	const fadeStart = (1 - order) * (1 - fadePortion);

	return (
		smoothstep(growthStart, growthStart + growthPortion, growth) *
		(1 - smoothstep(fadeStart, fadeStart + fadePortion, fade))
	);
}

/** Orders edges to grow outward from the vertex nearest to a point. */
export function orderEdges(
	graph: Graph,
	vertices: readonly Point[],
	from: Point,
): LivingEdge[] {
	const distances = vertices.map(({ x, y }) =>
		Math.hypot(x - from.x, y - from.y),
	);
	const steps = vertices.map(() => Infinity);
	const queue = [distances.indexOf(Math.min(...distances))];

	steps[queue[0]] = 0;

	for (const vertex of queue) {
		for (const edge of graph.edges) {
			if (!edge.includes(vertex)) {
				continue;
			}

			const other = edge[0] === vertex ? edge[1] : edge[0];

			if (steps[other] === Infinity) {
				steps[other] = steps[vertex] + 1;
				queue.push(other);
			}
		}
	}

	const maximum = Math.max(...steps) + 1;

	return graph.edges.map(([a, b]) => {
		const [start, end] = steps[a] <= steps[b] ? [a, b] : [b, a];

		return { from: start, order: steps[start] / maximum, to: end };
	});
}
