import { getRssString } from "@astrojs/rss";
import { getCollection } from "astro:content";

import {
	createBlogDescription,
	createBlogTitle,
} from "../components/blog/utils";
import { blogDescription, feedSite } from "../constants";

export async function GET() {
	const blog = await getCollection("blog");

	const feed = await getRssString({
		customData: `<language>en-us</language>`,
		description: blogDescription,
		items: blog
			.sort((a, b) => +b.data.pubDate - +a.data.pubDate)
			.map((post) => ({
				customData: post.data.customData,
				description: createBlogDescription(post),
				link: `/blog/${post.id}`,
				pubDate: post.data.pubDate,
				title: createBlogTitle(post),
			})),
		site: feedSite,
		title: "Goldblog",
	});

	// Browsers run rss.js to show a page about the feed, which feed readers ignore.
	// Until it has, rss-loading.css hides the feed's raw text.
	const loading = `<?xml-stylesheet href="/rss-loading.css" type="text/css"?>`;
	const script = `<script onerror="document.documentElement.setAttribute('data-failed', '')" src="/rss.js" xmlns="http://www.w3.org/1999/xhtml"></script>`;

	return new Response(
		feed.replace(/<rss[^>]*>/, (rss) => loading + rss + script),
		{ headers: { "Content-Type": "application/xml" } },
	);
}
