// Fails the build when a page lacks a unique title or a 140-160 character
// description: both feed search results and social cards.
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DOCS = fileURLToPath(new URL("../docs/", import.meta.url));
const GENERATED = new Set(["developer/reference/api.md", "developer/reference/env-vars.md"]);

/** Every markdown page under docs/. */
function pages(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) pages(p, acc);
    else if (/\.mdx?$/.test(name)) acc.push(p);
  }
  return acc;
}

/** The value of one front-matter key, or "". */
function field(src, key) {
  const fm = src.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  return (fm.match(new RegExp(`^${key}:\\s*(.*)$`, "m"))?.[1] ?? "").replace(/^["']|["']$/g, "").trim();
}

const errors = [];
const titles = new Map();
for (const file of pages(DOCS)) {
  const rel = relative(DOCS, file);
  const src = readFileSync(file, "utf8");
  const title = field(src, "title");
  const description = field(src, "description");
  if (!title) errors.push(`${rel}: no title`);
  if (titles.has(title)) errors.push(`${rel}: title "${title}" also used by ${titles.get(title)}`);
  titles.set(title, rel);
  const n = description.length;
  if (!GENERATED.has(rel) && (n < 140 || n > 160)) errors.push(`${rel}: description is ${n} characters, needs 140-160`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`front matter ok: ${titles.size} pages`);
