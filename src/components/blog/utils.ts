import type { CollectionEntry } from "astro:content";

export function createBlogTitle(entry: CollectionEntry<"blog">) {
	// TODO: use a markdown renderer
	return entry.data.title.replaceAll("`", "");
}
