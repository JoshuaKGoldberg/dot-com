import { defineCollection, z } from "astro:content";

export const collections = {
	blog: defineCollection({
		schema: z.object({
			date: z.date(),
			description: z.string(),
			image: z.string(),
			minutesRead: z.string(),
			tags: z.array(z.string()),
			title: z.string(),
		}),
	}),
};
