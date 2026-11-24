import type { ImageMetadata } from "astro";

export function getImagePath(image: ImageMetadata) {
	const { fsPath } = image as ImageMetadata & { fsPath: string };

	return fsPath;
}
