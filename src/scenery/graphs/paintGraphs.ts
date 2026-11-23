import type { Column } from "../column";
import type { Point } from "../geometry";
import type { LivingGraph } from "./GraphSimulation";

import { angleToHue, depthColor, hueDriftRate } from "../color";
import { columnAlpha } from "../column";
import { interpolate, smoothstep } from "../math";
import { getEdgeReveal } from "./GraphSimulation";

export interface GraphScene {
	column: Column;
	isDark: boolean;

	/** Current pointer, which graphs are brightest near. */
	pointer: Point | undefined;

	seconds: number;
}

/** Snarks cycle through hues faster than everything else does. */
const snarkHueDriftRate = hueDriftRate * 1.5;

export function paintGraph(
	context: CanvasRenderingContext2D,
	graph: LivingGraph,
	offset: number,
	opacity: number,
	scene: GraphScene,
) {
	const centerY = graph.y - offset;
	const alpha =
		opacity *
		columnAlpha(graph.x, scene.column) *
		getPointerBoost(graph.x, centerY, scene.pointer);
	const reveals = graph.vertices.map(() => 0);

	context.lineCap = "round";

	for (const { from, order, to } of graph.edges) {
		const reveal = getEdgeReveal(graph, order);
		if (reveal <= 0) {
			continue;
		}

		const start = graph.vertices[from];
		const end = graph.vertices[to];
		const depth = (start.depth + end.depth) / 2;

		reveals[from] = Math.max(reveals[from], smoothstep(0, 0.3, reveal));
		reveals[to] = Math.max(reveals[to], smoothstep(0.7, 1, reveal));

		context.lineWidth = 0.4 + depth * depth * 2.4;
		context.globalAlpha = alpha * interpolate(0.2, 0.7, depth);
		context.strokeStyle = getColor(graph, start, depth, scene);
		context.beginPath();
		context.moveTo(graph.x + start.x, centerY + start.y);
		context.lineTo(
			graph.x + interpolate(start.x, end.x, reveal),
			centerY + interpolate(start.y, end.y, reveal),
		);
		context.stroke();
	}

	for (const [index, vertex] of graph.vertices.entries()) {
		if (!reveals[index]) {
			continue;
		}

		const radius =
			(0.8 + vertex.depth * 1.6) * (graph.isSnark ? 1.15 : 1) * reveals[index];

		context.fillStyle = getColor(graph, vertex, vertex.depth, scene);
		context.globalAlpha =
			alpha * reveals[index] * interpolate(0.35, 0.95, vertex.depth);
		context.beginPath();
		context.arc(graph.x + vertex.x, centerY + vertex.y, radius, 0, Math.PI * 2);
		context.fill();
	}
}

function getColor(
	graph: LivingGraph,
	{ x, y }: Point,
	depth: number,
	scene: GraphScene,
) {
	const hue = graph.isSnark
		? x * 1.2 + depth * 70 + scene.seconds * snarkHueDriftRate
		: angleToHue(graph.x + x - graph.origin.x, graph.y + y - graph.origin.y) +
			scene.seconds * hueDriftRate;

	return depthColor(hue, depth, scene.isDark);
}

function getPointerBoost(x: number, y: number, pointer: Point | undefined) {
	return pointer
		? interpolate(
				1.4,
				0.75,
				smoothstep(40, 320, Math.hypot(x - pointer.x, y - pointer.y)),
			)
		: 0.75;
}
