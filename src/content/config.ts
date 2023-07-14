import { defineCollection, z } from "astro:content";

export const collections = {
	projects: defineCollection({
		schema: z.object({
			category: z.string(),
			description: z.string(),
			image: z.string().optional(),
			links: z.record(z.string()).optional(),
			more: z
				.array(
					z.object({
						description: z.string(),
						href: z.string(),
						title: z.string(),
					})
				)
				.optional(),
			role: z.string().optional(),
			stars: z.number(),
			url: z.string().optional(),
			title: z.string().optional(),
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
