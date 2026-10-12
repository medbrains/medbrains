import type { APIRoute } from "astro";

// The sitemap's address follows the site's own (PUBLIC_SITE_URL), so a
// preview host never advertises the production sitemap or the reverse.
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL("/sitemap-index.xml", site)}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
