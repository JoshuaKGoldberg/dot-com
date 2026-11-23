import type { ImageMetadata } from "astro";

import sharp from "sharp";

/** Finds the average color of an image, as space-separated red, green, and blue. */
export async function getTone(image: ImageMetadata) {
	const { fsPath } = image as ImageMetadata & { fsPath: string };
	const [red, green, blue] = await sharp(fsPath)
		// Otherwise, invisible pixels' colors would be counted too
		.resize(1, 1, { fastShrinkOnLoad: false, fit: "fill", kernel: "linear" })
		.toColorspace("srgb")
		.ensureAlpha()
		.raw()
		.toBuffer();

	return [red, green, blue].join(" ");
}
