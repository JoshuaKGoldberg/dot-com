import rss, { pagesGlobToRssItems } from "@astrojs/rss";
import type { APIContext } from "astro";

import { description, site } from "../constants";

export async function get(context: APIContext) {
	return rss({
		customData: `<language>en-us</language>`,
		description: description,
		site: context.site?.toString() ?? site,
		items: await pagesGlobToRssItems(import.meta.glob("../content/blog/*.mdx")),
		title: "Goldblog",
	});
}
