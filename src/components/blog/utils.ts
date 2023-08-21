import type { CollectionEntry } from "astro:content";

export function createBlogTitle(entry: CollectionEntry<"blog">) {
	return [
		entry.data.series,
		// TODO: use a markdown renderer
		entry.data.title.replaceAll("`", ""),
	]
		.filter(Boolean)
		.join(": ");
}
