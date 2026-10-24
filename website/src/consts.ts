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
  // The copy the app serves at its own root signs in on its own host (/login).
  signIn: env.PUBLIC_SIGN_IN_URL ?? `${env.PUBLIC_APP_URL ?? "https://app.medbrains.in"}/login`,
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
  x: env.PUBLIC_X ?? "",
  youtube: env.PUBLIC_YOUTUBE ?? "",
};

// Every official profile that exists, for schema.org `sameAs`, so search and AI
// tools tie them to one company. TODO: add the LinkedIn company page and
// Crunchbase once they exist (set PUBLIC_LINKEDIN; never a placeholder URL).
export const SAME_AS = [
  ...Object.values(SOCIAL),
  "https://github.com/medbrains",
  "https://www.producthunt.com/products/medbrains",
].filter(Boolean);

// The demo form files a lead in MedBrains' own Marketing → Enquiries, under this
// hospital code (the server must also list the site in CORS_ORIGIN and have
// "Accept enquiries from our website" switched on). Unset, it opens WhatsApp.
export const ENQUIRY_TENANT = env.PUBLIC_ENQUIRY_TENANT ?? "";

// Microsoft Clarity project id (clarity.microsoft.com → Settings → Setup).
// Unset: no analytics and no consent banner.
export const ANALYTICS = {
  clarityId: env.PUBLIC_CLARITY_ID ?? "",
};
