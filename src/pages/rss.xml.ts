import rss, { pagesGlobToRssItems } from "@astrojs/rss";
import type { APIContext } from "astro";

import { blogDescription, site } from "../constants";

export async function get(context: APIContext) {
	return rss({
		customData: `<language>en-us</language>`,
		description: blogDescription,
		site: context.site?.toString() ?? site,
		items: (
			await pagesGlobToRssItems(
				// TODO: find or file an issue?
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
				import.meta.glob("../content/blog/**/*.mdx")
			)
		).map((inner) => ({
			...inner,
			link: inner.link.replace(/^src\/content/, "").replace(/index.mdx$/, ""),
		})),
		title: "Goldblog",
	});
}
