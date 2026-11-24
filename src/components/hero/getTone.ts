import type { ImageMetadata } from "astro";

import sharp from "sharp";

/** Finds an image's average red, green, and blue. */
export async function getTone(image: ImageMetadata) {
	const { fsPath } = image as ImageMetadata & { fsPath: string };
	const [red, green, blue] = await sharp(fsPath)
		.resize(1, 1, {
			// Shrinking on load counts invisible pixels' colors
			fastShrinkOnLoad: false,
			fit: "fill",
		})
		.toColorspace("srgb")
		.raw()
		.toBuffer();

	return [red, green, blue].join(" ");
}
