import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import { loadEnv } from "vite";

// Domain comes from the env (per-env: staging/prod), not hardcoded.
// Reads .env locally and CI/shell env in pipelines.
const env = loadEnv(process.env.NODE_ENV ?? "", process.cwd(), "");
const site = env.PUBLIC_SITE_URL ?? "https://medbrains.com";

export default defineConfig({
  site,
  integrations: [sitemap()],
});
