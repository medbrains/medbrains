// Every price on /pricing lives here, so a change is one edit in one file.
// DRAFT: every figure is a proposal awaiting the founder's confirmation.
// Prices are in rupees, exclusive of GST (18% on software and services).

/** Shows the "draft, prices to be confirmed" banner and keeps the page out of search. */
export const PRICING_DRAFT = true;

/** The numbers the plans and the bed calculator are built from. */
export const RATES = {
  clinicMonthly: 8000,
  clinicMaxBeds: 10,
  clinicDoctors: 5,
  extraDoctorMonthly: 1200,
  perBedMonthly: 600,
  minBeds: 25,
  hospitalMaxBeds: 200,
  clinicSetup: 40000,
  hospitalSetup: 250000,
};

/** ₹ in the Indian grouping: 720000 → "₹7,20,000". */
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const GST_NOTE = "All prices exclude GST at 18%. Subscriptions are billed annually in advance.";

export interface Plan {
  id: string;
  name: string;
  for: string;
  /** The headline figure, e.g. "₹30,000". Empty for "talk to us". */
  price: string;
  unit: string;
  /** The line under the price: what the figure covers. */
  detail: string;
  setup: string;
  includes: string[];
  cta: { label: string; href: string };
  recommended?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "clinic",
    name: "Clinic",
    for: `Clinics, polyclinics and day-care centres, up to ${RATES.clinicMaxBeds} beds`,
    price: inr(RATES.clinicMonthly),
    unit: "/ month",
    detail: `Up to ${RATES.clinicDoctors} doctors. Each further doctor ${inr(RATES.extraDoctorMonthly)} a month.`,
    setup: `Go-live from ${inr(RATES.clinicSetup)}, one time`,
    includes: [
      "OPD, appointments and prescriptions",
      "GST billing and a pharmacy counter",
      "Patient app and a TV token board",
      "Remote setup and 2 training sessions",
      "Help on working days",
    ],
    cta: { label: "Book a demo", href: "#demo" },
  },
  {
    id: "hospital",
    name: "Hospital",
    for: `Hospitals from ${RATES.clinicMaxBeds + 1} to ${RATES.hospitalMaxBeds} beds`,
    price: inr(RATES.perBedMonthly),
    unit: "/ bed / month",
    detail: `Minimum ${RATES.minBeds} beds (${inr(RATES.minBeds * RATES.perBedMonthly)} a month).`,
    setup: `Go-live from ${inr(RATES.hospitalSetup)}, one time`,
    includes: [
      "Every module: OPD, IPD, lab, pharmacy, OT and more",
      "Cashless and TPA billing",
      "Staff and patient apps, TV boards, kiosk",
      "Clinical AI assistant",
      "Your own go-live lead, training on site",
      "Urgent help within 1 hour, 8 am to 10 pm daily",
    ],
    cta: { label: "Book a demo", href: "#demo" },
    recommended: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    for: `Hospitals above ${RATES.hospitalMaxBeds} beds, medical colleges, groups and on-premise installs`,
    price: "",
    unit: "",
    detail: "Yearly subscription, or a one-time licence for your own servers plus 18% a year for upkeep.",
    setup: "Go-live planned with you",
    includes: [
      "Everything in Hospital",
      "Many hospitals, one patient record",
      "Your own servers or a dedicated cloud",
      "A go-live team on site",
      "Support terms written into the contract",
    ],
    cta: { label: "Talk to us", href: "#demo" },
  },
];

/** The licence-waived programme for charitable, trust and government hospitals. */
export const CARE = {
  name: "MedBrains Seva Programme",
  pitch:
    "The same MedBrains that runs commercial hospitals, with every clinical, safety and compliance module, for registered charitable, trust and government hospitals. The software licence is waived. You pay only for installation and annual care, at cost, from the rate card below.",
  anchor: `For a 100-bed hospital the licence is worth ${inr(100 * RATES.perBedMonthly * 12)} a year on the Hospital plan. In the programme it is waived.`,
  funding: "Our commercial customers fund this programme. Installation and care are charged at cost, so every programme hospital covers the work it needs and nothing more.",
  rateCard: {
    head: ["Beds", "Installation and training, one time", "Annual care"],
    rows: [
      ["Up to 50", "₹1,50,000", "₹90,000 a year"],
      ["51 to 150", "₹2,50,000", "₹1,80,000 a year"],
      ["151 to 300", "₹4,00,000", "₹3,00,000 a year"],
      ["Above 300", "Quoted", "Quoted"],
    ],
    note: "Annual care covers hosting in AWS Mumbai, daily backups, updates and security patches, and support on working days. On your own servers, annual care is ₹36,000 a year less. Software licence: waived.",
  },
  eligibility: [
    "A public charitable trust, a registered society or a Section 8 company that runs a hospital, with valid 12A and 80G registration",
    "Or a government or public-sector hospital or health centre",
    "Free or concessional care as a stated part of the hospital's work: hospitals that bill most patients at market rates belong on a commercial plan",
  ],
  documents: [
    "Trust deed, society registration certificate or Section 8 licence",
    "12A and 80G certificates, or the NGO Darpan ID",
    "For government hospitals: a government order or authority letter",
    "The last audited accounts",
  ],
  process: "We review every application ourselves and reply within 7 working days. Membership is renewed every year. Places are limited by how many go-lives our team can do well, and we may decline an application.",
  cta: { label: "Apply for the Seva Programme", href: "?from=seva-programme#demo" },
};

/** Promises that hold on every plan, paid or not. */
export const COMMITMENTS = [
  "Every patient-safety feature is in every plan. Safety is never an upgrade.",
  "No money from pharmaceutical companies or advertisers reaches the product.",
  "We never sell clinical data.",
  "Your data is yours: a full export whenever you ask.",
  "24 months' notice before we change the Seva Programme's terms.",
];

/** What implementation and annual care include, on every plan. */
export const INCLUDED = [
  { title: "A named implementation lead", body: "One person from our team owns your go-live from the first meeting to the 30 days after it." },
  { title: "Training on your floor", body: "Front desk, doctors, nurses, pharmacy, lab and billing trained on the screens they will use, in English or Tamil." },
  { title: "Your data brought across", body: "Patients, tests, drugs and tariffs moved from your current system or spreadsheets, checked before go-live." },
  { title: "99.5% uptime target", body: "Cloud hospitals run in AWS Mumbai, so patient data stays in India. Uptime is measured and reported to you." },
  { title: "Daily backups, tested restores", body: "Backups every day with 30 days of recovery, and a restore drill every quarter to prove they work." },
  { title: "Security built in", body: "Each hospital is sealed off in the database itself, every access is audited, and sign-in supports two-factor." },
];

/** The AI promise on the page. Each line is what the assistant does today (medbrains-ai). */
export const AI = {
  title: "AI built in, not bolted on",
  body: "The assistant ships with the Hospital and Enterprise plans. It works inside each user's own permissions, so it can never show someone a record their role cannot open.",
  points: [
    "Notes it drafts carry an AI label and reach the case sheet only when a clinician inserts them",
    "Checks the patient's recorded allergies before it suggests a medicine, and never creates or signs an order",
    "Every lookup it makes lands on the audit trail",
  ],
  caveat: "It supports clinicians; it does not diagnose. Fair use covers everyday questions and drafts; very heavy use of a hosted model is billed at the model provider's cost.",
};

export const ADD_ONS = [
  { title: "Clinical AI for clinics", body: "The assistant on the Clinic plan: ₹1,500 a month per clinic, fair use." },
  { title: "ABDM and NHCX", body: "Built for ABHA linking, record sharing and NHCX claims. Priced once NHA certification is complete; not yet certified." },
  { title: "SMS and WhatsApp messages", body: "Reminders and reports to patients, billed at the provider's cost with no mark-up." },
  { title: "Extra training days", body: "₹12,000 a day on site, ₹6,000 a day online, plus travel outside Tamil Nadu." },
  { title: "Large data migrations", body: "Beyond patients and masters, such as old bills or lab history: quoted once we have seen the data." },
  { title: "Dedicated cloud server", body: "Your own server instead of the shared one, at AWS cost plus 15% for running it." },
];

export const PRICING_FAQ = [
  { q: "How much does MedBrains cost?", a: `Clinics ${inr(RATES.clinicMonthly)} a month. Hospitals ${inr(RATES.perBedMonthly)} a bed a month, with a ${RATES.minBeds}-bed minimum. Both are billed yearly, plus a one-time go-live fee. Above ${RATES.hospitalMaxBeds} beds and groups get a quote. GST at 18% is extra.` },
  { q: "Is MedBrains free for charitable hospitals?", a: "Registered charitable, trust and government hospitals can apply to the MedBrains Seva Programme. The software licence is waived; the hospital pays installation and annual care at cost, from a published rate card. Membership is renewed every year." },
  { q: "What is included in implementation?", a: "A named implementation lead, setup of your departments, tariffs and forms, migration of patients and masters, on-site training, and 30 days of close support after go-live." },
  { q: "Do you charge per user?", a: "No. Hospital plans are priced by beds, so you can add staff logins without a bill for each one. Clinics are priced by doctors." },
  { q: "Can we run it on our own servers?", a: "Yes. Enterprise hospitals can take a perpetual on-premise licence with annual maintenance at 18% of the licence, which covers updates and support." },
  { q: "How do we pay?", a: "Subscriptions are invoiced annually in advance. Implementation is invoiced half at signing and half at go-live. GST at 18% is added to every invoice." },
  { q: "Is the AI assistant extra?", a: "It is included in the Hospital and Enterprise plans with fair use, and is an add-on for clinics. It drafts and answers inside each user's permissions; a clinician always signs." },
  { q: "What happens if we stop paying?", a: "Clinical care is never blocked. After a grace period, billing and admin screens lock. Your data is yours, and we hand over a full export." },
];
