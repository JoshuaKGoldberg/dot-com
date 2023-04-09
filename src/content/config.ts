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
	projects: defineCollection({
		schema: z.object({
			category: z.string(),
			description: z.string(),
			image: z.string().optional(),
			more: z
				.array(
					z.object({
						description: z.string(),
						title: z.string(),
					})
				)
				.optional(),
			role: z.string().optional(),
			stars: z.number(),
			title: z.string().optional(),
		}),
	}),
};
