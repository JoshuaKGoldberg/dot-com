import type { ImageMetadata } from "astro";

import sharp, { type Sharp } from "sharp";

import { getImagePath } from "~/getImagePath";
import { getOverhang, type Portrait } from "~/portraits";

export interface Picture {
	/** How far it reaches above its circle. */
	above: number;

	file: Buffer;

	/** Whether it may be in front of the top of its circle. */
	isPerson: boolean;
}

export const diameter = 390;

const radius = diameter / 2;

/** As they are in the page's portraits. */
const fills = {
	faint: `<rect width="100%" height="100%" opacity="0.62"/>`,
	solid: `<rect width="100%" height="100%"/>`,
	usual: `<linearGradient id="fade"><stop offset="0" stop-opacity="0.7"/><stop offset="0.5" stop-opacity="0.9"/><stop offset="1" stop-opacity="0.7"/></linearGradient><rect width="100%" height="100%" fill="url(#fade)"/>`,
};

/** People can stand taller than their circle, but are otherwise inside of it. */
export async function drawPortrait({
	image,
	isSceneFaint,
	scene,
}: Portrait): Promise<Picture> {
	const above = Math.round(getOverhang(image) * diameter);
	const height = above + diameter;
	const person = await sharp(getImagePath(image))
		.resize({ width: diameter })
		.extract({ height, left: 0, top: 0, width: diameter })
		.composite([
			{
				blend: "dest-in",
				input: createSvg(
					height,
					`<rect width="100%" height="${(above + radius).toString()}"/><circle cx="50%" cy="${(above + radius).toString()}" r="${radius.toString()}"/>`,
				),
			},
		])
		.png()
		.toBuffer();
	const layers = scene
		? [{ input: await drawScene(scene, isSceneFaint), left: 0, top: above }]
		: [];

	return {
		above,
		file: await sharp({
			create: {
				background: "transparent",
				channels: 4,
				height,
				width: diameter,
			},
		})
			.composite([...layers, { input: person }])
			.png()
			.toBuffer(),
		isPerson: true,
	};
}

export async function drawThumbnail(image: ImageMetadata): Promise<Picture> {
	return {
		above: 0,
		file: await drawCircle(
			sharp(getImagePath(image))
				.autoOrient()
				.resize(diameter, diameter, { fit: "cover" }),
			fills.solid,
		),
		isPerson: false,
	};
}

function createSvg(height: number, contents: string) {
	return Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${diameter.toString()}" height="${height.toString()}">${contents}</svg>`,
	);
}

function drawCircle(picture: Sharp, fill: string) {
	return picture
		.composite([
			{
				blend: "dest-in",
				input: createSvg(
					diameter,
					`<clipPath id="circle"><circle cx="50%" cy="50%" r="50%"/></clipPath><g clip-path="url(#circle)">${fill}</g>`,
				),
			},
		])
		.ensureAlpha()
		.png()
		.toBuffer();
}

async function drawScene(scene: ImageMetadata, isFaint = false) {
	const picture = sharp(getImagePath(scene));

	if (!isFaint) {
		return drawCircle(
			picture.resize(diameter, diameter, { fit: "cover" }),
			fills.usual,
		);
	}

	// Larger than the circle, so that its blurred edges are outside of it
	const larger = Math.round(diameter * 1.2);
	const inset = Math.round((larger - diameter) / 2);
	const blurred = await picture
		.resize(larger, larger, { fit: "cover" })
		.blur(diameter * 0.012)
		.modulate({ saturation: 0.83 })
		.png()
		.toBuffer();

	return drawCircle(
		sharp(blurred).extract({
			height: diameter,
			left: inset,
			top: inset,
			width: diameter,
		}),
		fills.faint,
	);
}
