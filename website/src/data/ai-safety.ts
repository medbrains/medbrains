// /ai-and-data-safety and the llms.txt section read from here, so the two never disagree.
//
// Honesty rule (2026-10-25): LIVE lists only what origin/main does today, each line checked
// against the code named beside it. COMMITMENTS are policy we hold ourselves to; the redaction
// layer, the AI actor in the audit log and India-hosted models are being built now (phase 0)
// and must move to LIVE only once merged and deployed.

/** What AI in MedBrains is for, and what it never does (founder rule, 2026-10-25). */
export const SCOPE = {
  helps: [
    "Is this pre-authorisation packet complete, and which documents are missing?",
    "Which discharge clearances are still pending for this patient?",
    "Which fields in this record are missing, contradictory or implausible?",
    "Which critical results have not been acknowledged yet?",
    "Drafting a note from what is already recorded, for a clinician to check and sign",
  ],
  // True today: medbrains-ai never creates, stages or signs an order (#4895); its prescription
  // draft is text for the clinician. "No clinical suggestions" for new features sits in COMMITMENTS.
  never: [
    "Make a diagnosis",
    "Decide a treatment or a dose",
    "Create, place or sign an order",
    "See or do more than the person signed in",
  ],
};

/** In the product today. */
export const LIVE = [
  // medbrains-ai: read tools dispatch through the app's own router (auth, RLS, permissions, audit).
  { title: "Only what you can see", body: "The assistant reads through the same screens and permissions as the person using it. It cannot open a record that person could not." },
  // medbrains-ai chat grounding: allergies, medicines and problems only; never name, UHID or identifiers.
  { title: "Clinical facts, not identities", body: "When the assistant is given a patient's context, it receives clinical facts such as allergies and active medicines, never the name, UHID or other identifiers." },
  // medbrains-ai: MentalHealthViewer withholds mental-health entries outside the treating team.
  { title: "Mental-health records withheld", body: "Mental-health entries the user may not see are withheld from the assistant too." },
  // Intelligence.astro: AI-drafted chip, inserted only by the clinician.
  { title: "Labelled, then signed", body: "Anything the assistant drafts carries an AI label and reaches the case sheet only when a clinician inserts it. It never creates or signs an order." },
  { title: "On the audit trail", body: "Every lookup the assistant makes is recorded on the audit trail, under the user it acted for." },
];

/** Our AI commitments: policy every AI feature is held to before release. */
export const COMMITMENTS = [
  { title: "No clinical suggestions", body: "New AI features are limited to operational checks and data quality. They do not suggest diagnoses, treatments or doses." },
  { title: "Exactly on point", body: "No more and no less than the task needs. Every fact in an answer traces back to a field in the record." },
  { title: "Flag, don't guess", body: "If the record does not say it, the AI says so instead of filling the gap." },
  { title: "A person approves", body: "A clinician or staff member approves every action. The AI prepares; people decide." },
  { title: "Always labelled", body: "Everything the AI drafts is marked as AI-drafted wherever it appears." },
  { title: "Recorded as AI", body: "Every AI action is recorded in the audit trail as the AI acting on behalf of a named user." },
  { title: "Never more than you", body: "The AI can never see or do more than the person signed in." },
];

/** Protecting patient data when AI is used: commitments, being built into every AI feature now. */
export const PROTECTION = [
  "Names, phone numbers, UHID, ABHA, Aadhaar, PAN, bank, card and UPI details and policy numbers are replaced with placeholders before any AI model sees the data.",
  "Sensitive categories, including HIV status, mental health, PCPNDT and medico-legal records, are left out entirely.",
  "Each task gets only the fields it needs, nothing else from the record.",
  "Patient data goes to AI models hosted in India (AWS Mumbai) by default, with no third-party routers in between.",
  "No patient data is used to train AI models.",
  "If any protection fails, the AI does not run, and says so.",
];

export const HOW_WE_CHECK = "Every AI feature must pass our test suite for accuracy and data leakage before release: answers checked against the source record for anything added or left out, and every output checked for identifiers that should never be there.";

/** Data safety across MedBrains, in place today. */
export const DATA_LIVE = [
  // migrations 1200_rls_gap_tables + #4989: RLS on every table holding hospital data.
  { title: "Every hospital sealed off", body: "Each hospital's data is isolated by row-level security in the database itself, not only in the app." },
  // Prod pool switched to medbrains_app 2026-10-24 10:48 UTC (verified: subject to RLS).
  { title: "A restricted database role", body: "The application connects to the database as a restricted role, so even the app itself cannot step around each hospital's row-level rules." },
  { title: "Role-based permissions", body: "Every request is checked on the server against the user's role, with per-user extra or denied permissions." },
  // medbrains-mfa (TOTP), SSO login.
  { title: "Two-factor sign-in and SSO", body: "Authenticator-app codes with one-time recovery codes, required by role if the hospital chooses, and single sign-on." },
  { title: "Every access audited", body: "Who saw or changed what, and when." },
  // docs/ops/BACKUP-RESTORE.md: nightly pg_dump + hourly host check.
  { title: "Daily backups", body: "A full database backup every day, and an hourly check that the latest one landed." },
  { title: "Hosted in India, or on your servers", body: "Our hosting runs in AWS Mumbai. Or install MedBrains on your own servers and patient data never leaves the building." },
];

/** Data safety commitments still being completed. */
export const DATA_NEXT = [
  "Encrypted off-site copies of every backup, and regular restore tests.",
  "A written incident response plan under CERT-In rules, with prompt notice to the hospital so it can meet its DPDP duties.",
];

/** Promises that already bind us (see /terms). */
export const DATA_PROMISES = [
  "Your hospital owns its data. For patient data we are a data processor under the DPDP Act, 2023, working only on your instructions under a data processing agreement.",
  "A full export whenever you ask; when you leave, we return your data and delete our copies.",
  "We never sell data, and no money from pharmaceutical companies or advertisers reaches the product.",
];

export const AI_FAQ = [
  { q: "Does MedBrains AI diagnose or suggest treatment?", a: "No. It does not diagnose, and it never decides, places or signs an order: diagnosis, treatment and dose stay with the clinician. Today the assistant can write out a prescription a clinician asks for, checked against the patient's allergies and drug safety rules, as text the clinician decides whether to use. New AI features are limited to operational checks and data quality, such as a missing pre-auth document or an unacknowledged critical result." },
  { q: "Can the AI see records I cannot?", a: "No. The assistant reads through the same screens and permissions as the person using it, and every lookup is on the audit trail." },
  { q: "Is patient data used to train AI models?", a: "No. We do not use patient data to train AI models." },
  { q: "Where does the AI run?", a: "For patient data our standard is AI models hosted in India (AWS Mumbai), with no third-party routers in between. Each hospital's AI provider is set in its own settings." },
  { q: "What happens if the protections fail?", a: "The AI does not run. You see a message that it could not run safely, and the work carries on without it." },
  { q: "Who owns our hospital's data?", a: "Your hospital does. We process patient data only on your instructions, export it whenever you ask, and return and delete it when you leave." },
  { q: "Is MedBrains certified?", a: "We do not claim certifications we do not hold. MedBrains is built for ABDM, NHCX and UHI but not yet certified by NHA, and we act as a data processor under the DPDP Act, 2023." },
];
