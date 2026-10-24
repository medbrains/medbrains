// One landing page per thing a buyer searches for (see the SEO plan). Every
// line here describes a screen or rule the product has — a buyer checks it
// in the demo, so nothing aspirational.

export interface ModulePage {
  slug: string;
  /** <title>: the search phrase first, under ~60 characters. */
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  features: { title: string; body: string }[];
  faq: { q: string; a: string }[];
  related: string[];
  /** Blog posts this page links to, and whose hospital box links back here. */
  posts?: string[];
}

export const MODULE_PAGES: ModulePage[] = [
  {
    slug: "hospital-management-software",
    title: "Hospital Management System (HMS) Software | MedBrains",
    description: "A hospital management system for Indian hospitals: registration, OPD, IPD, lab, pharmacy, GST billing and staff and patient apps on one patient record.",
    eyebrow: "Hospital management system",
    h1: "A hospital management system that runs the whole hospital",
    intro: "From the front desk to discharge, every department in this hospital management system works on the same patient record, so nothing is typed twice or lost between counters.",
    features: [
      { title: "Registration without duplicates", body: "A fuzzy duplicate check runs before a new UHID is issued, and the campaign or camp that brought the patient is recorded." },
      { title: "OPD and the case sheet", body: "Tokens, vitals, ICD-coded diagnoses, orders and prescriptions in one case sheet per visit." },
      { title: "Wards, beds and nursing", body: "Admission with a ward and bed picker, bed transfers, nursing charting and the discharge summary." },
      { title: "Lab, radiology and blood bank", body: "Worklists that name every patient, critical values flagged to the doctor, results that can't be released half-done." },
      { title: "Pharmacy to the doorstep", body: "Schedule H, H1 and X rules at the counter, refills with doctor sign-off, and home delivery against a code." },
      { title: "GST billing and insurance", body: "Advances, packages, insurance and TPA claims, credit notes and day close — reconciled." },
    ],
    faq: [
      { q: "Is it cloud or on-premise?", a: "Either. We host it, or install it on your servers so patient data stays in the building." },
      { q: "Can we start with a few departments?", a: "Yes. Switch on the modules you use — front desk and OPD first — and add the rest as you grow." },
    ],
    posts: ["why-indian-hospitals-need-a-hims", "how-medbrains-is-built-to-run-lean"],
    related: ["clinic-management-software", "pharmacy-management-software", "hospital-billing-software", "lab-management-software"],
  },
  {
    slug: "pharmacy-management-software",
    title: "Pharmacy Management Software for Hospitals | MedBrains",
    description: "Pharmacy management software for hospitals in India: Schedule H, H1, X and NDPS rules, FEFO batches, refills with doctor sign-off and home delivery.",
    eyebrow: "Pharmacy",
    h1: "Pharmacy management software that keeps the counter inside the law",
    intro: "Every dispense is checked against the drug's schedule, the patient's allergies and the prescription, and the bill carries what the Drugs Rules and GST ask for.",
    features: [
      { title: "Schedule H, H1 and X at the counter", body: "Prescription-only drugs need a prescription; Schedule H1 and X bills record the prescriber and the patient's address." },
      { title: "NDPS register", body: "Narcotic and psychotropic stock kept in its own register, with every movement recorded." },
      { title: "Batches, expiry and FEFO", body: "First-expiry-first-out picking, near-expiry and dead-stock views, and returns to the right batch." },
      { title: "Safety checks", body: "Drug interactions, allergy cross-checks, look-alike/sound-alike flags and formulary checks before dispensing." },
      { title: "Refills with sign-off", body: "Patients ask for a refill in the app; the doctor approves only the drugs that allow it, and the prescription's expiry is enforced." },
      { title: "Home delivery", body: "A runner or courier delivers to the door and hands over against the patient's one-time code; cold-chain drugs are kept off couriers." },
      { title: "A complete pharmacy bill", body: "Batch, expiry, MRP, discount, HSN with CGST and SGST, the drug licence, the pharmacist, what the patient saved, and a UPI QR for the balance." },
    ],
    faq: [
      { q: "Does it handle multiple pharmacy stores?", a: "Yes — stock is kept per store, with transfers between them." },
      { q: "Can patients pay the bill by UPI?", a: "Yes. With the hospital's UPI ID set, every bill prints a QR for the balance." },
    ],
    posts: ["antimicrobial-resistance-india"],
    related: ["hospital-billing-software", "hospital-management-software", "clinic-management-software"],
  },
  {
    slug: "hospital-billing-software",
    title: "Hospital Billing Software with GST & TPA | MedBrains",
    description: "Hospital billing software for India: GST invoices, advances, packages, insurance and TPA claims, credit notes, day close and bills patients can verify by QR.",
    eyebrow: "Billing",
    h1: "Hospital billing software that is right the first time",
    intro: "Charges flow in from the departments that earned them, priced from your charge master and rate plans, and every bill can be checked as genuine by its QR.",
    features: [
      { title: "Charges captured where they happen", body: "OPD, lab, pharmacy, radiology and room charges are added as the service is done, from the charge master." },
      { title: "GST done properly", body: "HSN/SAC per line, CGST and SGST split, and the hospital's GSTIN on every bill." },
      { title: "Advances and installments", body: "Deposits applied to bills automatically, and balances paid over time." },
      { title: "Insurance and TPA", body: "Insurance and TPA claims tracked to settlement; corporate and package billing." },
      { title: "Verifiable bills", body: "Each printed bill carries a QR an insurer or employer can scan to confirm it is genuine and unaltered." },
      { title: "Day close and audit", body: "Cashier day close, refunds and credit notes, with every change on the audit log." },
    ],
    faq: [
      { q: "Can a deleted bill still count against a patient?", a: "No. Deleted bills are kept for audit but leave every balance and list." },
    ],
    posts: ["discharge-delays-indian-hospitals"],
    related: ["pharmacy-management-software", "hospital-management-software"],
  },
  {
    slug: "lab-management-software",
    title: "Lab Management Software (LIS) for Hospitals | MedBrains",
    description: "Lab management software for Indian hospitals: worklists that name every patient, critical-value alerts to the doctor, no half-released results and TAT reports.",
    eyebrow: "Laboratory",
    h1: "Lab management software where nothing is released half-done",
    intro: "Orders arrive from the case sheet, samples move through the worklist, and results reach the doctor, critical ones first.",
    features: [
      { title: "A worklist that names patients", body: "Every sample shows whose it is, so nothing is worked from a bare number." },
      { title: "Critical values to the doctor", body: "A critical result is flagged and the ordering doctor alerted; the alert is recorded." },
      { title: "No half-released results", body: "A test can't be completed without its results." },
      { title: "Turnaround reports", body: "Turnaround time and within-target rates per test and department." },
    ],
    faq: [{ q: "Does it work with the rest of the record?", a: "Yes — orders come from the doctor's case sheet and results return to it." }],
    posts: ["antimicrobial-resistance-india"],
    related: ["hospital-management-software", "clinic-management-software"],
  },
  {
    slug: "clinic-management-software",
    title: "Clinic Management Software for India | MedBrains",
    description: "Clinic management software for Indian clinics: online booking, OPD tokens, a case sheet with ICD codes, one-tap repeat prescriptions and telemedicine.",
    eyebrow: "Clinics and OPD",
    h1: "Clinic management software built around the consultation",
    intro: "Patients book online or walk in, get a token, and see the doctor — who has the last visit, the history and the prescription in one place.",
    features: [
      { title: "Online booking", body: "A booking page for your doctors' slots, with phone OTP, that you can share on ads and WhatsApp." },
      { title: "Tokens and queues", body: "Tokens called on the waiting-room TV, with priority patients moved up by rule." },
      { title: "The case sheet", body: "Vitals, history, ICD-coded diagnoses, orders and the prescription — and last visit's prescription repeated in one action." },
      { title: "Telemedicine", body: "Video consultations on the same record." },
      { title: "A patient app", body: "Appointments, results, medicines, bills and refill requests on iOS and Android." },
    ],
    faq: [{ q: "Is it too much for a small clinic?", a: "No — switch on only what you use and add departments as you grow." }],
    related: ["opd-queue-management", "hospital-management-software", "pharmacy-management-software"],
  },
  {
    slug: "opd-queue-management",
    title: "OPD Queue Management System with Tokens | MedBrains",
    description: "An OPD queue management system for Indian hospitals: waiting-room TV boards, priority rules, self check-in and live queue updates across departments.",
    eyebrow: "Queues and tokens",
    h1: "An OPD queue management system the whole waiting room can read",
    intro: "Tokens are issued at the desk or a kiosk and called on TV boards that update live, so patients stop asking the desk who's next.",
    features: [
      { title: "TV boards", body: "Now-serving and next-up boards for each department, readable across the room." },
      { title: "Priority by rule", body: "Senior citizens, emergencies and other priorities move up by the rules you set." },
      { title: "Self check-in", body: "Patients with an appointment check themselves in at a kiosk." },
      { title: "Wait times you can measure", body: "Median wait and consult times against the usual day, on the management dashboard." },
    ],
    faq: [{ q: "Do the boards need special hardware?", a: "Any TV with a browser shows a board." }],
    related: ["clinic-management-software", "hospital-management-software"],
  },
  {
    slug: "health-camp-software",
    title: "Health Camp Management Software | MedBrains",
    description: "Health camp management software for Indian hospitals: on-site registration without duplicate records, station-by-station routes, offline working and reports.",
    eyebrow: "Health camps",
    h1: "Health camp software that feeds the hospital, not a spreadsheet",
    intro: "Register at the camp, move each person through the stations, and bring every record back into the hospital without second UHIDs.",
    features: [
      { title: "On-site registration", body: "The same duplicate check as the hospital desk: an existing patient is put on the camp's route, not registered again." },
      { title: "Camp numbers and stations", body: "Each person gets a camp number and moves through the camp's stations in order." },
      { title: "Works when the network doesn't", body: "Camp registration keeps working offline and syncs when the connection returns." },
      { title: "Campaign attribution", body: "Patients the camp brings to the hospital are counted for it in the acquisition reports." },
    ],
    faq: [{ q: "Can the camp use phones?", a: "Yes — camp registration runs in the native staff app on iOS and Android." }],
    related: ["hospital-marketing-software", "hospital-management-software"],
  },
  {
    slug: "hospital-marketing-software",
    title: "Hospital Marketing Software & Patient Leads | MedBrains",
    description: "Hospital marketing software that shows which campaign brought each patient: campaign codes, enquiries and callbacks, consent-aware outreach and ROI reports.",
    eyebrow: "Marketing",
    h1: "Know which campaign brought every patient",
    intro: "Every campaign gets a code. Patients who arrive through it, at the desk, by booking link or from an enquiry, are counted for it, with the visits and revenue that followed.",
    features: [
      { title: "Campaign codes", body: "Print the code on the ad or add it to booking links (?c=CODE); the desk can pick the campaign at registration." },
      { title: "Enquiries and callbacks", body: "Every enquiry tracked through to a visit, with callbacks that don't fall through." },
      { title: "Outreach with consent", body: "Messages go only to patients who agreed to that channel, and withdrawing is as easy as agreeing." },
      { title: "Acquisition reports", body: "New patients, visits, admissions, billed and collected revenue against spend — by campaign, channel and department." },
    ],
    faq: [{ q: "Can a wrongly tagged patient be corrected?", a: "Yes — the campaign can be changed later, and the change is audited." }],
    related: ["health-camp-software", "clinic-management-software"],
  },
];
