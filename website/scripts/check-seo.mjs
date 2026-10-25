// Runs after `astro build` (part of `pnpm build`): reads the built HTML of the
// blog's key pages and fails the build if their SEO basics are missing.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname;
const read = (path) => readFileSync(join(dist, path, "index.html"), "utf8");
const attr = (html, re) => html.match(re)?.[1];

function checkPage(path) {
  const html = read(path);
  const where = `/${path}`;
  assert.ok(attr(html, /<title>([^<]+)<\/title>/), `${where}: <title>`);
  for (const [name, re] of [
    ["meta description", /<meta name="description" content="([^"]+)"/],
    ["canonical", /<link rel="canonical" href="(https:\/\/[^"]+)"/],
    ["og:title", /<meta property="og:title" content="([^"]+)"/],
    ["og:image", /<meta property="og:image" content="(https?:\/\/[^"]+)"/],
  ]) assert.ok(attr(html, re), `${where}: ${name}`);
  assert.equal(new URL(attr(html, /<link rel="canonical" href="([^"]+)"/)).pathname, where, `${where}: canonical points at itself`);

  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(blocks.length > 0, `${where}: JSON-LD present`);
  const types = [];
  for (const b of blocks) {
    const data = JSON.parse(b); // throws on invalid JSON
    for (const node of data["@graph"] ?? [data]) {
      assert.ok(node["@type"], `${where}: every JSON-LD node has @type`);
      types.push(node["@type"]);
    }
  }
  assert.ok(types.includes("BreadcrumbList"), `${where}: BreadcrumbList`);

  // A social or share link must never be rendered without somewhere to go.
  assert.ok(!/<a\s[^>]*href=""/.test(html), `${where}: a link with an empty href`);
  assert.ok(!/<a(\s(?![^>]*href=)[^>]*)?>/.test(html), `${where}: an <a> without href`);
  return { path: where, types };
}

const category = "blog/category/patient-education";
const posts = readdirSync(join(dist, "blog"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !["category", "tag", "author", "page", "search"].includes(d.name))
  .map((d) => `blog/${d.name}`);
assert.ok(posts.length > 0, "at least one article built");

const results = [checkPage("blog"), checkPage(category), ...posts.map(checkPage)];
assert.ok(results[0].types.includes("CollectionPage"), "/blog: CollectionPage");
for (const r of results.slice(2)) {
  assert.ok(r.types.some((t) => t === "BlogPosting" || t === "MedicalWebPage"), `${r.path}: article schema`);
}
// The landing pages for hospitals and their printable resources (src/data/guides.ts).
const guides = ["abdm-incentive", "cashless-discharge", "dpdp-readiness"].map(checkPage);
const resources = ["resources/dpdp-readiness-checklist", "resources/discharge-time-audit-sheet"].map(checkPage);
for (const g of guides) assert.ok(g.types.includes("FAQPage"), `${g.path}: FAQPage`);
for (const r of resources) {
  const pdf = join(dist, "downloads", `${r.path.split("/").pop()}.pdf`);
  assert.ok(existsSync(pdf), `${r.path}: its PDF is in /downloads`);
}
const tools = ["resources/indian-hospitals-in-numbers", "resources/abdm-incentive-calculator",
  "resources/opd-wait-time-calculator", "resources/health-camp-planning-checklist"].map(checkPage);
assert.ok(tools[0].types.includes("Dataset"), `${tools[0].path}: Dataset`);
for (const t of tools.slice(2)) assert.ok(t.types.includes("FAQPage"), `${t.path}: FAQPage`);
// The health-camp cluster (src/data/camp-pages.ts): a hub and its spokes.
const camps = ["health-camp-software", "government-medical-camp-software", "ngo-health-camp-software",
  "corporate-health-camp-software", "health-camp-software-vs-manual"].map(checkPage);
for (const c of camps) assert.ok(c.types.includes("FAQPage"), `${c.path}: FAQPage`);
// The queues-and-tokens cluster (src/data/token-pages.ts): the OPD hub and its spokes.
const tokens = ["opd-queue-management", "clinic-token-management-system", "hospital-token-system"].map(checkPage);
for (const t of tokens) assert.ok(t.types.includes("FAQPage"), `${t.path}: FAQPage`);
// The buying guides under the HMS hub (src/data/compare-pages.ts).
const compare = ["how-to-choose-hospital-management-software", "hospital-software-vs-excel"].map(checkPage);
for (const c of compare) assert.ok(c.types.includes("FAQPage"), `${c.path}: FAQPage`);
// Plans and prices (src/data/pricing.ts).
const pricing = checkPage("pricing");
assert.ok(pricing.types.includes("FAQPage"), "/pricing: FAQPage");
results.push(pricing, ...guides, ...resources, ...tools, ...camps, ...tokens, ...compare);
for (const f of ["llms.txt", "robots.txt"]) assert.ok(existsSync(join(dist, f)), `/${f} built`);
assert.ok(existsSync(join(dist, "pagefind", "pagefind.js")), "Pagefind index built");
assert.ok(existsSync(join(dist, "blog", "rss.xml")), "RSS feed built");

// Search snippets on every indexable page: Google cuts a title past ~60 characters
// and rewrites a description that is too short or too long, so both are held here.
const htmlFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? htmlFiles(join(dir, d.name)) : d.name === "index.html" ? [join(dir, d.name)] : []);
const decode = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
let snippets = 0;
for (const file of htmlFiles(dist)) {
  const html = readFileSync(file, "utf8");
  if (/<meta name="robots" content="noindex/.test(html)) continue;
  const where = file.slice(dist.length - 1).replace(/index\.html$/, "");
  const title = decode(attr(html, /<title>([^<]+)<\/title>/) ?? "");
  const desc = decode(attr(html, /<meta name="description" content="([^"]*)"/) ?? "");
  assert.ok(title.length <= 60, `${where}: title is ${title.length} characters (max 60): ${title}`);
  assert.ok(desc.length >= 110 && desc.length <= 160, `${where}: description is ${desc.length} characters (110-160): ${desc}`);
  assert.ok(!/\u2014/.test(title + desc), `${where}: em dash in title or description`);
  snippets++;
}

for (const r of results) console.log(`ok ${r.path} — ${r.types.join(", ")}`);
console.log(`Snippet lengths ok on ${snippets} indexable pages.`);
console.log(`SEO check passed: ${results.length} pages.`);
