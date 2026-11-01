// The blog's six topics. A post names one by slug in its `category` field.
//   kind "medical"  → MedicalWebPage schema + the medical disclaimer, never a sales pitch
//   kind "business" → BlogPosting schema + the hospital demo call-to-action
// The one place the blog's topic colours live. `tint` is the card background
// (paper-2 for every topic), `ink` the icon colour: brand blue or brand purple,
// alternating, and never anything else (both pass 3:1 for icons on paper-2).

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
    description: "Practical writing for the people who run hospitals and clinics on growth, quality, NABH readiness, patient experience and long-term planning.",
    icon: "building-hospital",
    tint: "#f3f5f9",
    ink: "#0f62fe",
    kind: "business",
  },
  {
    slug: "patient-education",
    name: "Patient education & wellness",
    description: "Clear, sourced health guides for families on heat, air pollution, mental health, infections and when to see a doctor, for every season of the year.",
    icon: "heart-handshake",
    tint: "#f3f5f9",
    ink: "#851b7f",
    kind: "medical",
  },
  {
    slug: "clinical-excellence",
    name: "Doctor & clinical excellence",
    description: "For doctors and nurses: clinical practice, patient safety, antibiotic stewardship and the everyday habits of good care, with the evidence cited.",
    icon: "stethoscope",
    tint: "#f3f5f9",
    ink: "#0f62fe",
    kind: "medical",
  },
  {
    slug: "operations",
    name: "Operations & efficiency",
    description: "How hospitals run a smoother day: OPD queues, bed turnover, discharge times, billing and stores, with practical fixes your teams can start this week.",
    icon: "clock-cog",
    tint: "#f3f5f9",
    ink: "#851b7f",
    kind: "business",
  },
  {
    slug: "technology",
    name: "Technology & innovation",
    description: "Digital health explained for hospital teams: ABDM and ABHA, hospital software, data security and the tools changing how care is delivered.",
    icon: "cpu",
    tint: "#f3f5f9",
    ink: "#0f62fe",
    kind: "business",
  },
  {
    slug: "regulatory-compliance",
    name: "Regulatory & compliance",
    description: "The rules hospitals work within, explained: NABH, ABDM, the DPDP Act, IRDAI circulars and clinical law, with checklists you can act on.",
    icon: "shield-check",
    tint: "#f3f5f9",
    ink: "#851b7f",
    kind: "business",
  },
];

const BY_SLUG = new Map(BLOG_CATEGORIES.map((c) => [c.slug, c]));

export function getCategory(slug: CategorySlug): BlogCategory {
  // ponytail: the schema enum guarantees the slug exists, so this never misses.
  return BY_SLUG.get(slug) as BlogCategory;
}
