// Landing pages for the rules and schemes hospitals ask us about. Every fact
// carries its source number; every "does" line is a screen or rule the product
// has today (the proof is listed in the PR) — nothing aspirational, no
// certification we do not hold.

export interface Guide {
  slug: string;
  /** <title>: the search phrase first, under ~60 characters. */
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  /** A line above the facts, e.g. "not legal advice". */
  notice?: string;
  problemTitle: string;
  /** `sources` are 1-based positions in `sources`. */
  facts: { text: string; sources: number[] }[];
  does: { title: string; body: string }[];
  /** What the product does not (yet) do, said plainly under the list. */
  caveat?: string;
  faq: { q: string; a: string }[];
  sources: { title: string; url: string }[];
  /** When the facts were last checked against the sources. */
  checked: string;
  resource?: { title: string; body: string; page: string; pdf: string };
  /** Blog posts that end with a box pointing here, and its text. */
  posts: string[];
  boxText: string;
}

export const IRDAI_MC =
  "https://irdai.gov.in/documents/37343/365525/%e0%a4%b8%e0%a5%8d%e0%a4%b5%e0%a4%be%e0%a4%b8%e0%a5%8d%e0%a4%a5%e0%a5%8d%e0%a4%af+%e0%a4%ac%e0%a5%80%e0%a4%ae%e0%a4%be+%e0%a4%b5%e0%a5%8d%e0%a4%af%e0%a4%b5%e0%a4%b8%e0%a4%be%e0%a4%af+%e0%a4%aa%e0%a4%b0+%e0%a4%ae%e0%a4%be%e0%a4%b8%e0%a5%8d%e0%a4%9f%e0%a4%b0+%e0%a4%aa%e0%a4%b0%e0%a4%bf%e0%a4%aa%e0%a4%a4%e0%a5%8d%e0%a4%b0+_+Master+Circular++on+Health++Insurance+Business++29052024.pdf/5e707a91-b5de-1ec1-cf18-b66273a6839d?t=1716962621002&version=1.0";

export const RESOURCES = [
  {
    title: "DPDP readiness checklist",
    body: "Thirty-three items, each citing the section or rule it comes from — notice, consent, security, breaches, retention, rights and vendors. Fits two A4 pages.",
    page: "/resources/dpdp-readiness-checklist",
    pdf: "/downloads/dpdp-readiness-checklist.pdf",
  },
  {
    title: "Discharge time audit sheet",
    body: "One row per discharge, a timestamp for every hand-off, and a monthly summary by payer — using NABH's definition of time taken for discharge. A4 landscape.",
    page: "/resources/discharge-time-audit-sheet",
    pdf: "/downloads/discharge-time-audit-sheet.pdf",
  },
] as const;
const [DPDP_SHEET, DISCHARGE_SHEET] = RESOURCES;

/** Free web pages (no PDF): figures to cite and calculators. */
export const TOOLS = [
  {
    title: "Indian hospitals in numbers",
    body: "Official, dated figures on PM-JAY, ABHA and ABDM adoption, DHIS incentive rates and IRDAI cashless time limits, each with its source.",
    page: "/resources/indian-hospitals-in-numbers",
  },
  {
    title: "ABDM incentive calculator",
    body: "Estimate a month's Digital Health Incentive Scheme payment from linked records and consents, using the Corrigendum 7 rates.",
    page: "/resources/abdm-incentive-calculator",
  },
] as const;

export const GUIDES = {
  abdm: {
    slug: "abdm-incentive",
    title: "ABDM DHIS incentive for hospitals explained | MedBrains",
    description: "How the ABDM DHIS incentive pays Indian hospitals for digital health records, who qualifies, and what your HMIS needs: ABHA, M2 record linking and M3 consent.",
    eyebrow: "ABDM incentive",
    h1: "Get paid for going digital",
    intro: "The Digital Health Incentive Scheme pays hospitals for health records linked to patients' ABHA and for records shared with consent. The money follows the software: only transactions on a system integrated with ABDM count.",
    problemTitle: "What the scheme pays for, and the conditions",
    facts: [
      { text: "Under Corrigendum 7 to the scheme (9 April 2026), a hospital earns ₹10 for each health record linked to a KYC-verified ABHA when the record is a discharge summary or diagnostic report, and ₹5 for other types such as prescriptions and OP consultations.", sources: [1] },
      { text: "Only transactions above 100 a month are paid: the first 100 are deducted, lowest-value first. Each ABHA counts at most once a day and five times a month for a facility.", sources: [1] },
      { text: "Sharing with consent pays too: ₹10 to the hospital that asked for the records and ₹5 to each source that supplied them. PM-JAY claims filed in FHIR format through the National Health Claims Exchange (NHCX) earn ₹200 or 10% of the claim, whichever is lower.", sources: [1] },
      { text: "Creating an ABHA is not a paid transaction, and Scan & Share earns no incentive under this corrigendum. A hospital's transactions count only on software integrated with ABDM up to M3 — and from July 2026, only if that software is fully compliant with ABDM's v3 APIs for M1, M2 and M3.", sources: [1] },
      { text: "By 18 June 2026, hospitals had been paid over ₹107 crore under the scheme.", sources: [2] },
      { text: "Scan & Share still earns its place at the front desk: an IIHMR study cited by the government found it cut waits from about an hour to 2–5 minutes, and over 23.21 crore ABHA-linked tokens had been issued by 18 June 2026.", sources: [2] },
    ],
    does: [
      { title: "ABHA at registration", body: "Create an ABHA with Aadhaar OTP, or verify an existing one by ABHA number or mobile, and link it to the patient's record. The Aadhaar number is sent encrypted to ABDM and not stored." },
      { title: "Records linked to the ABHA (M2)", body: "Visits are linked to the patient's ABHA as care contexts. Records go out only under a granted, unexpired consent, as FHIR bundles encrypted for the hospital that asked." },
      { title: "Records from other hospitals (M3)", body: "Ask a patient's consent for records held elsewhere, check its status, and read what arrives. Received copies are erased when the consent is revoked or expires." },
      { title: "Scan & Share at the desk", body: "Patients scan the counter's QR code; their profile arrives in the front-office queue and they get a token. A repeat scan returns the same token." },
      { title: "Claims through NHCX", body: "Eligibility checks, pre-authorisations, claims, payer queries and payment notices exchanged with insurers over NHCX." },
      { title: "An estimate of your incentive", body: "An ABDM dashboard counts each month's records and consents by the scheme's rules — KYC-verified ABHA only, the 100 threshold, the per-ABHA limits — and estimates the amount. It is an estimate, not NHA's payout." },
    ],
    caveat: "MedBrains is built for ABDM M1–M3 on the v3 APIs and for NHCX, and is tested against the ABDM and NHCX sandboxes. It is not yet certified by NHA for production use, so we cannot tell you today that transactions on it qualify for the scheme. Ask us for the current status.",
    faq: [
      { q: "Does creating ABHAs earn money?", a: "No. Under Corrigendum 7 the money comes from records linked to KYC-verified ABHAs and from records shared with consent. An ABHA is the starting point for both." },
      { q: "How many records do we need before anything is paid?", a: "More than 100 eligible transactions in a month. The first 100 are deducted from the total, lowest-value first." },
      { q: "Is the scheme still running?", a: "Corrigendum 7 covers April to September 2026, subject to funds. When we checked on 22 October 2026 we could not find terms for later months. Check abdm.gov.in/dhis before planning on the money." },
      { q: "Does using MedBrains make us eligible?", a: "Not today. Eligibility needs the hospital's software integrated with ABDM up to M3 and compliant with the v3 APIs. MedBrains' integration is built and sandbox-tested but not yet certified for production." },
    ],
    sources: [
      { title: "NHA. Corrigendum 7 to the Digital Health Incentive Scheme for ABDM adoption (9 April 2026), as circulated by the Government of Rajasthan", url: "https://rajswasthya.rajasthan.gov.in/admin/upload/letter/2026/05/40%20Dt.05.05.2026%20NHM%20CSR%20NDHM%20(ABDM)-01779-PART-14.pdf" },
      { title: "PIB. Ayushman Bharat Digital Mission: India's digital health backbone (6 July 2026)", url: "https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/jul/doc202676912801.pdf" },
      { title: "NHA. Digital Health Incentive Scheme — scheme documents and corrigenda", url: "https://abdm.gov.in/dhis" },
    ],
    notice: "Scheme terms change by corrigendum. Corrigendum 7 covers April–September 2026; we could not find terms for later months when we checked on 22 October 2026.",
    checked: "22 October 2026",
    posts: ["why-indian-hospitals-need-a-hims", "abha-health-id-explained"],
    boxText: "What the Digital Health Incentive Scheme pays for, the conditions, and what your hospital software needs to take part.",
  },
  discharge: {
    slug: "cashless-discharge",
    title: "Cashless discharge and TPA: IRDAI 3-hour rule | MedBrains",
    description: "Cashless discharge with TPAs under IRDAI's 1-hour and 3-hour authorisation rules (Master Circular, 29 May 2024), and the discharge steps a hospital controls.",
    eyebrow: "Cashless discharge",
    h1: "Cashless discharge, without the afternoon wait",
    intro: "Insurers now have three hours to authorise a cashless discharge. That clock starts only when your request reaches them, so the summary, the bill and the file are the hospital's part of the race.",
    problemTitle: "What the rules say, and where the hours go",
    facts: [
      { text: "IRDAI's Master Circular on Health Insurance Business (29 May 2024) requires an insurer to decide on a cashless authorisation request immediately, and within one hour of receiving it. Insurers had until 31 July 2024 to put the systems in place.", sources: [1] },
      { text: "Final discharge authorisation must be granted within three hours of the insurer receiving the hospital's request. If it takes longer, any additional amount the hospital charges is borne by the insurer from its shareholders' funds, not by the patient.", sources: [1] },
      { text: "The three hours start when the request reaches the insurer — not when the doctor says the patient is fit to go. Finishing the summary, closing the bill and assembling the file before the request goes out is the hospital's time.", sources: [1] },
      { text: "NABH's 6th edition standards (effective 1 January 2025) measure time taken for discharge from the consultant's formal approval to the patient leaving the clinical unit, monthly, in minutes. Monitoring it and setting a benchmark is now a commitment element.", sources: [2] },
      { text: "An audit at AIIMS Bhubaneswar found a mean discharge time of 195 minutes, with billing clearance taking around half of it.", sources: [3] },
      { text: "A 2024 study of 1,000 discharges at a north Indian tertiary hospital found a mean of 329 minutes, with the summary reaching patients 235 minutes after the discharge instruction. After planning a day ahead and adding dedicated counters, the mean fell to 208 minutes.", sources: [4] },
    ],
    does: [
      { title: "One pre-authorisation, every stage", body: "Initial request, enhancement and final discharge authorisation are stages of one pre-authorisation, with the time each was sent and answered, the approved amount and a full status history." },
      { title: "IRDAI clocks on screen", body: "Requests sent to insurers over NHCX are timed against the one-hour and three-hour limits, and the ones that ran over are listed." },
      { title: "A discharge workflow", body: "Discharge ordered, bill closed, medicines dispensed, counselling done, card printed and bed released — step by step, on one screen per admission." },
      { title: "Summaries that are complete", body: "Discharge summary templates and drafting, and a summary can't be finalised until the fields NABH asks for are filled." },
      { title: "Discharge timing per admission", body: "Discharge started, billing, pharmacy, nursing and doctor clearance, and completion are timed for each admission, with a list of expected discharges from the expected date set at admission." },
      { title: "Bills ready on time", body: "Interim bills during the stay, advances adjusted against the final bill, and returns of unused medicines recorded against what was dispensed." },
    ],
    caveat: "Pre-authorisations and claims over NHCX are built and tested against the NHCX sandbox, not yet certified for production. Requests made through an insurer's portal or email can be recorded on the same pre-authorisation, with their times.",
    faq: [
      { q: "When does the IRDAI three-hour clock start?", a: "When the insurer receives the hospital's request for final discharge authorisation — not when the doctor declares the patient fit to go (IRDAI Master Circular, 29 May 2024)." },
      { q: "What happens if the insurer takes longer than three hours?", a: "Any additional amount the hospital charges because of the delay is to be borne by the insurer from its shareholders' funds, not by the patient." },
      { q: "Does NABH set a fixed time limit for discharge?", a: "The 6th edition asks each hospital to monitor discharge time, set its own benchmark and improve on it. The 180 minutes often quoted is not written into the standard as a national limit." },
      { q: "Where do we start?", a: "Time every step for a month — the audit sheet on this page has a column for each — and work on whichever step is slowest." },
    ],
    sources: [
      { title: "IRDAI. Master Circular on Health Insurance Business, IRDAI/HLT/CIR/PRO/84/5/2024 (29 May 2024)", url: IRDAI_MC },
      { title: "NABH. Accreditation Standards for Hospitals, 6th edition (effective 1 January 2025)", url: "https://portal.nabh.co/images/Standards/NABH%20Hospital%20Accreditation%20Standard%206th%20Edition%20January%202025.pdf" },
      { title: "Sahoo MC, Dora S, Talwar Y. Determinants of hospital discharge process: experience from an apex tertiary care institute of eastern India. 2019", url: "https://doi.org/10.5005/jp-journals-10035-1112" },
      { title: "Sharma J, Bisht YS, Saini RS. Reducing discharge delays: using DMAIC approach in a tertiary care hospital. 2025", url: "https://doi.org/10.18203/2394-6040.ijcmph20252848" },
    ],
    checked: "22 October 2026",
    resource: DISCHARGE_SHEET,
    posts: ["discharge-delays-indian-hospitals"],
    boxText: "IRDAI's three-hour rule, NABH's discharge-time indicator and the steps your hospital controls, with a free audit sheet to time each one.",
  },
  dpdp: {
    slug: "dpdp-readiness",
    title: "DPDP Act for hospitals: readiness guide | MedBrains",
    description: "The DPDP Act for hospitals in India: the 2023 Act and 2025 Rules timeline, consent, security, 72-hour breach reporting and retention, with a free checklist.",
    eyebrow: "DPDP readiness",
    h1: "Ready for the DPDP Act before May 2027",
    intro: "The main duties of the Digital Personal Data Protection Act start eighteen months after the Rules were notified. Most of them land on the registration desk, the medical records department and the hospital's software.",
    notice: "General information, not legal advice. Take advice on your own hospital's position.",
    problemTitle: "What the law asks of a hospital, and by when",
    facts: [
      { text: "The DPDP Rules were notified on 13 November 2025. Consent Manager provisions apply after one year; notice, consent, security, breach reporting, retention and patients' rights apply after eighteen months — May 2027.", sources: [2, 3, 4] },
      { text: "A hospital is a Data Fiduciary. Consent must come with a standalone, itemised notice, withdrawing must be as easy as agreeing, and in a dispute the hospital must prove notice and consent were given.", sources: [1, 2] },
      { text: "Rule 6 sets minimum safeguards: encryption, masking or tokenisation; access control; logs and monitoring to detect unauthorised access; backups; and logs kept for a year.", sources: [2] },
      { text: "After a breach, the hospital must tell affected patients and the Data Protection Board without delay, and send the Board a detailed report within 72 hours of becoming aware.", sources: [2] },
      { text: "Penalties go up to ₹250 crore for failing to take reasonable security safeguards and ₹200 crore for failing to notify a breach.", sources: [1] },
      { text: "Erasure gives way where a law requires records to be kept — such as the three years the 2002 medical ethics regulations set for indoor patients' records.", sources: [1, 5] },
    ],
    does: [
      { title: "Consent, purpose by purpose", body: "Patients agree purpose by purpose — ABDM linking, insurance claims, reminders, research — recorded with the notice version, language and where it was given. A withdrawal is a new entry, so the history stays." },
      { title: "Channel consent for messages", body: "WhatsApp and email updates go only to patients who agreed to that channel, and they can withdraw in the patient app." },
      { title: "Who saw what", body: "An append-only audit log of changes, an access log for each patient's record, break-glass reviews and alerts on unusual access." },
      { title: "Access by role, walled by hospital", body: "Role-based permissions, row-level security that keeps each hospital's data to itself, and sensitive fields masked or withheld by class." },
      { title: "A breach register with the clocks", body: "Record when a breach was discovered and track the Board's 72-hour report, the notices to each affected patient and the CERT-In six-hour report." },
      { title: "Patients' rights requests", body: "Access, correction, erasure, nomination and grievance requests tracked against a 90-day window; patients can raise them and export their record from the patient portal." },
      { title: "Retention and processors", body: "Retention periods per record type in the medical records department, and a register of the processors that handle your data." },
      { title: "Your servers, if you prefer", body: "Install on the hospital's own servers so patient data stays in the building, or let us host it." },
    ],
    caveat: "Software helps you keep the records the law asks for; it does not make a hospital compliant — your notices, policies and contracts do. Records past their retention date are flagged for a supervised destruction step rather than deleted automatically, and an approved erasure request is carried out by staff.",
    faq: [
      { q: "When do the main duties apply?", a: "Eighteen months after the Rules were notified on 13 November 2025 — May 2027. Lawyers count the date slightly differently; plan to 12 May 2027." },
      { q: "Can a patient make us delete medical records?", a: "Only where no law requires them to be kept. The Act lets a hospital retain data needed to comply with a law, such as the three-year rule for indoor patients' records." },
      { q: "Do we need parental consent to treat a child?", a: "Not for treatment. The Fourth Schedule to the Rules exempts clinical establishments and healthcare professionals, for providing health services to the child. Marketing is not covered." },
      { q: "Does ABDM consent cover the DPDP Act?", a: "In our reading, no. ABDM consent governs sharing through the ABDM network; the hospital still needs its own notice and lawful basis for billing, reminders, claims and analytics." },
    ],
    sources: [
      { title: "The Digital Personal Data Protection Act, 2023 (No. 22 of 2023), Gazette of India, 11 August 2023 (MeitY)", url: "https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf" },
      { title: "MeitY. Digital Personal Data Protection Rules, 2025, G.S.R. 846(E), 13 November 2025", url: "https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf" },
      { title: "PIB. DPDP Rules, 2025 notified (17 November 2025)", url: "https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf" },
      { title: "AZB & Partners. India's DPDP Act: phased rollout and key compliance milestones (November 2025)", url: "https://www.azbpartners.com/bank/indias-digital-personal-data-protection-act-phased-rollout-and-key-compliance-milestones/" },
      { title: "Indian Medical Council (Professional Conduct, Etiquette and Ethics) Regulations, 2002", url: "https://bnblegal.com/bareact/the-indian-medical-council-professional-conduct-etiquette-and-ethics-regulations-2002/" },
    ],
    checked: "22 October 2026",
    resource: DPDP_SHEET,
    posts: ["dpdp-act-rules-hospitals-india"],
    boxText: "The DPDP timeline and duties for hospitals in one page, and a free checklist that cites the section or rule behind each item.",
  },
} satisfies Record<string, Guide>;

export const GUIDE_LIST: Guide[] = Object.values(GUIDES);

export const guideForPost = (postId: string): Guide | undefined => GUIDE_LIST.find((g) => g.posts.includes(postId));

