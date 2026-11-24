import type { CollectionEntry } from "astro:content";

import readingTime from "reading-time";

export function createBlogDescription(entry: CollectionEntry<"blog">) {
	return stripMarkdown(entry.data.description);
}

export function createBlogTitle(entry: CollectionEntry<"blog">) {
	return stripMarkdown(entry.data.title);
}

export function getReadingMinutes(body = "") {
	return Math.ceil(readingTime(body).minutes / 5) * 5;
}

function stripMarkdown(text: string) {
	// TODO: use a markdown renderer
	return text.replaceAll("`", "");
}
