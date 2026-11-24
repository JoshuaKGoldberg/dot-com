import type { ImageMetadata } from "astro";

import sharp from "sharp";

import { getImagePath } from "~/getImagePath";

import type { Picture } from "./drawPreview";

const diameter = 390;

/** Height, relative to its width, of a cutout that starts at the top of its circle. */
const usualHeight = 544 / 512;

/** People can stand taller than their circle, but are otherwise inside of it. */
export async function drawPortrait(
	cutout: ImageMetadata,
	scene?: ImageMetadata,
): Promise<Picture> {
	const person = sharp(getImagePath(cutout)).resize({ width: diameter });
	const { data, info } = await person
		.png()
		.toBuffer({ resolveWithObject: true });
	const above = Math.round(
		(cutout.height / cutout.width - usualHeight) * diameter,
	);
	const height = above + diameter;
	const shape = `<svg xmlns="http://www.w3.org/2000/svg" width="${diameter.toString()}" height="${height.toString()}"><rect width="100%" height="${(above + diameter / 2).toString()}"/><circle cx="${(diameter / 2).toString()}" cy="${(above + diameter / 2).toString()}" r="${(diameter / 2).toString()}"/></svg>`;
	const canvas = {
		create: {
			background: "transparent",
			channels: 4 as const,
			height: Math.max(height, info.height),
			width: diameter,
		},
	};
	const clipped = await sharp(
		await sharp(canvas)
			.composite([{ input: data, left: 0, top: 0 }])
			.png()
			.toBuffer(),
	)
		.extract({ height, left: 0, top: 0, width: diameter })
		.composite([{ blend: "dest-in", input: Buffer.from(shape) }])
		.png()
		.toBuffer();
	const layers = scene
		? [{ input: await drawCircle(scene), left: 0, top: above }]
		: [];

	return {
		file: await sharp({ create: { ...canvas.create, height } })
			.composite([...layers, { input: clipped }])
			.png()
			.toBuffer(),
		isPerson: true,
	};
}

export async function drawThumbnail(image: ImageMetadata): Promise<Picture> {
	return { file: await drawCircle(image), isPerson: false };
}

async function drawCircle(image: ImageMetadata) {
	const radius = (diameter / 2).toString();

	return sharp(getImagePath(image))
		.resize(diameter, diameter, { fit: "cover" })
		.composite([
			{
				blend: "dest-in",
				input: Buffer.from(
					`<svg xmlns="http://www.w3.org/2000/svg" width="${diameter.toString()}" height="${diameter.toString()}"><circle cx="${radius}" cy="${radius}" r="${radius}"/></svg>`,
				),
			},
		])
		.ensureAlpha()
		.png()
		.toBuffer();
}
