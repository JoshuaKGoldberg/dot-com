import type { Rectangle } from "../geometry";

import { type Column, type Margin, minimumMargin } from "../column";
import { footerDwell } from "../footerDwell";

export interface FooterBounds {
	aurora: Rectangle;
	footer: Rectangle;
	text: Rectangle;
}

export interface Region {
	avoid?: Rectangle;
	bounds: Rectangle;
	dwell: number;

	/** Pixels the region's contents have scrolled up by. */
	offset: number;

	smallGraphLimit: number;

	/** At full dwell. */
	smallGraphsPerSecond: number;

	/** How many times farther than usual from the pointer small graphs may be. */
	spread: number;
}

export type RegionName = "bottom" | Margin;

export type Regions = ReadonlyMap<RegionName, Region>;

interface RegionContext {
	column: Column;
	dwell: Record<Margin, number>;
	footer: FooterBounds | undefined;
	height: number;
	marginOffset: number;
	spread: Record<Margin, number>;
	width: number;
}

export function createRegions({
	column,
	dwell,
	footer,
	height,
	marginOffset,
	spread,
	width,
}: RegionContext): Regions {
	const getMargin = (name: Margin) => ({
		dwell: dwell[name],
		offset: marginOffset,
		smallGraphLimit: 11 * spread[name],
		smallGraphsPerSecond: spread[name],
		spread: spread[name],
	});
	const regions = new Map<RegionName, Region>();

	if (column.left > minimumMargin) {
		regions.set("left", {
			...getMargin("left"),
			bounds: { bottom: height, left: 0, right: column.left, top: 0 },
		});
	}

	if (width - column.right > minimumMargin) {
		regions.set("right", {
			...getMargin("right"),
			bounds: { bottom: height, left: column.right, right: width, top: 0 },
		});
	}

	if (footer) {
		const { bottom, left, right, top } = footer.aurora;

		regions.set("bottom", {
			avoid: footer.text,
			bounds: { bottom, left, right, top: Math.max(top, footer.footer.top) },
			dwell: footerDwell.level,
			offset: -top,
			smallGraphLimit: 8,
			smallGraphsPerSecond: 0.3,
			spread: 1,
		});
	}

	return regions;
}

export function measureFooter(): { bounds: FooterBounds | undefined } {
	const aurora = document
		.querySelector("aurora-band[edge=bottom]")
		?.getBoundingClientRect();
	const footer = document.querySelector("footer");
	const paragraph = document.querySelector("footer p");

	// The aurora isn't displayed where it can't scroll into view
	if (!aurora?.height || !footer || !paragraph) {
		return { bounds: undefined };
	}

	const text = document.createRange();

	// Paragraphs themselves are as wide as the footer is
	text.selectNodeContents(paragraph);

	return {
		bounds: {
			aurora,
			footer: footer.getBoundingClientRect(),
			text: text.getBoundingClientRect(),
		},
	};
}
