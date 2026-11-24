import type { APIContext } from "astro";

import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

import {
	createBlogDescription,
	createBlogTitle,
} from "../components/blog/utils";
import { blogDescription, site } from "../constants";

export async function GET(context: APIContext) {
	const blog = await getCollection("blog");

	return rss({
		customData: `<language>en-us</language>`,
		description: blogDescription,
		items: blog.map((post) => ({
			customData: post.data.customData,
			description: createBlogDescription(post),
			link: `/blog/${post.id}`,
			pubDate: post.data.pubDate,
			title: createBlogTitle(post),
		})),
		site: context.site?.toString() ?? site,
		title: "Goldblog",
	});
}
