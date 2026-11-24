import { CachedFactory } from "cached-factory";

import type { Point } from "../geometry";
import type { pointer as pagePointer } from "../pointer";
import type { Region, RegionName, Regions } from "./createRegions";

import { damp, interpolate, moveToward, smoothstep } from "../math";
import { pick, type Random } from "../random";
import { createGoldbergSnark, snarkBlocks } from "./createGoldbergSnark";
import { createGraph, type Graph, type Vertex } from "./createGraph";
import { type LivingEdge, orderEdges } from "./edges";
import {
	findNearestPlacement,
	findRandomPlacement,
	type GraphSize,
	isTouching,
	type Placement,
} from "./placement";

export type GraphPointer = Readonly<typeof pagePointer>;

export type LivingGraph = SmallGraph | Snark;

export interface Snark extends LivingGraphBase {
	ageSeconds: number;

	awaySeconds: number;

	blocks: number;

	isFading: boolean;

	/** Whether its label is focused or hovered, which keeps it from fading. */
	isHeld: boolean;

	kind: "snark";
}

/**
 * A graph that grows out from near the pointer, stays a while, then dissolves.
 *
 * Its vertices never move relative to each other, so no matter how the page
 * scrolls, none of its edges can ever stretch.
 */
interface LivingGraphBase extends GraphSize {
	/** Smoothed brightness, higher near the pointer. */
	boost: number;

	edges: LivingEdge[];

	/** From 0 to 1. */
	fade: number;

	/** From 0 to 1. */
	growth: number;

	growthSeconds: number;

	/** Where the pointer was when the graph started growing. */
	origin: Point;

	region: RegionName;
	vertices: Vertex[];

	/** Center of the graph, with y relative to the region's scrolling layer. */
	x: number;
	y: number;
}

interface RegionState {
	dwelledSeconds: number;
	nextSnarkAt: number;

	/** Portion of the next small graph that it's time for. */
	pending: number;
}

interface SmallGraph extends LivingGraphBase {
	holdSeconds: number;

	kind: "small";

	/** Below this much dwell in its region, it dissolves. */
	minimumDwell: number;
}

const smallGraphFadeSeconds = 3.2;
const snarkFadeSeconds = 5.5;

const minimumLingering = 0.05;

/** Reaching minimumLingering takes about 1.4 seconds, and snarks start within 10. */
const secondsBeforeSnark = 8;

const secondsBetweenSnarks = 16.5;

/** If there wasn't anywhere for a snark. */
const secondsBeforeRetry = 2;

const snarksPerRegion = 3;

const maximumSnarkRadius = 88;
const minimumSnarkRadius = 28;

const snarkLabelSpace = 28;

/** Snarks stay at least this long, then until the pointer's been far away for a while. */
const snarkMinimumSeconds = 30;
const snarkAwaySeconds = 10;

/** Pixels from a snark's edge that count as far away. */
const snarkAwayDistance = 250;

/** Farthest that pointers might have moved from where they were when a snark grew. */
const snarkOriginDrift = 40;

export class GraphSimulation {
	graphs: LivingGraph[] = [];

	readonly #random: Random;
	#regions: Regions = new Map();

	/** From least to most recently visible. */
	readonly #shownBlocks = new Set<number>();

	readonly #states = new CachedFactory<RegionName, RegionState>(() => ({
		dwelledSeconds: 0,
		nextSnarkAt: secondsBeforeSnark,
		pending: 0.7,
	}));

	constructor(random: Random) {
		this.#random = random;
	}

	clear() {
		this.graphs = [];
		this.#states.clear();
	}

	/** Whether anything would change if the pointer stayed still. */
	isActive(pointer: GraphPointer) {
		return this.graphs.some(
			(graph) =>
				graph.kind === "small" ||
				pointer.isPresent ||
				graph.fade > 0 ||
				graph.growth < 1 ||
				graph.ageSeconds < snarkMinimumSeconds ||
				graph.awaySeconds > 0,
		);
	}

	step(
		seconds: number,
		regions: Regions,
		viewportHeight: number,
		pointer: GraphPointer,
	) {
		this.#regions = regions;
		this.graphs = this.graphs.filter((graph) => {
			const region = regions.get(graph.region);
			if (!region) {
				return false;
			}

			const { x, y } = this.#getPlacement(graph);
			const distance = pointer.isInside
				? Math.hypot(x - pointer.x, y - pointer.y)
				: Infinity;

			graph.boost = damp(
				graph.boost,
				interpolate(1.4, 0.75, smoothstep(40, 320, distance)),
				5,
				seconds,
			);

			return graph.kind === "snark"
				? ageSnark(graph, seconds, distance)
				: y > -graph.radius &&
						y < viewportHeight + graph.radius &&
						ageSmallGraph(graph, seconds, region.dwell);
		});

		for (const [name, region] of regions) {
			this.#spawn(seconds, name, region, pointer);
		}

		for (const graph of this.graphs) {
			if (graph.kind === "snark") {
				this.#shownBlocks.delete(graph.blocks);
				this.#shownBlocks.add(graph.blocks);
			}
		}
	}

	#createBase(
		graph: Graph,
		{ clearance, radius }: GraphSize,
		placement: Placement,
		{ x, y }: Point,
		name: RegionName,
		{ offset }: Region,
	) {
		const random = this.#random;
		const rotation = random() * Math.PI * 2;
		const tilt = interpolate(0.75, 1, random());
		const vertices = graph.vertices.map((vertex) => ({
			depth: vertex.depth,
			x:
				(vertex.x * Math.cos(rotation) - vertex.y * Math.sin(rotation)) *
				radius,
			y:
				(vertex.x * Math.sin(rotation) + vertex.y * Math.cos(rotation)) *
				tilt *
				radius,
		}));

		return {
			boost: 1,
			clearance,
			edges: orderEdges(graph, vertices, {
				x: x - placement.x,
				y: y - placement.y,
			}),
			fade: 0,
			growth: 0,
			origin: { x, y: y + offset },
			radius,
			region: name,
			vertices,
			x: placement.x,
			y: placement.y + offset,
		};
	}

	#getPlacement({ clearance, region, x, y }: LivingGraph): Placement {
		return {
			clearance,
			x,
			y: y - (this.#regions.get(region)?.offset ?? 0),
		};
	}

	#growSmallGraph(name: RegionName, region: Region, pointer: Point) {
		const radius = interpolate(16, 38, this.#random());
		const size = { clearance: radius, radius };
		const placement = findRandomPlacement(
			this.#random,
			region,
			size,
			pointer,
			this.graphs.map((graph) => this.#getPlacement(graph)),
			region.spread,
		);

		if (placement) {
			this.graphs.push({
				...this.#createBase(
					createGraph(this.#random),
					size,
					placement,
					pointer,
					name,
					region,
				),
				growthSeconds: interpolate(5, 11, this.#random()),
				holdSeconds: interpolate(3, 10, this.#random()),
				kind: "small",
				minimumDwell: interpolate(0.03, 0.4, this.#random()),
			});
		}
	}

	/** @returns Whether there was anywhere for it. */
	#growSnark(name: RegionName, region: Region, pointer: Point) {
		const size = getSnarkSize(region);
		if (size.radius < minimumSnarkRadius) {
			return false;
		}

		const placement =
			findRandomPlacement(
				this.#random,
				region,
				size,
				pointer,
				this.graphs.map((graph) => this.#getPlacement(graph)),
			) ?? this.#makeRoom(region, size, pointer);

		if (!placement) {
			return false;
		}

		const blocks = this.#pickBlocks();

		this.#shownBlocks.add(blocks);
		this.graphs.push({
			...this.#createBase(
				createGoldbergSnark(blocks),
				size,
				placement,
				pointer,
				name,
				region,
			),
			ageSeconds: 0,
			awaySeconds: 0,
			blocks,
			growthSeconds: interpolate(5.3, 7.3, this.#random()),
			isFading: false,
			isHeld: false,
			kind: "snark",
		});

		return true;
	}

	/** Has any small graphs that are in the way of the nearest place start to dissolve. */
	#makeRoom(region: Region, size: GraphSize, pointer: Point) {
		const placement = findNearestPlacement(
			region,
			size,
			pointer,
			this.graphs
				.filter(({ kind }) => kind === "snark")
				.map((graph) => this.#getPlacement(graph)),
		);

		if (placement) {
			for (const graph of this.graphs) {
				if (
					graph.kind === "small" &&
					isTouching(this.#getPlacement(graph), placement)
				) {
					graph.holdSeconds = 0;
				}
			}
		}

		return placement;
	}

	#pickBlocks() {
		const shown = [...this.#shownBlocks];
		const fresh = snarkBlocks.filter((blocks) => !shown.includes(blocks));
		const gone = shown.filter(
			(blocks) =>
				!this.graphs.some(
					(graph) => graph.kind === "snark" && graph.blocks === blocks,
				),
		);
		const options = [fresh, gone.slice(0, -1), gone];

		return pick(
			this.#random,
			options.find(({ length }) => length > 0) ?? snarkBlocks,
		);
	}

	#spawn(
		seconds: number,
		name: RegionName,
		region: Region,
		pointer: GraphPointer,
	) {
		const state = this.#states.get(name);

		if (!pointer.isPresent || region.dwell < minimumLingering) {
			state.dwelledSeconds = 0;
			state.nextSnarkAt = secondsBeforeSnark;

			return;
		}

		const siblings = this.graphs.filter((graph) => graph.region === name);
		const snarks = siblings.filter(({ kind }) => kind === "snark");

		state.dwelledSeconds += seconds;
		state.pending +=
			seconds *
			region.smallGraphsPerSecond *
			smoothstep(0.04, 0.45, region.dwell);

		if (state.dwelledSeconds > state.nextSnarkAt) {
			const hasGrown =
				snarks.length < snarksPerRegion &&
				this.#growSnark(name, region, pointer);

			state.nextSnarkAt =
				state.dwelledSeconds +
				(hasGrown ? secondsBetweenSnarks : secondsBeforeRetry);
		}

		if (state.pending >= 1) {
			state.pending -= 1;

			if (siblings.length - snarks.length < region.smallGraphLimit) {
				this.#growSmallGraph(name, region, pointer);
			}
		}
	}
}

/** @returns Whether there's still any of it left. */
function ageSmallGraph(graph: SmallGraph, seconds: number, dwell: number) {
	if (dwell < graph.minimumDwell || graph.holdSeconds <= 0) {
		graph.fade += seconds / smallGraphFadeSeconds;
	} else if (graph.growth < 1) {
		graph.growth = Math.min(
			1,
			graph.growth +
				(seconds / graph.growthSeconds) * interpolate(0.4, 1, dwell),
		);
	} else {
		graph.holdSeconds -= seconds;
	}

	return graph.fade < 1;
}

/** @returns Whether there's still any of it left. */
function ageSnark(snark: Snark, seconds: number, pointerDistance: number) {
	const grownFrom = Math.hypot(
		snark.x - snark.origin.x,
		snark.y - snark.origin.y,
	);
	const isAway =
		!snark.isHeld &&
		pointerDistance >
			Math.max(snark.radius + snarkAwayDistance, grownFrom + snarkOriginDrift);

	snark.ageSeconds += seconds;
	snark.awaySeconds = isAway ? snark.awaySeconds + seconds : 0;

	if (snark.isHeld || pointerDistance < snark.radius) {
		snark.isFading = false;
	} else if (
		snark.ageSeconds > snarkMinimumSeconds &&
		snark.awaySeconds > snarkAwaySeconds
	) {
		snark.isFading = true;
	}

	if (snark.isFading || snark.fade > 0) {
		snark.fade = moveToward(
			snark.fade,
			Number(snark.isFading),
			seconds / snarkFadeSeconds,
		);
	} else {
		snark.growth = Math.min(1, snark.growth + seconds / snark.growthSeconds);
	}

	return snark.fade < 1;
}

function getSnarkSize({ bounds }: Region): GraphSize {
	const radius = Math.min(
		maximumSnarkRadius,
		(bounds.right - bounds.left) * 0.42,
		(bounds.bottom - bounds.top) / 2 - snarkLabelSpace,
	);

	return { clearance: radius + snarkLabelSpace, radius };
}
