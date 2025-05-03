import { rssSchema } from "@astrojs/rss";
import { defineCollection, z } from "astro:content";

export const collections = {
	blog: defineCollection({
		schema: ({ image }) =>
			rssSchema.extend({
				description: z.string(),
				download: z.string().optional(),
				image: z.object({
					alt: z.string(),
					src: image(),
				}),
				pubDate: z.coerce.date(),
				series: z.string().optional(),
				thumbnail: image().optional(),
				title: z.string(),
			}),
	}),
	speaking: defineCollection({
		schema: z.object({
			category: z.string(),
			date: z.date(),
			event: z.string(),
			href: z.string(),
			links: z.record(z.string()).optional(),
			location: z.string().optional(),
			title: z.string().optional(),
		}),
	}),
};
