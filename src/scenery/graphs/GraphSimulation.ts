import type { Point, Rectangle } from "../geometry";
import type { Graph } from "./createGraph";

import { clamp, interpolate, smoothstep } from "../math";
import { pick, type Random } from "../random";
import { createGoldbergSnark } from "./createGoldbergSnark";
import { createGraph } from "./createGraph";

export interface GraphPointer extends Point {
	/** Whether it's over the page, no matter how long it's been still for. */
	isInside: boolean;

	/** Whether it's over the page, and has moved recently. */
	isPresent: boolean;
}

/**
 * A graph that grows out from near the pointer, stays a while, then dissolves.
 *
 * Its vertices never move relative to each other, so no matter how the page
 * scrolls, none of its edges can ever stretch.
 */
export interface LivingGraph {
	/** Distance from its center that other graphs, and text, aren't within. */
	clearance: number;

	edges: LivingEdge[];

	/** How dissolved the graph is, from 0 to 1. */
	fade: number;

	fadeSeconds: number;

	/** How grown the graph is, from 0 to 1. */
	growSeconds: number;

	growth: number;

	/** How much longer the graph stays once it's grown. */
	holdSeconds: number;

	/** How much dwell its region needs for the graph not to dissolve. */
	minimumDwell: number;

	/** Where the pointer was when the graph started growing. */
	origin: Point;

	radius: number;
	region: RegionName;
	snark?: SnarkState | undefined;
	vertices: LivingVertex[];

	/** Center of the graph, with y relative to the region's scrolling layer. */
	x: number;
	y: number;
}

export interface SnarkState {
	/** Seconds since it started growing. */
	age: number;

	/** Seconds that the pointer's now been far away from it for. */
	awaySeconds: number;

	blocks: number;

	/** Whether its label is focused, which it stays for. */
	isFocused: boolean;
}

/** Somewhere on screen that graphs may grow. */
export interface Region {
	/** Areas to keep clear, such as text. */
	avoid?: Rectangle | undefined;
	bounds: Rectangle;

	/** How much the pointer has lingered in the region, from 0 to 1. */
	dwell: number;

	/** Most small graphs to have at once. */
	limit: number;

	name: RegionName;

	/** Pixels the region's contents have scrolled up by. */
	offset: number;

	/** Small graphs per second at full dwell. */
	rate: number;
}

export type RegionName = "bottom" | "left" | "right";

interface LivingEdge {
	from: number;

	/** When in the graph's growth this edge starts, from 0 to 1. */
	order: number;

	to: number;
}

interface LivingVertex extends Point {
	depth: number;
}

interface Placement extends Point {
	clearance: number;
	radius: number;
}

interface RegionState {
	dwelled: number;
	nextSnarkAt: number;
	pending: number;
}

/** Portion of a graph's growth that each individual edge takes. */
const edgeGrowth = 0.22;

/** Portion of a graph's dissolve that each individual edge takes. */
const edgeFade = 0.3;

/** Along with how long dwelling takes to start, so that there's one within 10 seconds. */
const secondsBeforeSnark = 8;

const secondsBetweenSnarks = 16.5;

/** Distance between places considered for snarks, in pixels. */
const snarkSearchStep = 24;

const snarkBlocks = [5, 7, 9];

/** Most snarks to have at once in a region. */
const snarkLimit = 3;

/** Space around snarks that's left for the labels beneath them. */
const snarkLabelSpace = 28;

/** Snarks stay at least this long, then until the pointer's been far away for a while. */
const snarkMinimumSeconds = 30;
const snarkAwaySeconds = 10;

/** Distance from a snark's edge, in pixels, that counts as far away. */
const snarkAwayDistance = 250;

export class GraphSimulation {
	graphs: LivingGraph[] = [];

	readonly #random: Random;
	readonly #states = new Map<RegionName, RegionState>();

	constructor(random: Random) {
		this.#random = random;
	}

	clear() {
		this.graphs = [];
		this.#states.clear();
	}

	/** Whether there's anything that changes while the pointer is as it is. */
	isActive(pointer: GraphPointer) {
		return this.graphs.some(
			({ fade, growth, snark }) =>
				!snark ||
				pointer.isPresent ||
				fade > 0 ||
				growth < 1 ||
				snark.age < snarkMinimumSeconds ||
				snark.awaySeconds > 0,
		);
	}

	/** Advances all graphs, and grows new ones wherever the pointer is lingering. */
	step(
		seconds: number,
		regions: readonly Region[],
		viewport: { height: number },
		pointer: GraphPointer,
	) {
		this.graphs = this.graphs.filter((graph) => {
			const region = regions.find(({ name }) => name === graph.region);

			return (
				region &&
				(graph.snark
					? ageSnark(graph, graph.snark, seconds, region, pointer)
					: isOnScreen(graph, region, viewport) &&
						ageGraph(graph, seconds, region.dwell))
			);
		});

		for (const region of regions) {
			this.#spawn(seconds, region, pointer.isPresent ? pointer : undefined);
		}
	}

	#create(
		graph: Graph,
		snark: SnarkState | undefined,
		placement: Placement,
		origin: Point,
		region: Region,
	) {
		const random = this.#random;
		const rotation = random() * Math.PI * 2;
		const tilt = interpolate(0.75, 1, random());
		const vertices = graph.vertices.map(({ depth, x, y }) => ({
			depth,
			x: (x * Math.cos(rotation) - y * Math.sin(rotation)) * placement.radius,
			y:
				(x * Math.sin(rotation) + y * Math.cos(rotation)) *
				tilt *
				placement.radius,
		}));

		this.graphs.push({
			clearance: placement.clearance,
			edges: orderEdges(graph, vertices, {
				x: origin.x - placement.x,
				y: origin.y - placement.y,
			}),
			fade: 0,
			fadeSeconds: snark ? 5.5 : 3.2,
			growSeconds: snark
				? interpolate(5.3, 7.3, random())
				: interpolate(5, 11, random()),
			growth: 0,
			holdSeconds: interpolate(3, 10, random()),
			minimumDwell: interpolate(0.03, 0.4, random()),
			origin: { x: origin.x, y: origin.y + region.offset },
			radius: placement.radius,
			region: region.name,
			snark,
			vertices,
			x: placement.x,
			y: placement.y + region.offset,
		});
	}

	#findPlacement(
		region: Region,
		radius: number,
		pointer: Point,
		clearance = radius,
	): Placement | undefined {
		const { bounds } = region;

		if (
			bounds.right - bounds.left < radius * 2 ||
			bounds.bottom - bounds.top < clearance * 2
		) {
			return undefined;
		}

		for (let attempt = 0; attempt < 12; attempt += 1) {
			const angle = this.#random() * Math.PI * 2;
			const distance =
				this.#random() < 0.85
					? interpolate(30, 120, this.#random())
					: interpolate(120, 320, this.#random());
			const placement = {
				clearance,
				radius,
				x: clamp(
					pointer.x + Math.cos(angle) * distance,
					bounds.left + radius,
					bounds.right - radius,
				),
				y: clamp(
					pointer.y + Math.sin(angle) * distance,
					bounds.top + clearance,
					bounds.bottom - clearance,
				),
			};

			if (this.#isFree(placement, region)) {
				return placement;
			}
		}

		return undefined;
	}

	#isFree(placement: Placement, region: Region) {
		return (
			!(region.avoid && overlaps(placement, region.avoid)) &&
			!this.graphs.some((graph) => isTouching(graph, placement, region))
		);
	}

	/**
	 * Finds the nearest place that only small graphs are in the way of, if any,
	 * and has those start to dissolve.
	 */
	#makeRoom(
		region: Region,
		radius: number,
		pointer: Point,
		clearance: number,
	): Placement | undefined {
		const { avoid, bounds } = region;
		const snarks = this.graphs.filter(({ snark }) => snark);
		let nearest: Placement | undefined;
		let nearestDistance = Infinity;

		for (
			let x = bounds.left + radius;
			x <= bounds.right - radius;
			x += snarkSearchStep
		) {
			for (
				let y = bounds.top + clearance;
				y <= bounds.bottom - clearance;
				y += snarkSearchStep
			) {
				const placement = { clearance, radius, x, y };
				const distance = Math.hypot(x - pointer.x, y - pointer.y);

				if (
					distance < nearestDistance &&
					!(avoid && overlaps(placement, avoid)) &&
					!snarks.some((snark) => isTouching(snark, placement, region))
				) {
					nearest = placement;
					nearestDistance = distance;
				}
			}
		}

		if (nearest) {
			for (const graph of this.graphs) {
				if (isTouching(graph, nearest, region)) {
					graph.holdSeconds = 0;
				}
			}
		}

		return nearest;
	}

	#spawn(seconds: number, region: Region, pointer: Point | undefined) {
		const state = getOrCreateState(this.#states, region.name);

		if (!pointer || region.dwell < 0.05) {
			state.dwelled = 0;
			state.nextSnarkAt = secondsBeforeSnark;

			return;
		}

		state.dwelled += seconds;
		state.pending +=
			seconds * region.rate * smoothstep(0.04, 0.45, region.dwell);

		if (state.dwelled > state.nextSnarkAt) {
			const radius = Math.min(
				88,
				(region.bounds.right - region.bounds.left) * 0.42,
			);
			const clearance = radius + snarkLabelSpace;
			const snarks = this.graphs.filter(
				(graph) => graph.region === region.name && graph.snark,
			);
			const placement =
				snarks.length < snarkLimit
					? (this.#findPlacement(region, radius, pointer, clearance) ??
						this.#makeRoom(region, radius, pointer, clearance))
					: undefined;

			state.nextSnarkAt =
				state.dwelled + (placement ? secondsBetweenSnarks : 2);

			if (placement) {
				const blocks = pick(this.#random, snarkBlocks);

				this.#create(
					createGoldbergSnark(blocks),
					{ age: 0, awaySeconds: 0, blocks, isFocused: false },
					placement,
					pointer,
					region,
				);
			}
		}

		if (state.pending < 1) {
			return;
		}

		state.pending = 0;

		const siblings = this.graphs.filter(
			(graph) => graph.region === region.name && !graph.snark,
		);
		const placement =
			siblings.length < region.limit &&
			this.#findPlacement(region, interpolate(16, 38, this.#random()), pointer);

		if (placement) {
			this.#create(
				createGraph(this.#random),
				undefined,
				placement,
				pointer,
				region,
			);
		}
	}
}

/** How much of an edge is drawn, from 0 to 1. Edges dissolve last in, first out. */
export function getEdgeReveal({ fade, growth }: LivingGraph, order: number) {
	const grown = smoothstep(
		order * (1 - edgeGrowth),
		order * (1 - edgeGrowth) + edgeGrowth,
		growth,
	);
	const faded = smoothstep(
		(1 - order) * (1 - edgeFade),
		(1 - order) * (1 - edgeFade) + edgeFade,
		fade,
	);

	return grown * (1 - faded);
}

/** Ages a graph, returning whether there's still any of it left. */
function ageGraph(graph: LivingGraph, seconds: number, dwell: number) {
	if (dwell < graph.minimumDwell || graph.holdSeconds <= 0) {
		graph.fade += seconds / graph.fadeSeconds;
	} else if (graph.growth < 1) {
		graph.growth = Math.min(
			1,
			graph.growth + (seconds / graph.growSeconds) * interpolate(0.4, 1, dwell),
		);
	} else {
		graph.holdSeconds -= seconds;
	}

	return graph.fade < 1;
}

/** Ages a snark, returning whether there's still any of it left. */
function ageSnark(
	graph: LivingGraph,
	snark: SnarkState,
	seconds: number,
	{ offset }: Region,
	pointer: GraphPointer,
) {
	const isAway =
		!snark.isFocused &&
		(!pointer.isInside ||
			Math.hypot(graph.x - pointer.x, graph.y - offset - pointer.y) >
				graph.radius + snarkAwayDistance);

	snark.age += seconds;
	snark.awaySeconds = isAway ? snark.awaySeconds + seconds : 0;

	if (
		graph.fade > 0 ||
		(snark.age > snarkMinimumSeconds && snark.awaySeconds > snarkAwaySeconds)
	) {
		graph.fade += seconds / graph.fadeSeconds;
	} else {
		graph.growth = Math.min(1, graph.growth + seconds / graph.growSeconds);
	}

	return graph.fade < 1;
}

function getOrCreateState(
	states: Map<RegionName, RegionState>,
	name: RegionName,
) {
	const existing = states.get(name);
	if (existing) {
		return existing;
	}

	const created = {
		dwelled: 0,
		nextSnarkAt: secondsBeforeSnark,
		pending: 0.7,
	};
	states.set(name, created);

	return created;
}

function isOnScreen(
	{ radius, y }: LivingGraph,
	{ offset }: Region,
	{ height }: { height: number },
) {
	return y - offset > -radius && y - offset < height + radius;
}

function isTouching(
	graph: LivingGraph,
	{ clearance, x, y }: Placement,
	{ offset }: Region,
) {
	return (
		Math.hypot(graph.x - x, graph.y - offset - y) <= graph.clearance + clearance
	);
}

/** Orders edges to grow outward from the vertex nearest to a point. */
function orderEdges(
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

function overlaps({ clearance, x, y }: Placement, rectangle: Rectangle) {
	return (
		Math.hypot(
			x - clamp(x, rectangle.left, rectangle.right),
			y - clamp(y, rectangle.top, rectangle.bottom),
		) < clearance
	);
}
