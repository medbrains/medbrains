import type { APIRoute } from "astro";

// /sitemap.xml is a copy of sitemap-0.xml: every page in one file (see the build
// script). Its address follows the site's own (PUBLIC_SITE_URL), so a
// preview host never advertises the production sitemap or the reverse.
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${new URL("/sitemap.xml", site)}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
