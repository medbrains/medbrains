// What the page says. Every claim here maps to something shipped in the
// product (medbrains/apps, medbrains/crates) — keep it that way: a hospital
// buyer checks claims in the demo.

export const STATS = [
  { value: "100+", count: 100, suffix: "+", label: "Screens across the hospital" },
  { value: "98", count: 98, suffix: "", label: "Ready reports" },
  { value: "1,000+", count: 1000, suffix: "+", label: "Permission controls" },
  { value: "4", count: 4, suffix: "", label: "Native apps, iOS + Android" },
];

/** The departments, as the product's own menu names them. */
export const DEPARTMENTS = [
  "OPD", "Appointments", "Telemedicine", "Emergency", "IPD", "ICU", "Nursing", "OT",
  "Laboratory", "Radiology", "Blood bank", "Pharmacy", "Home delivery", "Billing",
  "Insurance & TPA", "Front office", "Token queues", "Health camps", "Home healthcare",
  "Chronic care", "Diet & kitchen", "CSSD", "Housekeeping", "Biomedical", "Ambulance",
  "Procurement", "Ward stock", "HR & payroll", "Medical records", "Infection control",
  "Quality & NABH", "Consent", "Marketing", "Health packages", "Command center",
  "Ophthalmology", "Dental", "Cath lab", "Endoscopy", "Psychiatry", "Maternity",
  "Palliative care", "Clinical trials", "Long-term care", "Occupational health",
];

/** One patient's day, step by step — each step a real screen. */
export const JOURNEY = [
  {
    step: "Registration",
    title: "One UHID, no duplicates",
    body: "The desk registers in under a minute. A fuzzy duplicate check runs first, so one person never gets two records — and the campaign that brought them in is recorded.",
    tag: "Front desk",
  },
  {
    step: "Token & queue",
    title: "The waiting room knows who's next",
    body: "A token is issued and called on the TV board in the waiting area. Priority patients move up by rule, not by who shouts loudest.",
    tag: "TV board",
  },
  {
    step: "Consultation",
    title: "One case sheet, every visit",
    body: "Vitals, history, coded diagnoses (ICD), orders and the prescription in one record. Repeat last visit's prescription in a single action.",
    tag: "Doctor",
  },
  {
    step: "Lab & radiology",
    title: "Results that can't be released half-done",
    body: "The worklist names every patient, a test can't be completed without its results, and critical values are flagged to the doctor.",
    tag: "Diagnostics",
  },
  {
    step: "Pharmacy",
    title: "Dispense, refill, deliver home",
    body: "Schedule H, H1 and X rules enforced at the counter. Patients ask for refills from the app, the doctor approves, and a runner delivers to the door against a code.",
    tag: "Pharmacy",
  },
  {
    step: "Billing",
    title: "Every charge, reconciled",
    body: "GST-correct invoices, advances, insurance and TPA. A deleted bill never counts towards what a patient owes.",
    tag: "Cashier",
  },
  {
    step: "Admission & discharge",
    title: "Beds, wards and the discharge summary",
    body: "Ward and bed picker, bed transfers, nursing charting and the discharge summary.",
    tag: "IPD",
  },
];

/** Departments grouped for the module explorer. */
export const MODULE_GROUPS = [
  {
    id: "clinical",
    label: "Clinical",
    blurb: "Everything a doctor and nurse touch, in one record.",
    items: ["OPD & case sheet", "Emergency & MLC", "IPD, ICU & nursing", "Operation theatre", "Telemedicine", "Order sets", "Specialty clinics", "Home visits"],
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    blurb: "Orders in, results out, nothing lost between.",
    items: ["Laboratory worklist", "Critical-value alerts", "Radiology & body-site atlas", "Blood bank", "Sample tracking", "Turnaround reports"],
  },
  {
    id: "pharmacy",
    label: "Pharmacy",
    blurb: "Safe dispensing from counter to doorstep.",
    items: ["Schedule H / H1 / X rules", "NDPS register", "Refills with doctor sign-off", "Home delivery & runners", "Multi-store stock", "FEFO batches & expiry"],
  },
  {
    id: "revenue",
    label: "Revenue",
    blurb: "Bills that are right the first time.",
    items: ["GST billing & advances", "Insurance & TPA", "Health packages", "Payment collection", "Revenue reports", "Billing worklist"],
  },
  {
    id: "operations",
    label: "Operations",
    blurb: "The building behind the bedside.",
    items: ["Token queues & TV boards", "Beds & housekeeping", "CSSD & biomedical", "Procurement & ward stock", "HR, rosters & payroll", "Command center"],
  },
  {
    id: "growth",
    label: "Growth",
    blurb: "Know where patients come from — and bring more.",
    items: ["Campaigns & attribution", "Enquiries & callbacks", "Health camps", "Patient app & refills", "Outreach with consent", "Acquisition reports"],
  },
];

export const SURFACES = [
  { kicker: "Web", title: "Every desk in the building", body: "Browser workstations for OPD, wards, labs, pharmacy and admin. Light and dark themes. Nothing to install." },
  { kicker: "Staff app", title: "Rounds in your pocket", body: "Native iOS and Android apps for doctors, nurses, reception, camps and delivery runners." },
  { kicker: "Patient app", title: "The hospital, for the patient", body: "Appointments, results, medicines, bills and prescription refills on iOS and Android." },
  { kicker: "TV boards", title: "Read across the waiting room", body: "Token and queue boards that update live as patients are called." },
];

export const TRUST = [
  { title: "NABH-aligned workflows", body: "Patient identification, medication safety, consent and incident reporting built into the screens, with NABH indicators tracked." },
  { title: "ABDM / ABHA", body: "Link a patient's ABHA at registration; records follow FHIR R4 for exchange." },
  { title: "Drug law at the counter", body: "Schedule H, H1, X and NDPS rules enforced when dispensing, with the register kept for you." },
  { title: "Consent, DPDP-ready", body: "Patients agree to WhatsApp and email updates per channel, and can withdraw as easily as they agreed." },
  { title: "Every hospital sealed off", body: "Each hospital's data is isolated in the database itself, not just in the app." },
  { title: "Every access audited", body: "Who saw or changed what, and when — role permissions, SSO and two-factor sign-in." },
];

export const FAQ = [
  { q: "Is it cloud or on-premise?", a: "Either. We host it for you, or install it on your own servers so patient data never leaves the building." },
  { q: "How long does it take to go live?", a: "A single-specialty clinic can start in days. A multi-department hospital usually goes live in phases — front desk and OPD first, then pharmacy, lab, billing and IPD." },
  { q: "Can we move our existing patient records?", a: "Yes. We help you bring patients and masters — tests, drugs, tariffs — across from your current system or spreadsheets." },
  { q: "Does it work for a small clinic?", a: "Yes. You switch on only the modules you use, and add departments as you grow." },
  { q: "What about internet outages?", a: "An on-premise install runs on your own local network, so the hospital keeps working when the internet drops." },
];

/** Why we build MedBrains — the mission line and the values behind it (landing + pricing). */
export const MISSION = {
  line: "Every patient deserves safe care. Every hospital, big or small, deserves the tools to give it.",
  sub: "So the software is free, forever. Built with love for patients, for hospitals, and for well-made software.",
  values: [
    { title: "Free, forever", body: "The software and every update cost ₹0. No subscription, no charge per user." },
    { title: "Safety for everyone", body: "Every patient-safety check is free. Never an upgrade." },
    { title: "Your data is yours", body: "A full export whenever you ask. We never sell clinical data." },
    { title: "Every hospital", body: "Rural or city, charitable or private, a clinic or a group." },
  ],
};
