// ─────────────────────────────────────────────────────────────
//  Site config from env (per-environment). See .env.example.
//  Fallbacks keep local `pnpm dev` working with no .env.
//  Vars must be prefixed PUBLIC_ to reach the build.
// ─────────────────────────────────────────────────────────────

const env = import.meta.env;

export const SITE = {
  brand: env.PUBLIC_BRAND ?? "MedBrains",
  tagline: env.PUBLIC_TAGLINE ?? "The hospital management system built audit-ready.",
  domain: env.PUBLIC_DOMAIN ?? "medbrains.com",
  email: env.PUBLIC_EMAIL ?? "hello@medbrains.com",
};

// WhatsApp Business — international format, digits only, no + or spaces.
export const WHATSAPP = {
  number: env.PUBLIC_WHATSAPP ?? "917200026117",
  prefilledText: "Hi MedBrains, I'd like a demo for our hospital.",
};

export const SOCIAL = {
  facebook: env.PUBLIC_FACEBOOK ?? "https://www.facebook.com/share/17i9Q7CDHs/?mibextid=wwXIfr",
  instagram: env.PUBLIC_INSTAGRAM ?? "https://instagram.com/medbrains_official",
  github: env.PUBLIC_GITHUB ?? "https://github.com/YOUR_ORG/medbrains",
  linkedin: env.PUBLIC_LINKEDIN ?? "https://linkedin.com/company/YOUR_PAGE",
};

// Contact form -> Formspree (no backend). Create a form at https://formspree.io,
// then set PUBLIC_FORMSPREE_ID to the form id (last path segment of the endpoint).
export const FORMSPREE_ID = env.PUBLIC_FORMSPREE_ID ?? "YOUR_FORM_ID";
