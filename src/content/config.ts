import { defineCollection, z } from "astro:content";

const blogCollection = defineCollection({
  schema: z.object({
    image: z.string(),
    tags: z.array(z.string()),
    title: z.string(),
  }),
});

export const collections = {
  blog: blogCollection,
};
