import { rssSchema } from "@astrojs/rss";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";

export const collections = {
	blog: defineCollection({
		loader: glob({ base: "./src/content/blog", pattern: "*/index.mdx" }),
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
				tags: z.array(z.string()).optional(),
				thumbnail: image().optional(),
				title: z.string(),
			}),
	}),
	speaking: defineCollection({
		loader: glob({ base: "./src/content/speaking", pattern: "*.md" }),
		schema: z.object({
			category: z.string(),
			date: z.date(),
			event: z.string(),
			href: z.string(),
			links: z.record(z.string(), z.string()).optional(),
			location: z.string().optional(),
			title: z.string().optional(),
		}),
	}),
};
