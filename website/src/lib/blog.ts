import { getCollection, type CollectionEntry } from "astro:content";
import { SAME_AS, SITE } from "../consts";
import { getCategory } from "../data/blog-categories";

export type Post = CollectionEntry<"blog">;
export type Author = CollectionEntry<"authors">;

/** Posts per list page on the blog home and its older pages. */
export const PAGE_SIZE = 12;

/** Published posts, newest first. Drafts show only in `astro dev`. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection("blog", (p) => import.meta.env.DEV || !p.data.draft);
  // Same-day posts tie on date; the id keeps the order stable between builds.
  return posts.sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf() || a.id.localeCompare(b.id),
  );
}

/** Author id → display name, for post cards. */
export async function getAuthorNames(): Promise<Map<string, string>> {
  return new Map((await getCollection("authors")).map((a) => [a.id, a.data.name]));
}

export const postPath = (p: Post) => `/blog/${p.id}`;
export const tagSlug = (tag: string) =>
  tag.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const absolute = (path: string, site: URL | undefined) => new URL(path, site).href;

export const formatDate = (d: Date) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(d);

/** Minutes to read at 200 words a minute, never less than one. */
export function wordCount(p: Post): number {
  return (p.body ?? "").split(/\s+/).filter(Boolean).length;
}

export function readingTime(p: Post): number {
  return Math.max(1, Math.round(wordCount(p) / 200));
}

/** A post date is a calendar day in India: midnight IST, not 05:30 IST from UTC midnight. */
export function istDate(d: Date): string {
  return `${d.toISOString().slice(0, 10)}T00:00:00+05:30`;
}

/** Up to three posts: the same topic first, then the most shared tags. */
export function relatedPosts(post: Post, all: Post[]): Post[] {
  const tags = new Set(post.data.tags);
  const score = (p: Post) =>
    (p.data.category === post.data.category ? 100 : 0) + p.data.tags.filter((t) => tags.has(t)).length;
  return all
    .filter((p) => p.id !== post.id)
    .map((p) => ({ p, s: score(p) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s || b.p.data.date.valueOf() - a.p.data.date.valueOf())
    .slice(0, 3)
    .map(({ p }) => p);
}

export const isMedical = (p: Post) => getCategory(p.data.category).kind === "medical";

/** schema.org Organization for MedBrains, the publisher of every post. */
export function organization(site: URL | undefined) {
  const home = absolute("/", site);
  return {
    "@type": "Organization",
    "@id": `${home}#org`,
    name: SITE.brand,
    url: home,
    logo: { "@type": "ImageObject", url: absolute("/apple-touch-icon.png", site), width: 180, height: 180 },
    email: SITE.email,
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: SITE.email, areaServed: "IN", availableLanguage: ["en"] },
    ...(SAME_AS.length ? { sameAs: SAME_AS } : {}),
  };
}

export function breadcrumbs(site: URL | undefined, trail: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [{ name: SITE.brand, path: "/" }, ...trail].map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absolute(c.path, site),
    })),
  };
}

/** CollectionPage + ItemList for a list of posts (blog home, a topic, a tag). */
export function collectionPage(site: URL | undefined, o: { name: string; description: string; path: string; posts: Post[] }) {
  return {
    "@type": "CollectionPage",
    name: o.name,
    description: o.description,
    url: absolute(o.path, site),
    inLanguage: "en-IN",
    isPartOf: { "@type": "Blog", name: `${SITE.brand} Blog`, url: absolute("/blog", site) },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: o.posts.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absolute(postPath(p), site),
        name: p.data.title,
      })),
    },
  };
}
