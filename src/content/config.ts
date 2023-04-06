import { defineCollection, z } from "astro:content";

const blogCollection = defineCollection({
  schema: z.object({
    date: z.date(),
    description: z.string(),
    image: z.string(),
    minutesRead: z.string(),
    tags: z.array(z.string()),
    title: z.string(),
  }),
});

export const collections = {
  blog: blogCollection,
};
