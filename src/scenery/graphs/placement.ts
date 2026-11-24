import type { Random } from "../random";
import type { Region } from "./createRegions";

import { getDistance, type Point } from "../geometry";
import { clamp, interpolate } from "../math";

export interface GraphSize {
	/** Distance from its center that other graphs, and text, aren't within. */
	clearance: number;

	radius: number;
}

/** Where a graph's center is on screen, and how far around it is kept clear. */
export interface Placement extends Point {
	clearance: number;
}

/** Pixels between places considered for the nearest one. */
const searchStep = 24;

export function findNearestPlacement(
	region: Region,
	{ clearance, radius }: GraphSize,
	pointer: Point,
	obstacles: readonly Placement[],
) {
	const { bounds } = region;
	let nearest: Placement | undefined;
	let nearestDistance = Infinity;

	for (
		let x = bounds.left + radius;
		x <= bounds.right - radius;
		x += searchStep
	) {
		for (
			let y = bounds.top + clearance;
			y <= bounds.bottom - clearance;
			y += searchStep
		) {
			const placement = { clearance, x, y };
			const distance = Math.hypot(x - pointer.x, y - pointer.y);

			if (distance < nearestDistance && isFree(placement, region, obstacles)) {
				nearest = placement;
				nearestDistance = distance;
			}
		}
	}

	return nearest;
}

export function findRandomPlacement(
	random: Random,
	region: Region,
	{ clearance, radius }: GraphSize,
	pointer: Point,
	obstacles: readonly Placement[],
	spread = 1,
) {
	const { bounds } = region;

	if (
		bounds.right - bounds.left < radius * 2 ||
		bounds.bottom - bounds.top < clearance * 2
	) {
		return undefined;
	}

	for (let attempt = 0; attempt < 12; attempt += 1) {
		const angle = random() * Math.PI * 2;
		const distance =
			spread *
			(random() < 0.85
				? interpolate(30, 120, random())
				: interpolate(120, 320, random()));
		const placement = {
			clearance,
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

		if (isFree(placement, region, obstacles)) {
			return placement;
		}
	}

	return undefined;
}

export function isTouching(a: Placement, b: Placement) {
	return Math.hypot(a.x - b.x, a.y - b.y) <= a.clearance + b.clearance;
}

function isFree(
	placement: Placement,
	{ avoid }: Region,
	obstacles: readonly Placement[],
) {
	return (
		!(avoid && getDistance(placement, avoid) < placement.clearance) &&
		!obstacles.some((obstacle) => isTouching(obstacle, placement))
	);
}
