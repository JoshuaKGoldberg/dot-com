import type { CollectionEntry } from "astro:content";

import readingTime from "reading-time";

export function createBlogTitle(entry: CollectionEntry<"blog">) {
	// TODO: use a markdown renderer
	return entry.data.title.replaceAll("`", "");
}

export function getReadingMinutes(body = "") {
	return Math.ceil(readingTime(body).minutes / 5) * 5;
}
