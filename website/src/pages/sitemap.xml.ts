import type { APIRoute } from "astro";

// /sitemap.xml is the address SEO tools and people try first; @astrojs/sitemap
// only writes sitemap-index.xml + sitemap-0.xml, so this serves the same index.
export const GET: APIRoute = ({ site }) =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${new URL("/sitemap-0.xml", site)}</loc></sitemap></sitemapindex>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
