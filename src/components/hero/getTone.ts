import type { ImageMetadata } from "astro";

import sharp from "sharp";

import { getImagePath } from "~/getImagePath";

export async function getTone(image: ImageMetadata) {
	const [red, green, blue] = await sharp(getImagePath(image))
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
