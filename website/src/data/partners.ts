// Everything /partners and /sponsors say lives here, so a change is one edit in one file.
// Partner programme approved by the founder 2026-11-01: three tracks, two levels.

export const PARTNER_WHY =
  "Hospitals are asking us to set up MedBrains faster than we can. We are looking for partners who can install, train and support it near those hospitals.";

/** What a partner gets. */
export const PARTNER_GETS = [
  { title: "Hospitals near you", body: "Requests from your region come to you once you are certified." },
  { title: "Free software", body: "MedBrains is free and open source. You earn from setup, training and support." },
  { title: "Training and certificates", body: "Courses, test installs and a certificate your team can show hospitals." },
  { title: "A direct line to us", body: "Early release notes, help with hard cases, and a say in what we build next." },
];

/** The three certification tracks. */
export const TRACKS = [
  {
    title: "Implementation",
    who: "Every partner",
    body: "Install and upgrade MedBrains, set up departments, roles and prices, move a hospital's data across, back up and restore, and train staff. No coding.",
  },
  {
    title: "Developer",
    who: "Partners who customise",
    body: "Rust basics, then how MedBrains is built: modules, permissions, safe database queries and tests. You finish by building a small module that passes our checks.",
  },
  {
    title: "Clinical and compliance",
    who: "Partners going live in hospitals",
    body: "Patient safety and NABH basics, ABDM and insurance claims, DPDP privacy duties, and drug rules such as NDPS and Schedule H.",
  },
];

/** The two partner levels. */
export const LEVELS = [
  {
    title: "Certified partner",
    needs: ["Implementation track", "Clinical and compliance track"],
    gets: ["Listed on medbrains.in by region", "Hospital requests from your region", "Use of the Certified Partner badge"],
  },
  {
    title: "Premier partner",
    needs: ["All three tracks", "At least one Rust developer", "Hospitals live on MedBrains"],
    gets: ["Everything in Certified", "Joint bids on large projects", "A say in the roadmap and shared marketing"],
  },
];

/** Rules that protect hospitals and patients. */
export const PARTNER_RULES = [
  "Install official MedBrains releases, or say clearly when a version has been changed.",
  "Do not call a changed version \"MedBrains\" or use our logo outside the partner badge.",
  "Report security problems to us privately first.",
  "Follow the DPDP Act and keep no copies of a hospital's data.",
];

export const PARTNER_STEPS = [
  { title: "Apply", body: "Tell us about your company below." },
  { title: "Get certified", body: "Your team takes the tracks for the level you want." },
  { title: "Go live", body: "We send you hospitals in your region and stay with you on the first one." },
];
