import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

// One Markdown file per post in src/content/blog; the file name is the URL.
const blog = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).min(1),
    // Health advice carries its evidence; a post without sources does not build.
    sources: z.array(z.object({ title: z.string(), url: z.string().url() })).min(1),
  }),
});

export const collections = { blog };
