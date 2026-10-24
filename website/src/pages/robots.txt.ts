import type { APIRoute } from "astro";

// Search and AI-answer crawlers are named explicitly so their access never
// depends on how each one reads `*`. /sitemap.xml is a copy of sitemap-0.xml:
// every page in one file (see the build script). Its address follows the
// site's own (PUBLIC_SITE_URL), so a preview host never advertises the
// production sitemap or the reverse.
const AGENTS = [
  "*",
  "Bingbot",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "ClaudeBot",
  "Claude-SearchBot",
  "Google-Extended",
  "Applebot-Extended",
];

export const GET: APIRoute = ({ site }) =>
  new Response(
    `${AGENTS.map((a) => `User-agent: ${a}\nAllow: /\nDisallow: /admin\n`).join("\n")}\nSitemap: ${new URL("/sitemap.xml", site)}\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
