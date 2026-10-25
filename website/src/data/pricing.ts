// Every price on /pricing lives here, so a change is one edit in one file.
// DRAFT: every figure is a proposal awaiting the founder's confirmation.
// Prices are in rupees, exclusive of GST (18% on software and services).

/** Shows the "draft, prices to be confirmed" banner and keeps the page out of search. */
export const PRICING_DRAFT = true;

/** The monthly prices and one-time go-live fees every figure on the page is built from. */
export const RATES = {
  clinic: { monthly: 8000, setup: 40000 },
  hospital: { monthly: 25000, setup: 150000 },
  hospitalPlus: { monthly: 60000, setup: 300000 },
};

/** ₹ in the Indian grouping: 720000 → "₹7,20,000". */
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const GST_NOTE = "All prices exclude GST at 18%. Subscriptions are billed yearly in advance, plus a one-time go-live.";

export interface Plan {
  id: string;
  name: string;
  for: string;
  /** Monthly price in rupees; null for "talk to us". */
  monthly: number | null;
  setup: string;
  includes: string[];
  cta: { label: string; href: string };
  recommended?: boolean;
}

const yearly = (r: { monthly: number }) => `${inr(r.monthly * 12)} a year`;

export const PLANS: Plan[] = [
  {
    id: "clinic",
    name: "Clinic",
    for: "Clinics, polyclinics and day-care centres",
    monthly: RATES.clinic.monthly,
    setup: `Go-live from ${inr(RATES.clinic.setup)}, one time`,
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
    for: "Single-specialty and small hospitals, nursing homes",
    monthly: RATES.hospital.monthly,
    setup: `Go-live from ${inr(RATES.hospital.setup)}, one time`,
    includes: [
      "Everything in Clinic",
      "Admissions, wards, nursing and discharge",
      "Lab, pharmacy, cashless and TPA billing",
      "Staff app and the Clinical AI assistant",
      "3 days of training on site",
      "Help every day, urgent issues within 4 hours",
    ],
    cta: { label: "Book a demo", href: "#demo" },
  },
  {
    id: "hospital-plus",
    name: "Hospital Plus",
    for: "Multi-specialty hospitals with IPD, OT, ICU, lab, radiology and pharmacy",
    monthly: RATES.hospitalPlus.monthly,
    setup: `Go-live from ${inr(RATES.hospitalPlus.setup)}, one time`,
    includes: [
      "Everything in Hospital",
      "OT, ICU, radiology, emergency and blood bank",
      "Kiosk and TV boards in every department",
      "A named go-live lead on site, data brought across",
      "Urgent issues within 1 hour, 8 am to 10 pm daily",
      "A quarterly review with your management",
    ],
    cta: { label: "Book a demo", href: "#demo" },
    recommended: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    for: "Hospital groups, medical colleges and installs on your own servers",
    monthly: null,
    setup: "Go-live planned with you",
    includes: [
      "Everything in Hospital Plus",
      "Many hospitals, one patient record",
      "Your own servers or a dedicated cloud",
      "A go-live team on site",
      "Support terms written into the contract",
    ],
    cta: { label: "Talk to us", href: "#demo" },
  },
];

/** "₹96,000 a year" under each priced plan. */
export const planYear = (p: Plan) => (p.monthly ? yearly({ monthly: p.monthly }) : "Yearly subscription, or a one-time licence for your own servers plus 18% a year for upkeep.");

/** The licence-waived programme for charitable, trust and government hospitals. */
export const CARE = {
  name: "MedBrains Seva Programme",
  pitch:
    "The same MedBrains that runs commercial hospitals, with every clinical, safety and compliance module, for registered charitable, trust and government hospitals. The software licence is waived. You pay only for installation and yearly care, at cost, from the rate card below.",
  anchor: `The licence is worth up to ${yearly(RATES.hospitalPlus)}. In the programme it is waived.`,
  funding: "Our commercial customers fund this programme. Installation and care are charged at cost, so every programme hospital covers the work it needs and nothing more.",
  rateCard: {
    head: ["Matches the plan", "Installation and training, one time", "Yearly care"],
    rows: [
      ["Clinic", "₹60,000", "₹45,000 a year"],
      ["Hospital", "₹1,50,000", "₹90,000 a year"],
      ["Hospital Plus", "₹2,50,000", "₹1,80,000 a year"],
      ["Enterprise", "Quoted", "Quoted"],
    ],
    note: "Yearly care covers hosting in AWS Mumbai, daily backups, updates and security patches, and support on working days. On your own servers, yearly care is ₹36,000 a year less. Software licence: waived.",
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
  body: "The assistant ships with the Hospital, Hospital Plus and Enterprise plans. It works inside each user's own permissions, so it can never show someone a record their role cannot open.",
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
  { q: "How much does MedBrains cost?", a: `Clinic ${inr(RATES.clinic.monthly)} a month, Hospital ${inr(RATES.hospital.monthly)} a month and Hospital Plus ${inr(RATES.hospitalPlus.monthly)} a month, billed yearly, plus a one-time go-live. Groups, medical colleges and own-server installs get a quote. GST at 18% is extra.` },
  { q: "Which plan is right for us?", a: "Clinics and day-care centres take Clinic. Hospitals that admit patients take Hospital. Multi-specialty hospitals with operating theatres, an ICU or radiology take Hospital Plus. Groups, medical colleges and hospitals on their own servers take Enterprise." },
  { q: "Is MedBrains free for charitable hospitals?", a: "Registered charitable, trust and government hospitals can apply to the MedBrains Seva Programme. The software licence is waived; the hospital pays installation and yearly care at cost, from a published rate card. Membership is renewed every year." },
  { q: "What is included in go-live?", a: "Setup of your departments, tariffs and forms, training for your staff, and close support after go-live. Hospital Plus adds a named go-live lead on site and brings your patients and masters across." },
  { q: "Do you charge per user?", a: "No. Every plan is one price for the hospital, so you can add staff logins without a bill for each one." },
  { q: "Can we run it on our own servers?", a: "Yes, on Enterprise: a one-time licence for your own servers, with 18% of the licence a year for updates and support." },
  { q: "How do we pay?", a: "Subscriptions are invoiced yearly in advance. Go-live is invoiced half at signing and half at go-live. GST at 18% is added to every invoice." },
  { q: "Is the AI assistant extra?", a: "It is included in Hospital, Hospital Plus and Enterprise with fair use, and is an add-on for clinics. It drafts and answers inside each user's permissions; a clinician always signs." },
  { q: "What happens if we stop paying?", a: "Clinical care is never blocked. After a grace period, billing and admin screens lock. Your data is yours, and we hand over a full export." },
];
