// Everything /pricing says about money lives here, so a change is one edit in one file.
// Approved model (founder, 2026-10-25): software and updates free; implementation,
// customisation and AMC quoted per hospital. No price is published.

/** What every hospital and clinic gets, at ₹0. */
export const FREE = [
  { title: "Every module", body: "Registration, OPD, IPD, nursing, lab, radiology, pharmacy, OT, emergency, GST billing and cashless claims. Nothing held back." },
  { title: "Every update", body: "Each new version and feature, for as long as you run MedBrains. No upgrade fees." },
  { title: "Apps and screens", body: "Native staff and patient apps, TV token boards and the self-service kiosk." },
  { title: "Clinical AI", body: "The assistant drafts and answers within each user's permissions; a clinician always signs. Fair use applies." },
  { title: "Safety rules for everyone", body: "Allergy checks, drug-law rules at the counter, two-ID checks and the audit trail. Never an upgrade." },
  { title: "Your data, always", body: "A full export whenever you ask. It is your hospital's record, not ours." },
];

/** The ₹0 line under the hero. */
export const ZERO = ["Software licence", "Every update, for as long as you run it", "1-month pilot"];

export interface Charge {
  title: string;
  when: string;
  body: string;
  items: string[];
}

/** The three things we charge for. */
export const CHARGES: Charge[] = [
  {
    title: "Implementation",
    when: "One time, quoted after a free assessment",
    body: "Our team sets MedBrains up for the way your hospital runs, and stays until it does.",
    items: [
      "Departments, tariffs, forms and masters configured",
      "Patients, tests, drugs and tariffs brought across",
      "Every team trained on its own screens",
      "A named go-live lead and close support after go-live",
    ],
  },
  {
    title: "Customisation",
    when: "Quoted per requirement",
    body: "A report, form, integration or feature only your hospital needs, scoped with you and quoted before any work starts.",
    items: [
      "Your own report formats and print layouts",
      "Links to your machines, labs or existing software",
      "Workflows specific to your specialty",
    ],
  },
  {
    title: "AMC",
    when: "Yearly, quoted per hospital",
    body: "The Annual Maintenance Contract keeps MedBrains running well after go-live.",
    items: [
      "Help desk and support, bug fixes and monitoring",
      "Daily backups, checked",
      "Small configuration changes as you grow",
      "Hosting in AWS Mumbai (ap-south-1) if we run it for you; on your own server, AMC covers support",
    ],
  },
];

/** Costs passed through as they are. */
export const PASS_THROUGH = "SMS, WhatsApp and heavy use of a hosted AI model are passed through at the provider's cost, with no mark-up. GST at 18% is added to every invoice.";

/** From first visit to go-live (founder, 2026-10-25): nobody signs before trying it. */
export const PILOT = {
  line: "A free 1-month pilot, after the assessment and before any contract.",
  body: "We set MedBrains up for your hospital on our hosting, for the departments and modules agreed in writing before it starts. Your teams use it for a month on real work, and then you decide.",
};

export const STEPS = [
  { title: "Free assessment", body: "We see how your hospital runs today: departments, volumes and current software." },
  { title: "A written proposal", body: "Implementation, any customisation and AMC, item by item, and the scope of the pilot." },
  { title: "Free 1-month pilot", body: "MedBrains set up for your hospital, for the departments agreed in writing, for your teams to use and evaluate." },
  { title: "You decide", body: "Carry on, or stop with no obligation. If you stop, your pilot data is exported to you and deleted on request." },
  { title: "Contract", body: "An order form for the implementation, customisation and AMC in your proposal." },
  { title: "Implementation and go-live", body: "A clinic can start in days. A hospital goes live in phases, front desk and OPD first." },
  { title: "Free updates", body: "New versions and features keep arriving, at no charge." },
];

/** "Get a quote": three questions about the hospital; the answer says how go-live would look. */
export const QUOTE_QUESTIONS = [
  { name: "kind", legend: "What do you run?", options: [["clinic", "A clinic or day-care centre"], ["hospital", "A hospital or nursing home"]], value: "hospital" },
  { name: "acute", legend: "Operating theatres, an ICU or radiology?", options: [["yes", "Yes"], ["no", "No"]], value: "yes" },
  { name: "scale", legend: "Several hospitals, a medical college, or your own servers?", options: [["yes", "Yes"], ["no", "No"]], value: "no" },
];

export const QUOTE_ANSWERS: Record<string, { title: string; body: string }> = {
  clinic: { title: "A clinic set-up", body: "Usually live within days: front desk, consultation, prescriptions, billing and pharmacy." },
  hospital: { title: "A hospital go-live", body: "In phases: front desk and OPD first, then admissions, nursing, lab, pharmacy and billing." },
  acute: { title: "A multi-specialty go-live", body: "In phases across every department, OT, ICU and radiology included, with a named lead on site." },
  group: { title: "A planned roll-out", body: "Site by site, on your servers or ours, with one patient record across all of them." },
};

/** Charitable, trust and government hospitals: implementation at cost. */
export const SEVA = {
  line: "Charitable, trust and government hospitals: implementation at cost.",
  documents: [
    "Trust deed, society registration certificate or Section 8 licence",
    "12A and 80G certificates, or the NGO Darpan ID",
    "For government hospitals: a government order or authority letter",
    "The last audited accounts",
  ],
  process: "We review every request ourselves and reply within 7 working days.",
  cta: { label: "Ask us", href: "?from=seva#demo" },
};

/** Optional support for MedBrains' development. A paid service to a company: never a donation. */
export const SUPPORT_US = {
  title: "Support MedBrains (optional)",
  body: "Hospitals and organisations that value MedBrains can help it grow, in whatever way suits them.",
  ways: [
    "Lend your IT team's time to test new releases before they reach every hospital",
    "Contribute development: build or review a feature with us",
    "Share ideas: join our feature discussions and tell us what your teams need",
    "Introduce MedBrains to another hospital",
    "Sponsor a feature that every hospital then gets, or a voluntary yearly contribution",
    "Fund implementation for a charitable or government hospital",
  ],
  rules: "Entirely optional. It is never needed for the free software or its updates, and it does not change your support, which comes through AMC. Any payment is invoiced to MedBrains, a company, with GST as applicable: it is not a donation and is not tax-deductible. We do not accept sponsorship from pharmaceutical companies or advertisers.",
  cta: { label: "Talk to us about supporting MedBrains", subject: "Supporting MedBrains" },
};

/** Promises that hold for everyone. */
export const COMMITMENTS = [
  "Every patient-safety feature is free for everyone.",
  "No money from pharmaceutical companies or advertisers reaches the product.",
  "We never sell clinical data.",
  "Your data is yours: a full export whenever you ask.",
];

export const PRICING_FAQ = [
  { q: "Is MedBrains really free?", a: "Yes. The software and every update are free for every hospital and clinic, with no subscription and no charge per user. You pay for implementation, any customisation you ask for, and the yearly AMC." },
  { q: "Why is it free?", a: "Software that sits unused helps no patient. What makes a hospital system work is setting it up well, training the people who use it and keeping it running, so that is what we charge for." },
  { q: "How does MedBrains make money?", a: "From implementation, customisation and AMC. We take no money from pharmaceutical companies or advertisers, and we never sell clinical data." },
  { q: "What does implementation include?", a: "Configuring your departments, tariffs, forms and masters, bringing your patients and masters across, training every team on its own screens, and a named go-live lead with close support after go-live." },
  { q: "What does AMC cover?", a: "Help desk and support, bug fixes, monitoring, checked daily backups and small configuration changes. If we host MedBrains for you, hosting in AWS Mumbai is part of the AMC; on your own server, AMC covers support." },
  { q: "Is AMC mandatory?", a: "No, but we recommend it. AMC is how your system stays monitored, backed up and supported after go-live, and it is required if we host MedBrains for you, because hosting is part of it." },
  { q: "What if we don't renew AMC?", a: "The software keeps working, updates stay free and your data stays yours. Support and monitoring stop. If we host MedBrains for you, we give 30 days' notice and a full export of your data before hosting stops." },
  { q: "Can we try it before we commit?", a: "Yes. After the free assessment you get a free 1-month pilot: MedBrains set up on our hosting for the departments and modules agreed in writing before it starts, for your teams to use on real work. There is no obligation to continue. If you go ahead, your pilot data carries over; if you do not, we export it to you and delete it on request." },
  { q: "How much does it cost?", a: "Implementation and AMC depend on your departments and how much data comes across, so we quote them in writing after a free assessment and the free 1-month pilot, before you commit. GST at 18% is added." },
  { q: "What about AI, SMS and WhatsApp costs?", a: "Everyday AI use is free within fair use. SMS, WhatsApp and heavy use of a hosted AI model are passed through at the provider's cost, with no mark-up." },
  { q: "Can we support MedBrains?", a: "Yes, if you wish: lend your IT team to test new releases, contribute development or ideas, introduce another hospital, sponsor a feature every hospital gets, or fund implementation for a charitable or government hospital. It is optional and does not change your support. Any payment is invoiced to MedBrains with GST as applicable, not as a donation." },
  { q: "Do charitable hospitals pay less?", a: "Charitable, trust and government hospitals get implementation at cost. Send us your registration documents and we reply within 7 working days." },
];
