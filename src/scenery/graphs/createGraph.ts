import type { Random } from "../random";

import { interpolate } from "../math";
import { pick } from "../random";

export interface Graph {
	edges: (readonly [number, number])[];
	vertices: Vertex[];
}

/** A position within a unit circle, and a depth from 0 (far) to 1 (near). */
export interface Vertex {
	depth: number;
	x: number;
	y: number;
}

const graphCreators = [
	createTree,
	createTree,
	createCycle,
	createWeb,
	createWeb,
];

export function createGraph(random: Random) {
	return fitToUnitCircle(pick(random, graphCreators)(random));
}

function createCycle(random: Random): Graph {
	const count = 4 + Math.floor(random() * 5);
	const vertices = Array.from({ length: count }, (_, i) =>
		createVertex(
			random,
			(i / count) * Math.PI * 2 + (random() - 0.5) * 0.3,
			0.8 + random() * 0.3,
		),
	);
	const edges = vertices.map((_, i) => [i, (i + 1) % count] as const);

	if (count >= 6 && random() < 0.55) {
		edges.push([0, Math.floor(count / 2)]);
	}

	return { edges, vertices };
}

function createTree(random: Random): Graph {
	const count = 4 + Math.floor(random() * 6);
	const edges: [number, number][] = [];
	const vertices = [createVertex(random, 0, 0)];

	for (let i = 1; i < count; i += 1) {
		const parent = Math.floor(random() * i);
		const offset = createVertex(
			random,
			random() * Math.PI * 2,
			0.45 + random() * 0.45,
		);

		edges.push([parent, i]);
		vertices.push({
			depth: offset.depth,
			x: vertices[parent].x + offset.x,
			y: vertices[parent].y + offset.y,
		});
	}

	return { edges, vertices };
}

function createVertex(random: Random, angle: number, distance: number): Vertex {
	return {
		depth: interpolate(0.1, 0.9, random()),
		x: Math.cos(angle) * distance,
		y: Math.sin(angle) * distance,
	};
}

function createWeb(random: Random): Graph {
	const count = 4 + Math.floor(random() * 6);
	const edges: [number, number][] = [];
	const vertices: Vertex[] = [];

	for (let i = 0; i < count; i += 1) {
		const vertex = createVertex(
			random,
			random() * Math.PI * 2,
			Math.sqrt(random()) * 1.1,
		);
		const neighbors = vertices
			.map((other, index) => ({
				distance: Math.hypot(other.x - vertex.x, other.y - vertex.y),
				index,
			}))
			.sort((a, b) => a.distance - b.distance)
			.slice(0, random() < 0.6 ? 2 : 1);

		edges.push(...neighbors.map(({ index }): [number, number] => [index, i]));
		vertices.push(vertex);
	}

	return { edges, vertices };
}

function fitToUnitCircle({ edges, vertices }: Graph): Graph {
	const extent = Math.max(...vertices.map(({ x, y }) => Math.hypot(x, y)));

	return {
		edges,
		vertices: vertices.map(({ depth, x, y }) => ({
			depth,
			x: x / extent,
			y: y / extent,
		})),
	};
}
