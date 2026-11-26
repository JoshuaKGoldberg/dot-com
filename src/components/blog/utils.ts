import type { CollectionEntry } from "astro:content";

import readingTime from "reading-time";

import { inlineMarkdownToText } from "../InlineMarkdown";

export function createBlogDescription(entry: CollectionEntry<"blog">) {
	return inlineMarkdownToText(entry.data.description);
}

export function createBlogTitle(entry: CollectionEntry<"blog">) {
	return inlineMarkdownToText(entry.data.title);
}

export function getReadingMinutes(body = "") {
	return Math.ceil(readingTime(body).minutes / 5) * 5;
}
