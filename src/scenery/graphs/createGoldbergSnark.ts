import type { Graph, Vertex } from "./createGraph";

const blockSize = 8;

/** One of a snark's repeating blocks, if it pointed upward. */
const block: { angle: number; depth: number; radius: number }[] = [
	{ angle: -0.34, depth: 0.5, radius: 0.85 },
	{ angle: 0.29, depth: 0.36, radius: 1 },
	{ angle: 0.12, depth: 0.54, radius: 0.79 },
	{ angle: 0.05, depth: 0.7, radius: 0.55 },
	{ angle: -0.05, depth: 0.57, radius: 0.75 },
	{ angle: -0.29, depth: 0.63, radius: 0.68 },
	{ angle: 0.37, depth: 0.63, radius: 0.68 },
	{ angle: 0.04, depth: 0.8, radius: 0.31 },
];

const edgesWithinBlock = [
	[0, 1],
	[0, 4],
	[1, 2],
	[2, 3],
	[2, 5],
	[3, 4],
	[3, 7],
	[4, 6],
	[5, 6],
];

const edgesToNextBlock = [
	[1, 0],
	[6, 5],
	[7, 7],
];

/**
 * Creates the Goldberg snark with an odd number of blocks, at least five.
 * @see https://mathworld.wolfram.com/GoldbergSnark.html
 */
export function createGoldbergSnark(blocks: number): Graph {
	const edges: [number, number][] = [];
	const vertices: Vertex[] = [];

	for (let i = 0; i < blocks; i += 1) {
		const start = i * blockSize;
		const nextStart = ((i + 1) % blocks) * blockSize;

		for (const { angle, depth, radius } of block) {
			// Blocks are narrower the more of them there are to fit
			const turned = (angle * 5) / blocks + (i / blocks) * Math.PI * 2;

			vertices.push({
				depth,
				x: Math.sin(turned) * radius,
				y: -Math.cos(turned) * radius,
			});
		}

		for (const [from, to] of edgesWithinBlock) {
			edges.push([start + from, start + to]);
		}

		for (const [from, to] of edgesToNextBlock) {
			edges.push([start + from, nextStart + to]);
		}
	}

	return { edges, vertices };
}
