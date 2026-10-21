// What the sitemap needs to know about the blog, read straight from the post
// files (astro.config runs before content collections exist): each post's
// last-modified date, drafts, and which topic and tag pages are noindex.
// ponytail: reads only the frontmatter keys below, in the two shapes YAML and
// the CMS write them (`key: value`, `tags: [a, b]` or a `- item` list).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const unquote = (s) => s.trim().replace(/^["']|["']$/g, "");
const slug = (t) => t.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function readFrontmatter(text) {
  const block = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const lines = block.split("\n");
  const data = {};
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    if (raw.startsWith("[")) data[key] = raw.slice(1, raw.lastIndexOf("]")).split(",").map(unquote).filter(Boolean);
    else if (raw === "") {
      const items = [];
      while (lines[i + 1]?.match(/^\s+-\s+[^:]+$/)) items.push(unquote(lines[++i].replace(/^\s+-\s+/, "")));
      data[key] = items;
    } else data[key] = unquote(raw);
  }
  return data;
}

export function blogIndex(dir) {
  const posts = readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ id: f.replace(/\.md$/, ""), ...readFrontmatter(readFileSync(join(dir, f), "utf8")) }))
    .filter((p) => p.draft !== "true");
  const lastmod = new Map(posts.map((p) => [`/blog/${p.id}`, new Date(p.updated ?? p.date)]));
  const tagCounts = new Map();
  for (const p of posts) for (const t of p.tags ?? []) tagCounts.set(slug(t), (tagCounts.get(slug(t)) ?? 0) + 1);
  const categories = new Set(posts.map((p) => p.category ?? "patient-education"));
  const noindex = (path) => {
    const tag = path.match(/^\/blog\/tag\/([^/]+)$/)?.[1];
    if (tag) return (tagCounts.get(tag) ?? 0) < 2;
    const cat = path.match(/^\/blog\/category\/([^/]+)$/)?.[1];
    if (cat) return !categories.has(cat);
    return path === "/blog/search";
  };
  return { lastmod, noindex };
}
