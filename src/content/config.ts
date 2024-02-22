import { rssSchema } from "@astrojs/rss";
import { defineCollection, z } from "astro:content";

export const collections = {
	blog: defineCollection({
		schema: rssSchema.extend({
			description: z.string(),
			download: z.string().optional(),
			image: z
				.object({
					alt: z.string(),
					src: z.string(),
				})
				// TODO: add images for older blog posts, then remove this .optional()
				.optional(),
			pubDate: z.coerce.date(),
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
