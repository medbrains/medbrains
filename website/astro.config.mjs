import { existsSync } from "node:fs";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import { blogIndex } from "./scripts/blog-index.mjs";

// Domain comes from the env (per-env: staging/prod), not hardcoded.
// Reads .env locally and CI/shell env in pipelines.
// The shell/CI env wins: loadEnvFile never overwrites a variable already set.
if (existsSync(".env")) process.loadEnvFile(".env");
const site = process.env.PUBLIC_SITE_URL ?? "https://www.medbrains.in";
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
  //
  // noExternal: the prerender bundle otherwise imports astro's own runtime deps
  // (cookie, html-escaper, mrmime, zod) by bare name from dist/, and Node finds
  // them by walking up the directory tree — so any node_modules above the repo
  // (one exists in ~/Projects) silently supplies its own versions, and astro 7
  // broke on an old CJS `cookie` that way. Bundling them makes the build use
  // exactly what the lockfile pinned.
  vite: {
    build: { assetsInlineLimit: 0 },
    environments: { prerender: { resolve: { noExternal: true } } },
  },
});
