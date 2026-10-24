// Buyer-intent pages under the HMS hub: a vendor-neutral buying checklist and
// software vs paper and Excel. No competitor is named and nothing is ranked.
// Every MedBrains line is checked against the product (the PR that added this
// file lists the paths); what is not built is said so, and ABDM and NHCX are
// "built for", never certified.

import type { ModulePage } from "./modules";

const link = (href: string, text: string) => `<a href="${href}">${text}</a>`;
const demo = (text: string) => `<strong>In the demo:</strong> ${text}`;

const checklist: ModulePage = {
  slug: "how-to-choose-hospital-management-software",
  parent: "hospital-management-software",
  title: "How to Choose Hospital Management Software | MedBrains",
  description: "How to choose hospital management software in India: a 25-point checklist on NABH, drug law, GST and TPA, ABDM, DPDP, data and cost, with a demo test for each.",
  eyebrow: "Buying guide",
  h1: "How to choose hospital management software in India: a 25-point checklist",
  intro: "Choose hospital management software by testing it, not by reading its brochure. Write down how your hospital actually works, then make every vendor show each of the 25 points below on screen, with your own patients, drugs and tariffs, signed in as the person who will use it. This guide says what to check and how to test it in a demo. It names no vendors and ranks none; at the end we answer the same checklist for MedBrains, including where the answer is \"not yet\".",
  sections: [
    {
      title: "Before the first demo",
      body: [
        "Most hospital software looks the same in a sales deck. The differences show up at the registration desk at 10 a.m., at the pharmacy counter and at discharge when the TPA has not replied, so run the demo the way the hospital runs.",
        "Bring the people who will use it: front desk, a doctor, a nurse, the pharmacist, billing, medical records and IT. Ask for a trial login you can use after the demo.",
      ],
    },
    {
      title: "Patients and clinical care",
      steps: [
        { title: "One patient, one record, one UHID", body: `The commonest failure is the same person registered twice, Ramesh Kumar today and R. Kumar next month, with two histories that never meet. The system should check for a likely duplicate by name, phone, date of birth and ID before it issues a new UHID, and every department should work on that one record. ${demo("register a patient, then register them again with a misspelt name and the same phone. Does it stop you?")}` },
        { title: "A case sheet a doctor will use", body: `If the consultation screen is slower than paper, doctors will write on paper. Vitals, history, diagnoses, orders and the prescription should sit on one screen, and repeating last visit's prescription should take one action. ${demo("have your busiest OPD doctor run a follow-up visit, start to finish, and time it.")}` },
        { title: "NABH workflows on the screen, not in a binder", body: `NABH assessors look for patient identification, medication safety, consent, incident reporting and complete records. Good software makes these the normal path: consent before a procedure, a discharge summary that cannot be finalised with required fields empty, and quality indicators counted from the records rather than typed in. ${demo("try to finalise a discharge summary with a field missing, and ask to see the NABH indicator report.")}` },
        { title: "Lab and radiology without gaps", body: `Orders should flow from the case sheet to the lab, the worklist should name every patient, a critical value should reach the ordering doctor with the alert recorded, and a result should not be released half-done. ${demo("enter a critical potassium and watch where the alert goes.")} See ${link("/lab-management-software", "lab management software")} for what this looks like in practice.` },
        { title: "Wards, beds and discharge", body: `Admission with a ward and bed picker, transfers, nursing charting and a discharge that moves through billing, pharmacy and nursing clearance as steps you can see. ${demo("admit, transfer and discharge one patient, and ask where the bed shows as free.")}` },
      ],
    },
    {
      title: "Pharmacy and drug law",
      start: 6,
      steps: [
        { title: "Schedule H, H1 and X at the counter", body: `Under the Drugs Rules, prescription-only drugs need a prescription, Schedule H1 sales need a register entry with the prescriber, patient and quantity, and Schedule X needs more again. The software should enforce this at the counter, not leave it to memory. ${demo("try to sell a Schedule H1 antibiotic without a prescription. It should refuse.")}` },
        { title: "NDPS register", body: `Narcotic and psychotropic stock under the NDPS Act needs its own register with every receipt, issue and balance. ${demo("dispense a controlled drug and open the register entry it created.")}` },
        { title: "Allergy, interaction and formulary checks", body: `A dispensing system should catch a documented allergy (including a cross-reacting class), a drug interaction with the patient's other medicines, and a drug off your formulary, and it should record who overrode a warning and why. ${demo("record a penicillin allergy, then prescribe amoxicillin.")}` },
        { title: "Batches, expiry and FEFO", body: `Stock by batch and expiry, first-expiry-first-out picking, near-expiry and dead-stock views. ${demo("ask which batch the system picks when two are in stock.")} More in ${link("/pharmacy-management-software", "pharmacy management software")}.` },
      ],
    },
    {
      title: "Billing, insurance and money",
      start: 10,
      steps: [
        { title: "Charges captured where they happen", body: `Billing leakage happens when a service is done and never charged: a lab test added late, a consumable used in the ward, a room day missed. Charges should come from the department that did the work, from one charge master. ${demo("order a test from the OPD and check it appears on the bill without anyone typing it.")}` },
        { title: "GST on the right lines", body: `Most healthcare services by a clinical establishment are exempt, but pharmacy sales, some consumables and room rent above ₹5,000 a day outside the ICU are not. Each line needs its HSN or SAC code and the right tax, and the bill needs your GSTIN. ${demo("bill a room above the threshold and a pharmacy item on one invoice.")}` },
        { title: "TPA, insurance and the IRDAI cashless clocks", body: `IRDAI's Master Circular of 29 May 2024 asks insurers to decide cashless requests within one hour and final discharge authorisation within three. Your software should show when each request was sent and answered, so you can see which ones ran late. ${demo("walk a cashless admission through pre-authorisation, enhancement and discharge.")} Our ${link("/cashless-discharge", "cashless discharge guide")} explains the clocks.` },
        { title: "Day close, refunds and audit", body: `Cashier day close, refunds and credit notes with a reason, and a deleted bill that stays on record but no longer counts against the patient. ${demo("delete a bill and check the patient's balance.")} See ${link("/hospital-billing-software", "hospital billing software")}.` },
      ],
    },
    {
      title: "ABDM, privacy and your data",
      start: 14,
      steps: [
        { title: "ABDM M1 to M3, and how to verify the claim", body: `The milestones are M1 (create or verify a patient's ABHA), M2 (link your records to the ABHA and share them under consent) and M3 (fetch records from elsewhere under consent). Many vendors say "ABDM-ready". Ask which milestones, whether they have passed NHA's certification for production or only work in the sandbox, and check the vendor against the list of integrated applications on the official ABDM website, abdm.gov.in. A sandbox login is not a certification. ${demo("create or verify an ABHA and link a visit to it.")} Our ${link("/abdm-incentive", "ABDM incentive guide")} explains what the incentive scheme needs.` },
        { title: "DPDP Act data handling", body: `The Digital Personal Data Protection Act's main duties apply from May 2027: notice and consent by purpose, security, breach reporting to the Board within 72 hours, retention and patients' rights. Ask how the software records consent, tracks a breach, and handles a patient's request to see or correct their data. ${demo("withdraw a patient's consent for WhatsApp messages and see what stops.")} Our ${link("/dpdp-readiness", "DPDP readiness guide")} has a checklist.` },
        { title: "Who saw what", body: `Role-based permissions, an audit log of every change, an access log per patient record, and, if the vendor hosts several hospitals, isolation of each hospital's data in the database itself. ${demo("ask to see who opened one patient's record this week.")}` },
        { title: "Data ownership and export", body: `Your contract should say the data is yours, in what format you get it if you leave, and how fast. Ask for a sample export before you sign. ${demo("export one patient's record and open the file.")}` },
        { title: "Moving in from your current system", body: `Ask what can be uploaded and how mistakes are caught: departments, beds, staff, tests, drugs and tariffs at least. A good import shows you every problem before anything is saved. ${demo("upload a sheet with a deliberate error.")} If you are on registers or spreadsheets today, read ${link("/hospital-software-vs-excel", "hospital software vs paper and Excel")}.` },
      ],
    },
    {
      title: "Running it every day",
      start: 19,
      steps: [
        { title: "On-premise or cloud", body: `Cloud means no server room; on-premise keeps patient data in the building on your local network. Ask whether both run the same product, and who patches the server.` },
        { title: "Backups and uptime", body: `Ask how often the database is backed up, where the copies go, how long they are kept, when a restore was last tested, and what uptime the vendor commits to in writing. A backup that sits on the same disk as the database does not survive the disk.` },
        { title: "When the internet goes down", body: `Ask exactly what still works with no internet: registration, billing, the pharmacy counter, results. "It's cloud, it's always up" is not an answer for a hospital on a single broadband line.` },
        { title: "Phones, TV boards and kiosks", body: `Native apps for doctors and nurses on rounds, a patient app, token boards in waiting areas and a self check-in kiosk. Ask whether the TV boards need special hardware. ${demo("call a token and watch the board.")} See ${link("/opd-queue-management", "OPD queue management")}.` },
        { title: "Training and support", body: `Who trains your staff, in which language, and what happens at 2 a.m. when billing stops. Ask for written response times and whether there is a user guide inside the product.` },
        { title: "Total cost, including hardware", body: `Add up five years: licence or subscription, implementation, migration, servers or cloud, PCs, printers, scanners, TVs, tablets, training and maintenance. Ask what is extra: users, modules, SMS, integrations.` },
        { title: "References you call yourself", body: `Ask for two hospitals of your size and type that went live in the last two years, and call them without the vendor on the line. Ask what went wrong in the first month and how long it took to fix.` },
      ],
    },
    {
      title: "How MedBrains answers this checklist",
      body: [
        "We hold ourselves to the same list. This is what MedBrains does today; where the honest answer is \"not yet\", it says so. Check any line in a demo.",
      ],
      table: {
        caption: "The 25 points, answered for MedBrains",
        head: ["Point", "MedBrains today"],
        rows: [
          ["1. One record, one UHID", "A duplicate check runs before a new UHID is issued; every department works on the same record."],
          ["2. Case sheet", "One case sheet per visit; last visit's prescription repeated in one action."],
          ["3. NABH workflows", "Identification, consent, incident reporting and NABH indicators; incomplete discharge summaries can't be finalised."],
          ["4. Lab and radiology", "Named worklists, critical values flagged to the doctor, no half-released results."],
          ["5. Wards and discharge", "Bed picker, transfers, nursing charting and a step-by-step discharge."],
          ["6. Schedule H, H1, X", "Enforced at dispensing; Schedule X also needs a witness and a duplicate prescription."],
          ["7. NDPS register", "Kept by the pharmacy module from every movement."],
          ["8. Allergy and interactions", "Allergy, interaction, AWaRe Reserve and formulary checks; overrides recorded with a reason."],
          ["9. Batches and FEFO", "FEFO picking, near-expiry and dead-stock views."],
          ["10. Charge capture", "Charges added by the department that did the work, from one charge master."],
          ["11. GST", "HSN or SAC per line, CGST and SGST, the hospital's GSTIN on every bill."],
          ["12. TPA and IRDAI clocks", "Pre-authorisations over NHCX timed against the one- and three-hour limits. NHCX is built for and sandbox-tested, not yet certified."],
          ["13. Day close and audit", "Day close, refunds and credit notes; deleted bills kept for audit but out of every balance."],
          ["14. ABDM M1 to M3", "Built for M1 to M3 on the v3 APIs and tested in the ABDM sandbox. Not yet certified by NHA for production."],
          ["15. DPDP", "Consent by purpose and channel, a breach register with the 72-hour clock, rights requests from the patient portal."],
          ["16. Who saw what", "Role permissions, audit log, per-patient access log, each hospital isolated by row-level security."],
          ["17. Data export", "A patient can download their record as FHIR R4. Self-serve export of the whole hospital's data: not yet. On your own servers, the database and its dumps are yours."],
          ["18. Migration", "Onboarding workbook (departments, wards, beds, staff) with a dry run; CSV import for lab tests and drugs. Self-serve patient list import: not yet."],
          ["19. On-premise or cloud", "Both, on the same product."],
          ["20. Backups and uptime", "Daily database dump, optional point-in-time backups, an alert if backups stop. A published uptime commitment: not yet."],
          ["21. No internet", "On-premise keeps running on the local network; camps record offline and sync. Offline mode for the cloud web app: not yet."],
          ["22. Phones, TVs, kiosks", "Native staff and patient apps (iOS, Android), token boards on any TV browser, self check-in kiosk."],
          ["23. Training and support", "An in-app user guide, still being filled module by module."],
          ["24. Total cost", "Ask us for a written quote for your hospital; hardware is your own."],
          ["25. References", "Ask us; we would rather you speak to a hospital than read a claim here."],
        ],
      },
    },
  ],
  featuresTitle: "How to run the evaluation",
  features: [
    { title: "Write your scenarios first", body: "Ten real situations from your own hospital, sent to every vendor before the demo." },
    { title: "Bring your own data", body: "Your drug list, tariff and a few anonymised patients, not the vendor's sample hospital." },
    { title: "Test and score as each role", body: "The front desk, a doctor, the pharmacist and the cashier each drive their own screens and mark each point pass, partly or no." },
  ],
  caveat: "This is general guidance on choosing software, not legal advice. The laws and circulars named here change; check the current version with your own advisers.",
  faq: [
    { q: "What is the best hospital management software in India?", a: "There is no single best hospital management software in India for every hospital. A 30-bed nursing home and a 300-bed multi-specialty hospital need different things. The right one for you is the one that passes this checklist in a demo run with your own scenarios, your own data and your own staff, and whose references confirm it." },
    { q: "What should I look for in hospital management software?", a: "One patient record with a duplicate check, clinical screens doctors will use, NABH workflows built in, drug-law rules at the pharmacy, GST and TPA billing, ABDM and DPDP handling, clear data ownership, backups, a plan for internet outages, training, and a five-year total cost." },
    { q: "How do I check a vendor's ABDM claim?", a: "Ask which milestones (M1, M2, M3) are live, whether the software has passed NHA's certification for production or only works in the sandbox, and look for it on the official ABDM website. Then create or verify an ABHA in the demo." },
    { q: "Is cloud or on-premise hospital software better?", a: "Cloud avoids running a server and keeps updates simple. On-premise keeps data in the building and keeps working on the local network when the internet drops. Choose a product that offers both so you can change your mind later." },
    { q: "How much does hospital management software cost?", a: "Compare a five-year total, not the first-year price: subscription or licence, implementation, migration, servers or cloud, PCs, printers, scanners and TVs, training and maintenance. Ask what counts as extra." },
    { q: "Does NABH require a particular hospital software?", a: "No. NABH assesses how the hospital works: identification, medication safety, consent, records and quality indicators. Software that builds those into the daily screens makes them easier to show an assessor." },
  ],
  related: ["hospital-management-software", "hospital-software-vs-excel", "hospital-billing-software", "pharmacy-management-software", "lab-management-software", "opd-queue-management"],
  relatedTitle: "Related",
};

const excel: ModulePage = {
  slug: "hospital-software-vs-excel",
  parent: "hospital-management-software",
  title: "Hospital Software vs Excel and Paper Registers | MedBrains",
  description: "Hospital software vs paper registers and Excel: where each works, where it breaks on duplicates, billing, audit trail and drug safety, and how to move across.",
  eyebrow: "Software vs Excel",
  h1: "Hospital software vs paper registers and Excel",
  intro: "Paper registers and Excel are fine for a small clinic with one doctor and a steady list of patients. They break when the same patient comes back under a different spelling, when two people edit the same file, when a charge is never billed, or when an NABH assessor asks who changed a record. Hospital software fixes those, at the cost of setting it up and training staff. Here is where each one works, where it fails, and how to move across without losing what you have.",
  sections: [
    {
      title: "Where paper and Excel work",
      body: [
        "<strong>Paper registers</strong> need no power, no network and no training. An OPD register, a ward census book and a pharmacy sale book are how many Indian hospitals still run, and for low volumes they are quick and reliable.",
        "<strong>Excel</strong> adds counting. A patient list you can filter, a monthly revenue sheet, a stock sheet with formulas. For a clinic with one or two doctors, or for a hospital tracking one thing (a camp list, a referral list), a spreadsheet is cheap and everyone knows how to use it.",
        "If that is your hospital and none of the problems below is costing you, you may not need software yet. Most hospitals move when one of these starts to hurt.",
      ],
    },
    {
      title: "Where they break",
      steps: [
        { title: "Duplicate patients", body: "A register has no way to know that Lakshmi S. today is Lakshmi Srinivasan from March. Excel can find exact matches but not a different spelling with the same phone number. Each duplicate splits a patient's history, so the doctor sees half of it." },
        { title: "Lost and overwritten records", body: "Registers get damaged and misfiled. A spreadsheet lives on one computer or in an email thread; two people save over each other, a version goes missing, and the backup is whatever someone last copied to a pen drive." },
        { title: "Billing leakage", body: "On paper the bill is built from slips that reach the counter, and anything that doesn't reach it is never charged: a test added late, a consumable from the ward, a room day. A spreadsheet adds up what was typed in; it cannot tell you what was missed. Discounts and refunds are hard to trace back to who gave them." },
        { title: "No audit trail", body: "NABH and the courts both ask who recorded what and when. A register shows an overwritten figure but not who wrote it. A spreadsheet keeps no history of who changed a cell. An overwritten diagnosis or a bill edited after payment simply looks right." },
        { title: "Drug safety", body: "Neither knows the patient's allergies or other medicines when a drug is dispensed, and neither stops a Schedule H1 sale without a prescription. The H1 and NDPS registers are kept by hand, and errors surface at the drug inspector's visit." },
        { title: "Reporting", body: "Monthly reports mean someone tallying registers or merging sheets for days, and the numbers differ depending on who did it. Bed occupancy, turnaround times and NABH indicators are counted by hand, if at all." },
        { title: "Privacy", body: "The DPDP Act applies to patient data in any form. A spreadsheet emailed between staff or copied to a laptop has no access control, no record of who opened it and no way to know a breach happened, which makes the Act's 72-hour breach report hard to meet." },
      ],
    },
    {
      title: "Side by side",
      table: {
        caption: "Paper registers, Excel and hospital software compared",
        head: ["", "Paper registers", "Excel", "Hospital software"],
        rows: [
          ["Cost to start", "Printing only", "A PC and the time to keep it up", "Subscription or licence, setup and training"],
          ["Training", "None", "One person who knows the sheet", "Short training per role"],
          ["Works with no power or network", "Always", "On one PC", "Needs power; an on-premise install runs on the local network"],
          ["Duplicate patients", "Not detected", "Exact matches only", "Checked by name, phone and date of birth before a new UHID"],
          ["Several users at once", "One book, one person", "Files overwrite each other", "Everyone on one record"],
          ["Who changed what", "Not recorded", "Not recorded", "Every change on an audit log"],
          ["Charges", "Slips that reach the counter", "What was typed in", "Added by the department that did the work"],
          ["Drug checks", "The pharmacist's memory", "None", "Schedule, allergy and interaction checks at dispensing"],
          ["Reports", "Hand tally", "Formulas, after data entry", "Counted from the records as they happen"],
          ["Backups", "None", "Whatever was last copied", "Scheduled database backups"],
        ],
      },
      after: [
        "The fair conclusion: paper wins on cost and outages, Excel wins on simple counting, and software wins as soon as patients come back, several people work on the same record, or you have to prove what happened.",
      ],
    },
    {
      title: "Moving from Excel to MedBrains",
      body: [
        "You do not have to type the hospital in by hand, and nothing is saved until you have seen what will change. This is how the move works in MedBrains today.",
      ],
      steps: [
        { title: "Set up the hospital from one workbook", body: "In Admin, download the onboarding workbook, blank or filled with what is already set up. It has sheets for departments, wards, beds and staff. Fill it in Excel and upload it. The first upload is a dry run: it shows what would be added and updated, or every problem by sheet, row and column, and nothing changes until you confirm. Rows match by code (username for staff), so uploading the same workbook twice changes nothing." },
        { title: "Bring your tests and drugs across", body: "The lab test catalogue and the pharmacy drug list each import from a CSV on their catalogue screen, with an error report per row. Fix the rows and run the file again: matching codes are updated, not duplicated." },
        { title: "Register patients as they come back", body: "There is no self-serve upload for an old patient list yet; talk to us about bringing yours across. Many hospitals simply register each patient on their next visit. The duplicate check at registration stops a second record being made for someone already there." },
        { title: "Keep the old files, read-only", body: "Pick a go-live date. Keep the registers and spreadsheets from before it, unchanged, so old records can still be looked up and nobody keeps writing in two places." },
        { title: "Go live one department at a time", body: `Most hospitals start with the front desk and OPD, then add pharmacy, lab, billing and wards. See ${link("/hospital-management-software", "hospital management software")} for what each covers, and the ${link("/how-to-choose-hospital-management-software", "25-point buying checklist")} if you are still comparing.` },
      ],
      after: [
        "Until go-live, make the spreadsheets you still use safer: keep one master copy on one shared drive rather than copies in email, restrict who can open the patient sheets, protect the columns that should not change, and take a dated copy every day to somewhere other than the same computer. None of that gives you an audit trail, but it lowers the chance of losing a month of records the week before you switch.",
      ],
    },
    {
      title: "Related guides",
      body: [
        `${link("/hospital-billing-software", "Hospital billing software")}: charges captured where they happen, GST, TPA and day close.`,
        `${link("/pharmacy-management-software", "Pharmacy management software")}: Schedule H, H1 and X, the NDPS register and FEFO.`,
        `${link("/lab-management-software", "Lab management software")}: worklists, critical values and turnaround.`,
        `${link("/opd-queue-management", "OPD queue management")}: tokens and TV boards instead of a shouted name.`,
        `${link("/health-camp-software", "Health camp software")}: if camps are the last thing still on paper. See also our ${link("/health-camp-software-vs-manual", "camp software vs manual comparison")}.`,
        `${link("/dpdp-readiness", "DPDP readiness")}: what the Act asks of a hospital before May 2027.`,
      ],
    },
  ],
  featuresTitle: "What moving off Excel changes",
  features: [
    { title: "One record per patient", body: "A duplicate check before every new UHID, and every department on the same record." },
    { title: "Charges at the source", body: "The lab, pharmacy and wards add their own charges, so the bill is not built from slips." },
    { title: "Who changed what", body: "Every change on an audit log, and an access log for each patient's record." },
    { title: "Drug checks at the counter", body: "Schedule H, H1 and X rules, allergies and interactions checked before a drug is dispensed." },
    { title: "Reports without a tally", body: "Ready reports counted from the records as the day happens, not merged from sheets at month end." },
    { title: "Backups on a schedule", body: "A daily database backup and an alert if one stops running, instead of a copy on a pen drive." },
  ],
  faq: [
    { q: "Can Excel be used as hospital management software?", a: "For a small clinic, an Excel sheet can keep a patient list and a revenue tally. It cannot stop duplicate patients, record who changed a cell, check drugs at dispensing or let several people work on one record safely, so it stops working as soon as a hospital has more than one desk." },
    { q: "Is Excel enough for a small clinic?", a: "Often, yes, while one or two people keep it and patients rarely come back under a different spelling. Move when duplicates, missed charges or monthly reporting start costing you time." },
    { q: "Can we import our Excel patient list into MedBrains?", a: "Not by self-serve upload yet; talk to us about bringing it across. Departments, wards, beds and staff import from the onboarding workbook with a dry run, and lab tests and drugs import from CSV." },
    { q: "What happens to our old paper registers?", a: "Keep them, unchanged, as the record before go-live. Patients are registered in the software on their next visit, and the duplicate check stops a second record for anyone already registered." },
    { q: "Is keeping patient data in Excel allowed under the DPDP Act?", a: "The Act applies to personal data however it is stored. A spreadsheet is not forbidden, but it makes access control, an access record and breach detection hard, and those are what the Act asks for." },
    { q: "How long does moving off Excel take?", a: "Setting up departments, wards, beds and staff from the workbook takes as long as filling it in. A clinic can start in days; a hospital usually goes live department by department." },
  ],
  related: ["hospital-management-software", "how-to-choose-hospital-management-software", "hospital-billing-software", "pharmacy-management-software", "health-camp-software-vs-manual"],
  relatedTitle: "Related",
};

export const COMPARE_PAGES: ModulePage[] = [checklist, excel];
