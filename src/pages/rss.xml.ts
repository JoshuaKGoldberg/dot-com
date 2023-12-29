import type { APIContext } from "astro";

import rss, { pagesGlobToRssItems } from "@astrojs/rss";

import { blogDescription, site } from "../constants";

export async function get(context: APIContext) {
	return rss({
		customData: `<language>en-us</language>`,
		description: blogDescription,
		items: (
			await pagesGlobToRssItems(import.meta.glob("../content/blog/**/*.mdx"))
		).map((inner) => ({
			...inner,
			link: inner.link.replace(/^src\/content/, "").replace(/index.mdx$/, ""),
		})),
		site: context.site?.toString() ?? site,
		title: "Goldblog",
	});
}
