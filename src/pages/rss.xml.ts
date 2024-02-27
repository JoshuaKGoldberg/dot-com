import type { APIContext } from "astro";

import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

import { blogDescription, site } from "../constants";

export async function GET(context: APIContext) {
	const blog = await getCollection("blog");

	return rss({
		customData: `<language>en-us</language>`,
		description: blogDescription,
		items: blog.map((post) => ({
			customData: post.data.customData,
			description: post.data.description,
			link: `/blog/${post.slug}`,
			pubDate: post.data.pubDate,
			title: post.data.title,
		})),
		site: context.site?.toString() ?? site,
		title: "Goldblog",
	});
}
