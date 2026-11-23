import type { Rectangle } from "../geometry";
import type { Region } from "./GraphSimulation";

import { type Column, minimumMargin } from "../column";
import { footerDwell } from "../footerDwell";

export interface FooterBounds {
	/** Where the bottom aurora is. */
	band: Rectangle | undefined;

	/** Where the footer's text is. */
	text: Rectangle | undefined;
}

export interface RegionContext {
	column: Column;

	/** How much the pointer has lingered by each margin, from 0 to 1. */
	dwell: { left: number; right: number };

	footer: FooterBounds;
	height: number;

	/** Pixels that the margins' contents have scrolled up by. */
	marginOffset: number;

	width: number;
}

/** Creates the regions of the screen that graphs may grow in. */
export function createRegions({
	column,
	dwell,
	footer,
	height,
	marginOffset,
	width,
}: RegionContext) {
	const margin = { limit: 11, offset: marginOffset, rate: 1 };
	const regions: Region[] = [];

	if (column.left > minimumMargin) {
		regions.push({
			...margin,
			bounds: { bottom: height, left: 0, right: column.left, top: 0 },
			dwell: dwell.left,
			name: "left",
		});
	}

	if (width - column.right > minimumMargin) {
		regions.push({
			...margin,
			bounds: { bottom: height, left: column.right, right: width, top: 0 },
			dwell: dwell.right,
			name: "right",
		});
	}

	if (footer.band) {
		regions.push({
			avoid: footer.text,
			bounds: footer.band,
			dwell: footerDwell.level,
			limit: 8,
			name: "bottom",
			offset: -footer.band.top,
			rate: 0.3,
		});
	}

	return regions;
}

export function measureFooter(): FooterBounds {
	const getBounds = (selector: string) =>
		document.querySelector(selector)?.getBoundingClientRect();

	return {
		band: getBounds("aurora-band[edge=bottom]"),
		text: getBounds("footer"),
	};
}
