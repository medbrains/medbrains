import { glob } from "astro/loaders";
import { defineCollection, reference, z } from "astro:content";
import { CATEGORY_SLUGS } from "./data/blog-categories";

// One JSON file per author in src/content/authors; the file name is the URL.
const authors = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/authors" }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      // An editorial desk is an Organization in schema.org, a doctor a Person.
      type: z.enum(["Person", "Organization"]).default("Person"),
      role: z.string(),
      credentials: z.string().optional(),
      // e.g. a medical council registration number, shown as given.
      registration: z.string().optional(),
      bio: z.string(),
      photo: image().optional(),
      sameAs: z.array(z.string().url()).default([]),
    }),
});

// One Markdown file per post in src/content/blog; the file name is the URL.
const blog = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/blog" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      // Used in the browser tab and Google instead of the title when set.
      seoTitle: z.string().max(60).optional(),
      description: z.string(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      category: z.enum(CATEGORY_SLUGS).default("patient-education"),
      tags: z.array(z.string()).min(1),
      // prefault, not default: zod 4 returns a default as-is, so it would skip
      // the reference transform and leave a bare string.
      author: reference("authors").prefault("medbrains-editorial"),
      // Shown as "Medically reviewed by" only when set.
      reviewer: z
        .object({
          name: z.string(),
          credentials: z.string(),
          registration: z.string().optional(),
          url: z.string().url().optional(),
        })
        .optional(),
      cover: z.object({ src: image(), alt: z.string() }).optional(),
      ogImage: image().optional(),
      faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
      featured: z.boolean().default(false),
      // Drafts are left out of every page, the sitemap and the RSS feed.
      draft: z.boolean().default(false),
      // Health advice carries its evidence; a post without sources does not build.
      sources: z.array(z.object({ title: z.string(), url: z.string().url() })).min(1),
    }),
});

export const collections = { authors, blog };
