import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import { loadEnv } from "vite";
import { blogIndex } from "./scripts/blog-index.mjs";

// Domain comes from the env (per-env: staging/prod), not hardcoded.
// Reads .env locally and CI/shell env in pipelines.
const env = loadEnv(process.env.NODE_ENV ?? "", process.cwd(), "");
const site = env.PUBLIC_SITE_URL ?? "https://www.medbrains.in";
const blog = blogIndex("./src/content/blog");
const pathOf = (url) => new URL(url).pathname.replace(/\/$/, "") || "/";

export default defineConfig({
  site,
  // Pages live at /pharmacy-management-software, never with a trailing
  // slash: one canonical address each (deploy.sh uploads them that way).
  trailingSlash: "never",
  integrations: [
    sitemap({
      // Pages marked noindex (thin tags, empty topics, search) stay out.
      filter: (url) => !blog.noindex(pathOf(url)),
      serialize: (item) => {
        const lastmod = blog.lastmod.get(pathOf(item.url));
        return lastmod ? { ...item, lastmod: lastmod.toISOString() } : item;
      },
    }),
  ],
  // The app serves this page at its own root under a CSP with no
  // 'unsafe-inline' scripts, so scripts ship as files, never inlined.
  vite: { build: { assetsInlineLimit: 0 } },
});
