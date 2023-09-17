import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    description: z.string(),
    image: z.string().optional(),
    /* pubDate: z.coerce.date(), */
    /* updatedDate: z.coerce.date().optional(), */
  }),
});

export const collections = { blog };
