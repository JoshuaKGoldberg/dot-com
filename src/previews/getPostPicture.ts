import type { CollectionEntry } from "astro:content";

import defaultImage from "~/assets/blog/default.webp";
import { portraits } from "~/portraits";

import { drawPortrait, drawThumbnail } from "./drawPicture";

export function getPostPicture({ data }: CollectionEntry<"blog">) {
	const { image, thumbnail } = data;

	// The default image is too small to be shown as large as these are
	return image.src.src === defaultImage.src
		? { alt: portraits.blog.alt, draw: () => drawPortrait(portraits.blog) }
		: { alt: image.alt, draw: () => drawThumbnail(thumbnail ?? image.src) };
}
