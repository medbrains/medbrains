// ─────────────────────────────────────────────────────────────
//  Site config from env (per-environment). See .env.example.
//  Fallbacks keep local `pnpm dev` working with no .env.
//  Vars must be prefixed PUBLIC_ to reach the build.
// ─────────────────────────────────────────────────────────────

const env = import.meta.env;

export const SITE = {
  brand: env.PUBLIC_BRAND ?? "MedBrains",
  tagline: env.PUBLIC_TAGLINE ?? "The whole hospital, on one system.",
  domain: env.PUBLIC_DOMAIN ?? "medbrains.in",
  email: env.PUBLIC_EMAIL ?? "hello@medbrains.in",
  // Where hospital staff sign in — the app, not this site.
  app: env.PUBLIC_APP_URL ?? "https://app.medbrains.in",
};

// WhatsApp Business — international format, digits only, no + or spaces.
export const WHATSAPP = {
  number: env.PUBLIC_WHATSAPP ?? "917200026117",
  prefilledText: "Hi MedBrains, I'd like a demo for our hospital.",
};

export const SOCIAL = {
  facebook: env.PUBLIC_FACEBOOK ?? "https://www.facebook.com/share/17i9Q7CDHs/?mibextid=wwXIfr",
  instagram: env.PUBLIC_INSTAGRAM ?? "https://instagram.com/medbrains_official",
  // Shown only once set: a link to a placeholder page is worse than none.
  linkedin: env.PUBLIC_LINKEDIN ?? "",
};

// Contact form -> Formspree (no backend). Create a form at https://formspree.io,
// then set PUBLIC_FORMSPREE_ID to the form id (last path segment of the endpoint).
// Unset, the form sends the request on WhatsApp instead.
export const FORMSPREE_ID = env.PUBLIC_FORMSPREE_ID ?? "";
