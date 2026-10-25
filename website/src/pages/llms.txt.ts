import type { APIRoute } from "astro";
import { SITE } from "../consts";
import { FAQ, MODULE_GROUPS, SURFACES, TRUST } from "../data/content";
import { GUIDE_LIST, RESOURCES, TOOLS } from "../data/guides";
import { MODULE_PAGES } from "../data/modules";
import { CHARGES, PASS_THROUGH, SEVA, SUPPORT_US } from "../data/pricing";
import { getPosts } from "../lib/blog";

// llms.txt (llmstxt.org): a plain summary for AI assistants, built from the
// same data the pages render, so it can never claim more than the site does.
export const GET: APIRoute = async ({ site }) => {
  const url = (path: string) => new URL(path, site).href;
  const link = (title: string, path: string, note: string) => `- [${title}](${url(path)}): ${note}`;
  const posts = await getPosts();

  const body = [
    `# ${SITE.brand}`,
    "",
    `> ${SITE.brand} is hospital management software (HMS) for Indian hospitals and clinics: registration, OPD, IPD, lab, radiology, pharmacy, GST billing and insurance on one patient record, with native staff and patient apps and TV token boards. It runs in our cloud or on the hospital's own servers.`,
    "",
    "## Facts",
    ...TRUST.map((t) => `- ${t.title}: ${t.body}`),
    ...SURFACES.map((s) => `- ${s.kicker}: ${s.body}`),
    "- ABDM, NHCX and UHI: built for these networks; not yet certified by NHA.",
    `- Contact: ${SITE.email}`,
    "",
    "## Pricing",
    "- The MedBrains software and every update are free for every hospital and clinic: no subscription, no charge per user.",
    ...CHARGES.map((c) => `- ${c.title} (${c.when.toLowerCase()}): ${c.body}`),
    `- ${PASS_THROUGH}`,
    `- ${SEVA.line}`,
    `- ${SUPPORT_US.title}: ${SUPPORT_US.rules}`,
    link("Pricing", "/pricing", "what is free, what we charge for, and how to get a quote"),
    link("Commercial terms", "/terms", "our standard terms for implementation, customisation, AMC, hosting and data"),
    "",
    "## Modules",
    ...MODULE_GROUPS.map((g) => `- ${g.label}: ${g.items.join(", ")}`),
    "",
    "## Product pages",
    link(`${SITE.brand} home`, "/", "overview of the hospital management software"),
    ...MODULE_PAGES.map((p) => link(p.h1, `/${p.slug}`, p.description)),
    ...GUIDE_LIST.map((g) => link(g.h1, `/${g.slug}`, g.description)),
    "",
    "## Resources",
    ...RESOURCES.map((r) => link(r.title, r.page, r.body)),
    ...TOOLS.map((t) => link(t.title, t.page, t.body)),
    "",
    "## Blog",
    ...posts.map((p) => link(p.data.title, `/blog/${p.id}`, p.data.description)),
    "",
    "## FAQ",
    ...FAQ.map((f) => `- ${f.q} ${f.a}`),
    "",
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
