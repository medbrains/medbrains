import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { SITE } from "../../consts";
import { getCategory } from "../../data/blog-categories";
import { getPosts, postPath } from "../../lib/blog";

export const GET: APIRoute = async ({ site }) =>
  rss({
    title: `${SITE.brand} blog`,
    description: "Plain-language health advice for families, and practical writing for hospitals.",
    site: site ?? "https://www.medbrains.in",
    customData: "<language>en-IN</language>",
    trailingSlash: false,
    items: (await getPosts()).map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.date,
      link: postPath(p),
      categories: [getCategory(p.data.category).name, ...p.data.tags],
    })),
  });
