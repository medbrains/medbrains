// The blog's six topics. A post names one by slug in its `category` field.
//   kind "medical"  → MedicalWebPage schema + the medical disclaimer, never a sales pitch
//   kind "business" → BlogPosting schema + the hospital demo call-to-action
// `tint` is the card's pastel background, `ink` its icon colour; both pass
// WCAG AA against the --ink text that sits on the tint.

export const CATEGORY_SLUGS = [
  "hospital-leadership",
  "patient-education",
  "clinical-excellence",
  "operations",
  "technology",
  "regulatory-compliance",
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export interface BlogCategory {
  slug: CategorySlug;
  name: string;
  description: string;
  icon: string;
  tint: string;
  ink: string;
  kind: "medical" | "business";
}

export const BLOG_CATEGORIES: BlogCategory[] = [
  {
    slug: "hospital-leadership",
    name: "Hospital leadership & strategy",
    description: "Growth, quality and planning for people who run hospitals and clinics.",
    icon: "building-hospital",
    tint: "#e8eefe",
    ink: "#0043ce",
    kind: "business",
  },
  {
    slug: "patient-education",
    name: "Patient education & wellness",
    description: "Plain-language health advice for Indian families, through every season.",
    icon: "heart-handshake",
    tint: "#fde9ec",
    ink: "#a2191f",
    kind: "medical",
  },
  {
    slug: "clinical-excellence",
    name: "Doctor & clinical excellence",
    description: "Clinical practice, safety and the habits of good care, for doctors and nurses.",
    icon: "stethoscope",
    tint: "#e3f5ea",
    ink: "#0e6027",
    kind: "medical",
  },
  {
    slug: "operations",
    name: "Operations & efficiency",
    description: "Queues, beds, billing and stores: running a hospital day without the friction.",
    icon: "clock-cog",
    tint: "#fff3dc",
    ink: "#8e4b00",
    kind: "business",
  },
  {
    slug: "technology",
    name: "Technology & innovation",
    description: "Digital health, ABDM and the tools changing how care is delivered in India.",
    icon: "cpu",
    tint: "#efe9fe",
    ink: "#6929c4",
    kind: "business",
  },
  {
    slug: "regulatory-compliance",
    name: "Regulatory & compliance",
    description: "NABH, ABDM, the DPDP Act and the rules every Indian hospital works within.",
    icon: "shield-check",
    tint: "#e2f4f6",
    ink: "#005d5d",
    kind: "business",
  },
];

const BY_SLUG = new Map(BLOG_CATEGORIES.map((c) => [c.slug, c]));

export function getCategory(slug: CategorySlug): BlogCategory {
  // ponytail: the schema enum guarantees the slug exists, so this never misses.
  return BY_SLUG.get(slug) as BlogCategory;
}
