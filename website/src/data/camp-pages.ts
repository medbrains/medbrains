// The health-camp cluster: one hub and a spoke per kind of camp people search
// for. Every "does" line is the camp module as built (crates/medbrains-camp,
// the staff apps' Camp feature, apps/web/src/pages/camp); no customers, camp
// counts or certifications. ABDM is "built for", not certified.

import type { ModulePage } from "./modules";

const HUB = "/health-camp-software";
const link = (href: string, text: string) => `<a href="${href}">${text}</a>`;

const hub: ModulePage = {
  slug: "health-camp-software",
  title: "Health Camp Software & Medical Camp Management | MedBrains",
  description: "Health camp software for Indian hospitals, NGOs and programme teams: plan the camp, register once, run stations, refer, follow up and report, even offline.",
  eyebrow: "Health camps",
  h1: "Health camp software that runs the camp and feeds the hospital",
  intro: "MedBrains is health camp software, a medical camp management system, for hospitals and the NGOs and programme teams that run camps with them. It plans the camp, registers each person once, moves them through registration, vitals, doctor and pharmacy on one number, keeps working when the network drops, and brings every record, sample and referral back into the hospital's own patient record.",
  sections: [
    {
      title: "How a camp day runs on MedBrains",
      body: ["A camp is a small hospital that exists for one day. These are the steps the camp module follows, in the order the people at the camp meet them."],
      steps: [
        { title: "Before the day: plan, approve and pack", body: "The camp is created with its type (general health, eye, dental, vaccination, blood donation, awareness or specialised), date, venue, coordinator, team and expected turnout, and moves from planned to approved to set up. An 18-point readiness checklist covers site permission, a private screening area, biomedical waste, red-flag referral rules, charged devices and paper fallback forms. Supplies are listed with batch and expiry, and packed, consumed and returned quantities." },
        { title: "Registration: one number for the whole day", body: "Each person is registered once and given a camp number. If they are already a patient of the hospital they are linked to that record instead of getting a second UHID. New people get a UHID marked as coming from the camp, with an estimated date of birth when only the age is known." },
        { title: "Triage and vitals", body: "Blood pressure, pulse, SpO2, temperature, random blood sugar, height, weight and BMI, visual acuity for each eye, and a history checklist (diabetes, hypertension, asthma, heart disease, thyroid, allergies, smoking, alcohol). A question not asked is stored differently from one answered no, so an unasked question never reads as a negative finding." },
        { title: "Consultation", body: "The doctor's station calls the next number. Findings, ICD-coded diagnoses and advice are recorded, and a person who needs a proper visit can have an OPD encounter opened for them, with a token that shows on the waiting-room boards. Two doctors at one step share one queue." },
        { title: "Lab and pharmacy", body: "Samples are collected against a barcode and linked to a hospital lab order, so the result comes back to the same person. Medicines dispensed at the camp are checked against the patient's documented allergies, and a conflict is flagged for the pharmacist to verify before the medicine is handed over." },
        { title: "Referral", body: "Anyone who needs the hospital gets a referral with the department, urgency and reason, how they will travel, whether an ambulance is needed, and an attendant's name and phone number. The referral has a status, so the team can see who actually arrived." },
        { title: "After the camp: follow-ups and reports", body: "Follow-ups are scheduled per person and marked completed, missed or cancelled. The camp is closed, and its report counts registrations, screenings, referrals, conversions, samples, follow-ups and billing." },
      ],
    },
    {
      title: "Works when the network doesn't",
      body: [
        "Camps happen in village halls, school grounds and factory canteens, and the signal is usually the first thing to go. Before the team leaves, the camp's packet is downloaded to the device: the camp, its team, its stations, its checklist and its supplies.",
        "At the camp, registration, vitals and screening, sample collection, referrals, incidents and checklist and supply updates are recorded on the device and sent back through one sync endpoint when the connection returns. Each event carries the device, the user and the time it happened, so a replay never creates the same person twice. Billing and converting follow-ups into appointments stay online, because they need the hospital's live data.",
        "When a station cannot reach the server, the staff app says so instead of showing an empty queue. A blank list at a camp would read as \"nobody is waiting\", and that is the wrong thing to believe in front of a queue of people.",
      ],
    },
    {
      title: "Built to scale with the camp",
      body: [
        `A camp's route is a list of stations in order. The general camp template sets up registration, vitals, doctor and pharmacy in one step; you can add stations (up to twenty), give each one a capacity per hour, and put several rooms behind one station so the queue is shared. Volunteers use the native MedBrains staff app on iOS and Android: each picks the station they are working at, and finishing a person at one station puts them in the queue of the next with the same number. The same token system runs the hospital's own ${link("/opd-queue-management", "OPD queues")}, so the camp's consultation queue can be shown on a TV board.`,
        "Because every camp is recorded against the same patient master as the hospital, the size of a camp changes how many devices and stations you set up, not how the data is kept.",
      ],
    },
    {
      title: "Reports for the organiser, the sponsor and the hospital",
      body: [
        "Each camp has a live dashboard: registered, screened, referred, converted to hospital patients, lab samples, follow-ups scheduled and completed, and billing. Across all camps, the analytics show conversion rate, screening yield (referrals as a share of people screened), average cost per patient and follow-up compliance.",
        "The planning summary keeps the money straight: planned budget against actual cost, sponsor coverage planned, receivable and collected, and the value of medicines given free against those sold. Camps are also an acquisition channel in MedBrains' marketing reports, which compare the conversions the camp team recorded with the hospital visits that actually followed. The marketing side never sees why a person came to the camp, only that they did.",
      ],
    },
    {
      title: "ABHA and ABDM",
      body: [
        `A camp attendee who becomes a hospital patient lands on the same record the front desk uses, and that record is where an ABHA is verified or created and linked. ABHA is optional at a camp: nobody is turned away for not having one. MedBrains is built for ABDM (M1 to M3) and is not yet certified by the National Health Authority. Read how records linked to ABHA earn hospitals money in our ${link("/abdm-incentive", "ABDM incentive guide")}.`,
      ],
    },
    {
      title: "Guides for each kind of camp",
      body: [
        `${link("/government-medical-camp-software", "Government medical camps")}: district and programme camps, referral tracking and the reports a programme officer asks for.`,
        `${link("/ngo-health-camp-software", "NGO and CSR health camps")}: sponsor coverage, free medicines and impact numbers a donor can trust.`,
        `${link("/corporate-health-camp-software", "Corporate and industrial health camps")}: employee health checks at the factory or office, paid for by the employer.`,
        `${link("/health-camp-software-vs-manual", "Health camp software vs manual management")}: paper, spreadsheets and software compared honestly.`,
        `${link("/resources/health-camp-planning-checklist", "Health camp planning checklist")}: a free, printable checklist for before, on the day and after the camp, including biomedical waste.`,
      ],
    },
  ],
  featuresTitle: "What's in the camp module",
  features: [
    { title: "No duplicate patients", body: "An existing patient is linked, not registered again; a paper form re-entered after review updates the same person." },
    { title: "Stations on one number", body: "Registration, vitals, doctor and pharmacy in order, with the same number called at each." },
    { title: "Offline packet and sync", body: "The camp's data goes out on the device and comes back through one sync, without duplicates." },
    { title: "Readiness and supplies", body: "An 18-point checklist and a supplies list with batch, expiry, packed, used and returned." },
    { title: "Referrals and follow-ups", body: "Referrals with urgency and transport; follow-ups marked completed, missed or cancelled." },
    { title: "Free, discounted or sponsored", body: "Per-service charges, camp discounts, sponsor-covered amounts and tax, mirrored into hospital billing." },
  ],
  faq: [
    { q: "What is medical camp software?", a: "Medical camp software records what happens at a health or medical camp: who attended, their vitals and screening, what the doctor found, samples taken, medicines given and who was referred. Good medical camp software also links each person to the hospital's own patient record so the camp is not a dead end." },
    { q: "What does a medical camp management system do beyond registration?", a: "In MedBrains it covers the whole camp: planning and approval, a readiness checklist, team roles, supplies with batch and expiry, stations with queues, screening, samples, pharmacy, referrals, incidents, follow-ups and reports." },
    { q: "Is health camp software better than manual management?", a: "For a small one-off awareness camp, paper is fine. Once you screen, refer and follow up, software saves the re-typing and the lost referrals. We compare paper, spreadsheets and software in our health camp software vs manual management guide." },
    { q: "Can the camp run without internet?", a: "Yes. The camp packet is downloaded before the team leaves; registration, screening, samples, referrals and incidents are recorded on the device and synced when the connection returns. Billing and follow-up conversion need a connection." },
    { q: "Can the camp use phones?", a: "Yes. Camp registration and every station run in the native MedBrains staff app on iOS and Android. The coordinator also has a full camp workspace in the web app." },
    { q: "Is the health camp software customizable?", a: "The parts that differ between camps are settings: the camp type, the stations and their order, rooms and capacity per hour, the team and their roles, the supplies list, and whether services are free, discounted or sponsored. What each person can see and do comes from their role's permissions." },
    { q: "Is this AI health camp management software?", a: "The camp workflow does not depend on AI. Findings, diagnoses and referrals are entered by the camp's clinicians, and the analytics (conversion rate, screening yield, follow-up compliance) are counted from those records, not predicted." },
    { q: "What happens if someone is already a patient of the hospital?", a: "They are linked to their existing record, so the camp visit, screening and referral appear in the same history the hospital's doctors see. No second UHID is issued." },
  ],
  related: ["government-medical-camp-software", "ngo-health-camp-software", "corporate-health-camp-software", "health-camp-software-vs-manual", "hospital-marketing-software", "hospital-management-software"],
  relatedTitle: "Health camp guides",
};

const government: ModulePage = {
  slug: "government-medical-camp-software",
  parent: "health-camp-software",
  title: "Government Medical Camp Software for Districts | MedBrains",
  description: "Government medical camp software for district and programme camps in India: screening, coded diagnoses, tracked referrals, one record per person, offline.",
  eyebrow: "Government medical camps",
  h1: "Government medical camp software for district and programme camps",
  intro: "Government medical camp software has to do three things a register cannot: count every person screened without counting anyone twice, follow each referral until the person reaches the hospital, and hand the programme officer numbers that add up. MedBrains does all three, offline when it has to, on the same patient record the hospital uses.",
  sections: [
    {
      title: "Who runs government medical camps, and what goes wrong",
      body: [
        "District hospitals, community and primary health centres, medical colleges with an outreach role and teams running national programmes all hold camps: screening for blood pressure and diabetes, eye camps, dental camps, vaccination drives and awareness days. They run in places without a hospital, often without a reliable network, and staffed by people who have been drafted in for the day.",
        "The failures are familiar. The same person registers at two camps and is counted twice. The register says forty people were referred, and nobody can say how many reached the district hospital. A month later the figures are typed into a spreadsheet from paper, and the typing is where the errors come in.",
      ],
    },
    {
      title: "How a district camp runs on MedBrains",
      steps: [
        { title: "Plan and approve", body: "The camp is created with its type, venue (address, pincode and map location), date, coordinator and expected turnout, then approved before it is set up. Approval is recorded with who approved it and when." },
        { title: "Get the site ready", body: "The 18-point readiness checklist covers local authority permission, a private area for women and elderly people, drinking water and hand hygiene, sharps and colour-coded biomedical waste bins with an authorised hand-off, red-flag referral rules with the receiving facility's contact and transport, and charged devices with paper fallback forms. The camp shows a readiness score before the team leaves." },
        { title: "Register once", body: "Each person gets a camp number. If they already have a record at the hospital they are linked to it; if not, they get a UHID marked as a camp registration. The father's or spouse's name is captured, because that is how rural registers tell two people with the same name apart." },
        { title: "Screen", body: "Vitals, random blood sugar and HbA1c, haemoglobin, BMI and visual acuity, a history checklist, findings, ICD-coded diagnoses and advice. Several diagnoses can be coded from one screening." },
        { title: "Refer and track", body: "A referral records the receiving facility and department, urgency, reason, transport, whether an ambulance is needed and an attendant's contact. Its status is updated as the person moves, so a referral is a list to work through, not a number in a register." },
        { title: "Follow up and close", body: "Follow-ups are scheduled per person and marked completed, missed or cancelled. The readiness checklist names an owner for the post-camp sync, the biomedical waste hand-off, referral reconciliation and incident review, so closing the camp is somebody\'s job." },
      ],
    },
    {
      title: "Reporting a programme officer can check",
      body: [
        "Every number in a camp's report is a count of records, so it can be traced back to people: registered, screened, referred, converted to hospital patients, samples collected, follow-ups scheduled and completed. Across camps, MedBrains shows the screening yield (referrals as a share of people screened), conversion rate, average cost per patient and follow-up compliance.",
        "Because diagnoses are coded at the camp, a district team can count conditions without reading handwriting. Because registration links to the hospital's patient master, a person screened at three camps in a year is one person with three screenings, not three people.",
      ],
    },
    {
      title: "Offline, audited and on your own servers if you need it",
      body: [
        "Government camps are where the network is worst. The camp's packet is downloaded before the team leaves, and registration, screening, samples, referrals, incidents, checklist and supply updates are recorded on the device and synced back later. Each sync event carries the device, the user and the time, and a replay never creates the same person twice.",
        `Data is kept per organisation with row-level security in the database, and access follows each user's role. MedBrains can run in our cloud or on servers you control, which matters when a state or institution needs patient data to stay in its own data centre. Our ${link("/dpdp-readiness", "DPDP readiness guide")} covers the consent and retention side.`,
      ],
    },
    {
      title: "ABHA at government camps",
      body: [
        "Camp attendees who become hospital patients land on the same record the hospital's front desk uses, where an ABHA can be verified or created and linked. ABHA is optional at the camp: nobody is denied care for not having one. MedBrains is built for ABDM (M1 to M3) and is not yet certified by the National Health Authority.",
        `The hub page on ${link(HUB, "health camp software")} walks through the full camp day, and the ${link("/health-camp-software-vs-manual", "software vs manual comparison")} is useful if your camps still run on paper.`,
      ],
    },
  ],
  featuresTitle: "What government camps get",
  features: [
    { title: "One person, one record", body: "Linked to the hospital's patient master, so repeat attendees are never counted twice." },
    { title: "Coded diagnoses at the camp", body: "Diagnoses coded where they are made, several per screening." },
    { title: "Referrals with a status", body: "Facility, urgency, transport, ambulance and attendant, tracked until the person arrives." },
    { title: "Readiness before departure", body: "An 18-point checklist covering consent, privacy, biomedical waste and referral routes." },
    { title: "Incidents recorded", body: "Patient safety, infection control, equipment and privacy incidents with severity and the action taken." },
    { title: "Offline packet", body: "Recorded on the device, synced back without duplicates." },
  ],
  caveat: "MedBrains does not submit data to government portals itself. The camp's figures come out of MedBrains for your team to report in the format your programme asks for.",
  faq: [
    { q: "What is government medical camp software?", a: "Software that a district hospital, health centre or programme team uses to plan a camp, register and screen people, refer those who need care and report the results. MedBrains does this on the same patient record the hospital uses, so a camp referral can be followed into the hospital." },
    { q: "Can it handle NCD screening camps?", a: "Screening captures blood pressure, random blood sugar, HbA1c, BMI and a history checklist including diabetes, hypertension, smoking and alcohol, with ICD-coded diagnoses and referral. Those are the fields a screening camp for blood pressure and diabetes needs." },
    { q: "Does it work in villages without a network?", a: "Yes. The camp packet is downloaded before departure and registration, screening, samples, referrals and incidents sync back when the connection returns. Billing and follow-up conversion need a connection." },
    { q: "Can the data stay on government servers?", a: "MedBrains can be installed on servers you control instead of our cloud." },
    { q: "Is ABHA mandatory at the camp?", a: "No. ABHA can be linked on the patient's hospital record, but nobody is turned away for not having one." },
  ],
  related: ["health-camp-software", "ngo-health-camp-software", "hospital-management-software"],
  relatedTitle: "Related",
};


const ngo: ModulePage = {
  slug: "ngo-health-camp-software",
  parent: "health-camp-software",
  title: "NGO Health Camp Software for CSR Camps | MedBrains",
  description: "NGO health camp software for CSR and charity camps: register and screen offline, track referrals to a partner hospital and report sponsor spend and impact.",
  eyebrow: "NGO and CSR camps",
  h1: "NGO health camp software that turns a camp into numbers a donor can trust",
  intro: "NGO health camp software has to answer the donor's question, how many people did this camp help and what happened to them next, without anyone retyping paper forms. MedBrains records the camp as it runs, follows each referral to the partner hospital, and keeps the sponsor's money and the free medicines accounted for.",
  sections: [
    {
      title: "How NGO and CSR health camps usually run",
      body: [
        "Most NGO health camps are partnerships. The NGO knows the community, arranges the venue and the volunteers and brings the people in; a hospital sends the doctors, the lab and often the medicines; a company or trust pays through its CSR budget. Health care, including preventive health care, is one of the activities listed for CSR spending in Schedule VII of the Companies Act, 2013, which is why so many camps have a corporate sponsor behind them.",
        "Each of the three wants something different from the same day. The NGO wants to know who needs a follow-up visit. The hospital wants the people it treats on its own records. The sponsor wants a report it can put in front of its CSR committee. When the camp runs on paper, the report is written last, from a pile of forms, and it is the part most likely to be wrong.",
      ],
    },
    {
      title: "Running the camp",
      steps: [
        { title: "Plan the camp and its money", body: "The camp is created with its type, venue, date, coordinator, team and expected turnout, a budget, and whether services are free or discounted. Supplies are listed with quantity, batch and expiry, and each item can be marked as charged, free, or covered by the sponsor." },
        { title: "Get the volunteers ready", body: "Each team member is added with their role in the camp. Volunteers use the MedBrains staff app on their iOS or Android phone and see only what their role allows. The 18-point readiness checklist covers the things a first-time site misses: permission from the village or local authority, a private screening area, biomedical waste bins and a hand-off plan, and paper forms for when a phone dies." },
        { title: "Register and screen", body: "Each person is registered once and called by the same camp number at every station: registration, vitals, doctor and pharmacy. Screening records vitals, sugar, BMI, vision, a history checklist, findings and ICD-coded diagnoses." },
        { title: "Give medicines and refer", body: "Medicines dispensed at the camp are checked against the person's documented allergies, and a conflict is flagged for the pharmacist. Anyone who needs more care is referred to the partner hospital with urgency, transport, ambulance need and an attendant's contact." },
        { title: "Follow up", body: "Follow-ups are scheduled per person and marked completed, missed or cancelled, which is the number most camps never manage to report." },
      ],
    },
    {
      title: "Impact and donor reporting without patient data",
      body: [
        "A donor report should count people, not expose them. The camp's dashboard gives the counts: registered, screened, referred, converted to hospital patients, lab samples, follow-ups scheduled and completed. Across camps you get the conversion rate, the screening yield (referrals as a share of people screened), the average cost per patient and follow-up compliance.",
        "The planning summary holds the sponsor's side: planned budget against actual cost and the variance, sponsor coverage planned, receivable and collected, and the value of medicines given free against those sold. That is the report a CSR committee asks for, and every figure in it comes from records made at the camp.",
        `Share the counts, keep the records. Individual screening results belong with the patient and the treating hospital; our ${link("/dpdp-readiness", "DPDP readiness guide")} explains what consent and purpose limits mean for a camp's data.`,
      ],
    },
    {
      title: "When the network gives out",
      body: [
        "Charity camps go where services are thin, and so is the signal. The camp's packet is downloaded before the team leaves; registration, screening, samples, referrals, incidents, checklist and supply updates are recorded on the device and synced back later, each event tagged with the device and the user, and never creating the same person twice. Billing and converting a follow-up into an appointment wait for a connection.",
      ],
    },
    {
      title: "Working with a partner hospital",
      body: [
        `MedBrains is ${link("/hospital-management-software", "hospital management software")}, so the camp runs on the partner hospital's MedBrains. That is what makes the referral real: a person screened at the camp and referred arrives at the hospital with their camp screening already on the record, and if they were already a patient, they are linked to their existing record instead of being given a second UHID. Camps also appear in the hospital's marketing reports as an acquisition channel, without the reason anyone attended ever leaving the clinical record.`,
        `For the full camp day see ${link(HUB, "health camp software")}. If your sponsor is the company whose employees are being screened, the ${link("/corporate-health-camp-software", "corporate health camp guide")} is closer to your case.`,
      ],
    },
  ],
  featuresTitle: "What NGO camps get",
  features: [
    { title: "Sponsor money tracked", body: "Sponsor coverage planned, receivable and collected, beside budget and actual cost." },
    { title: "Free medicines counted", body: "The value of free-issue medicines and supplies, separate from what was sold." },
    { title: "Volunteers on phones", body: "Native iOS and Android staff app, each volunteer seeing only their role." },
    { title: "Referrals followed", body: "Each referral has a status until the person reaches the partner hospital." },
    { title: "Follow-up compliance", body: "Scheduled against completed, per camp and across camps." },
    { title: "Readiness checklist", body: "18 points from site permission to biomedical waste and paper fallback forms." },
  ],
  caveat: "MedBrains does not produce a formatted CSR annual report or file anything with the Ministry of Corporate Affairs. It gives you the counts and the money; the report is yours to write.",
  faq: [
    { q: "What is NGO health camp software?", a: "Software an NGO uses with its partner hospital to plan a camp, register and screen people, refer those who need care, follow them up and report the results to its sponsors." },
    { q: "Can an NGO use MedBrains without a hospital?", a: "MedBrains is built around a hospital's patient record, so it fits an NGO working with a partner hospital that runs MedBrains. The camp's referrals then arrive at that hospital already on the record." },
    { q: "How do we report to a CSR sponsor?", a: "Use the camp's counts (registered, screened, referred, followed up) and the planning summary's sponsor coverage, actual cost and free-issue value. Share counts, not individual results." },
    { q: "Can camps be free for patients?", a: "Yes. A camp can be free or discounted, and each service or supply can be charged, given free or covered by the sponsor." },
    { q: "Does it work offline?", a: "Yes. Registration, screening, samples, referrals and incidents are recorded on the device and synced when the connection returns." },
  ],
  related: ["health-camp-software", "corporate-health-camp-software", "hospital-management-software"],
  relatedTitle: "Related",
};

const corporate: ModulePage = {
  slug: "corporate-health-camp-software",
  parent: "health-camp-software",
  title: "Industrial Health Camp Software for Employers | MedBrains",
  description: "Industrial health camp software for factory and office health checks: screen employees on site, bill the employer, refer and follow up from a hospital.",
  eyebrow: "Corporate and industrial camps",
  h1: "Industrial health camp software for employee health checks",
  intro: "Industrial health camp software lets a hospital run an employee health check at a factory, plant or office as one organised day: every worker registered once, screened station by station, the employer billed for what it agreed to cover, and anyone who needs care referred to the hospital on their own record.",
  sections: [
    {
      title: "What a corporate health camp is for",
      body: [
        "Employers bring a hospital to the workplace for different reasons: an annual health check, a wellness day, a drive after a run of sick leave, or screening for a risk that comes with the job. Factories add a practical problem. The workers are on shifts, the canteen is the only free room, and the line cannot stop for long, so the camp has to move people through quickly and get the paperwork right first time.",
        "For the hospital, a corporate camp is also a relationship. Workers who meet a doctor at the plant and are referred properly come back to that hospital, and the employer comes back next year if the report is clear.",
      ],
    },
    {
      title: "How the camp runs at the plant",
      steps: [
        { title: "Set up with the employer", body: "The camp is created with the factory or office as the venue, the date and shift times, the expected headcount, the hospital team and a budget. Charges can be set per service, with a camp discount and the share the employer covers." },
        { title: "Lay out the route", body: "The general template sets up registration, vitals, doctor and pharmacy; add stations for tests and give each a capacity per hour. Two doctors at one step share one queue, so a shift moves through without people waiting at the wrong room." },
        { title: "Register each employee once", body: "A worker who is already a patient of the hospital is linked to their record. Everyone else gets a UHID marked as coming from the camp, so their next visit to the hospital starts with today's screening." },
        { title: "Screen", body: "Blood pressure, pulse, SpO2, temperature, height, weight and BMI, visual acuity for each eye, random blood sugar, HbA1c and haemoglobin, with a history checklist including smoking and alcohol. ECG, X-ray, bone mineral density and biothesiometry results can be recorded as impressions. Findings, coded diagnoses and advice follow." },
        { title: "Samples, medicines and referral", body: "Samples are barcoded and linked to a hospital lab order, so the result returns to the same worker. Medicines are checked against documented allergies, and a conflict is flagged for the pharmacist. A worker who needs care is referred with the department and urgency." },
        { title: "Follow up", body: "Follow-ups are scheduled and tracked to completed or missed, so the hospital knows who came back." },
      ],
    },
    {
      title: "Billing the employer",
      body: [
        "Corporate camps are rarely free and rarely paid by the worker. Each camp service records its standard amount, the discount, tax, and the amount covered by the sponsor, which here is the employer. When automatic camp billing is switched on, those charges are mirrored into the hospital's own billing against the worker's patient record, so the camp does not need a second set of accounts.",
        "The planning summary puts the camp's budget beside its actual cost, and the sponsor coverage planned, receivable and collected, so finance can see what the employer still owes.",
      ],
    },
    {
      title: "What the employer sees, and what it shouldn't",
      body: [
        "A worker's screening result is health data about that worker. The employer is entitled to know the camp happened and how many people were screened, referred and followed up, and to the aggregate picture, which the camp report gives in counts. Individual results go to the worker and the treating hospital, unless the worker has agreed to share them for a stated purpose.",
        `MedBrains keeps each camp's records behind role-based permissions, with data held per organisation. Our ${link("/dpdp-readiness", "DPDP readiness guide")} covers consent and purpose limits in more detail.`,
      ],
    },
    {
      title: "From the factory floor to the hospital",
      body: [
        `Because the camp runs on the hospital's ${link("/hospital-management-software", "hospital management software")}, a referral from the plant arrives on the worker's own record, and the camp counts as an acquisition channel in the hospital's marketing reports. See ${link(HUB, "health camp software")} for the full camp day, or the ${link("/ngo-health-camp-software", "NGO and CSR camp guide")} when the company is funding a community camp rather than screening its own staff.`,
      ],
    },
  ],
  featuresTitle: "What corporate camps get",
  features: [
    { title: "Shift-friendly stations", body: "Capacity per hour per station and shared queues across rooms." },
    { title: "Employer billing", body: "Per-service charges, discounts, tax and employer-covered amounts, mirrored into hospital billing." },
    { title: "Point-of-care results", body: "Sugar, HbA1c, haemoglobin and vision as numbers; ECG, X-ray, bone density and biothesiometry as impressions." },
    { title: "Referrals on the record", body: "Workers referred to the hospital arrive with their camp screening." },
    { title: "Aggregate reports", body: "Counts of screened, referred and followed up, without individual results." },
    { title: "Offline at the plant", body: "Recorded on the device and synced back when the network returns." },
  ],
  caveat: "MedBrains does not issue statutory fitness certificates under the Factories Act or keep a factory's own health register. Audiometry and spirometry have no structured fields at the camp; record them as findings.",
  faq: [
    { q: "What is industrial health camp software?", a: "Software a hospital uses to run an employee health check at a factory or plant: registering workers, screening them station by station, billing the employer, referring those who need care and reporting the results." },
    { q: "Can the employer pay instead of the employee?", a: "Yes. Each service records the amount covered by the sponsor, and the camp's planning summary shows sponsor coverage planned, receivable and collected." },
    { q: "Can we screen a whole shift quickly?", a: "Set up the stations the screening needs, give each a capacity per hour and put more than one room behind a busy station. Every worker keeps one number from registration to pharmacy." },
    { q: "Will the employer see individual results?", a: "The camp report gives counts. Sharing an individual worker's results with the employer needs that worker's agreement." },
    { q: "Does it work for office health checks too?", a: "Yes. The venue can be any workplace; only the stations and tests change." },
  ],
  related: ["health-camp-software", "ngo-health-camp-software", "hospital-billing-software"],
  relatedTitle: "Related",
};

const versus: ModulePage = {
  slug: "health-camp-software-vs-manual",
  parent: "health-camp-software",
  title: "Health Camp Software vs Manual Management | MedBrains",
  description: "Health camp software vs manual management: paper registers, spreadsheets and camp software compared on duplicates, referrals, offline use, cost and reporting.",
  eyebrow: "Software vs manual",
  h1: "Health camp software vs manual management: an honest comparison",
  intro: "Paper is the cheapest way to run a health camp and the hardest way to report one. Spreadsheets fix the counting but not the camp day. Health camp software costs devices and training, and pays back when you screen, refer and follow up. Here is how the three compare, including where software is not worth it.",
  sections: [
    {
      title: "The three ways camps are run",
      body: [
        "<strong>Paper.</strong> A register at the entrance, a printed form per person that travels from table to table, a referral slip, and a tally at the end of the day. It needs no power, no network and no training, and every volunteer already knows how to use it.",
        "<strong>Paper, then a spreadsheet.</strong> The camp runs on paper, and afterwards somebody types the forms into a spreadsheet so the numbers can be added up and sent to the organiser or sponsor. This is how most camps that report anything are run.",
        "<strong>Camp software.</strong> People are registered on a phone or tablet, each station records its own part, and the counts exist the moment the camp ends. Good camp software also connects the camp to the hospital that will see the people who are referred.",
      ],
    },
    {
      title: "Side by side",
      table: {
        caption: "Paper, spreadsheets and camp software compared",
        head: ["", "Paper register", "Paper then spreadsheet", "Health camp software"],
        rows: [
          ["Cost to start", "Printing only", "Printing and data-entry time", "Devices, charging and a subscription"],
          ["Training", "None", "One person who knows the spreadsheet", "A short briefing per station"],
          ["Works without power or network", "Always", "At the camp, yes", "Needs charged devices; good software works offline and syncs later"],
          ["Duplicate people", "Not detected", "Found only if someone looks", "Checked at registration against the hospital's records"],
          ["Queues between tables", "The form is the queue", "The form is the queue", "One number called at each station"],
          ["Referrals", "A slip the patient carries", "A column nobody updates", "A record with a status until the person arrives"],
          ["Follow-up", "Rarely recorded", "A list that goes stale", "Scheduled and marked completed or missed"],
          ["Reporting", "Hand tally, days later", "Formulas, after data entry", "Counts available when the camp ends"],
          ["Errors", "Handwriting", "Handwriting, then typing", "Entered once, at the station"],
          ["Privacy", "Forms in a box", "A file that gets emailed", "Role-based access, no copies in inboxes"],
        ],
      },
      after: ["No column wins every row. Paper's strengths are real: it never runs out of battery, it never logs out, and nobody has to be taught to use it. That is why a good camp plan keeps paper forms as a fallback even when the camp runs on software."],
    },
    {
      title: "Where manual management is enough",
      body: [
        "If the camp is a one-off awareness session, with no screening, no referrals and nothing to report beyond a headcount, a register is the right tool. The same is true of a very small camp run by one doctor who will see every person again in their own clinic. Software adds cost and setup that these camps do not get back.",
      ],
    },
    {
      title: "Where software pays for itself",
      body: [
        "The trade changes as soon as a camp screens people and sends some of them on. Three things go wrong on paper at that point, and they are the three things a sponsor or programme asks about.",
        "<strong>Duplicates.</strong> The same person attends two camps, or registers twice at one, and is counted twice. Software that checks against the hospital's patient master links them to one record.",
        "<strong>Lost referrals.</strong> A referral slip in a patient's pocket cannot tell anyone whether they reached the hospital. A referral record with a status can.",
        "<strong>The retyping.</strong> Every form typed into a spreadsheet after the camp is a second chance to get a blood pressure wrong. Recording it once, at the station, removes that step.",
      ],
    },
    {
      title: "The honest costs of software",
      body: [
        "Devices have to be charged, and a camp in a village hall may not have a socket to spare. Volunteers need a short briefing per station. The network will drop, so the software has to keep working offline and sync later without creating duplicates. And somebody has to own the camp after it ends: the sync, the referrals and the follow-ups. Software that hides these costs will meet them on the day.",
      ],
    },
    {
      title: "How MedBrains handles the hard parts",
      body: [
        `MedBrains' ${link(HUB, "health camp software")} downloads the camp's packet to the device before the team leaves and syncs registration, screening, samples, referrals and incidents back later, without creating anyone twice. Each person is registered once and linked to the hospital's existing record if they have one. Volunteers use the native staff app on iOS and Android, one station each, and the same number is called at every station.`,
        "If your camps already run on paper, you do not have to choose all at once. Forms entered after the camp carry the paper form's reference, so when a reviewer corrects a name or an age weeks later, the correction updates the same person instead of creating a second one. The readiness checklist keeps paper fallback forms on the list for every camp.",
        `For camps run by government teams or NGOs, see the ${link("/government-medical-camp-software", "government medical camp guide")} and the ${link("/ngo-health-camp-software", "NGO health camp guide")}.`,
      ],
    },
  ],
  featuresTitle: "What moving off paper changes",
  features: [
    { title: "Counted once", body: "Registration checks the hospital's records, so a repeat attendee is one person." },
    { title: "Recorded once", body: "Vitals and findings entered at the station, not retyped after the camp." },
    { title: "Referrals you can follow", body: "Each referral has a status until the person reaches the hospital." },
    { title: "Paper still welcome", body: "Forms entered later carry their reference, so corrections update the same person." },
  ],
  faq: [
    { q: "Is health camp software better than manual management?", a: "For camps that screen, refer and report, yes: it removes duplicate counting, lost referrals and retyping. For a one-off awareness session with nothing to follow up, a paper register is enough." },
    { q: "What does health camp software cost compared with paper?", a: "Paper costs printing and the time to type forms afterwards. Software costs devices, charging and a subscription. The saving is in data entry and in referrals and follow-ups that are no longer lost." },
    { q: "What if the camp has no internet?", a: "Software built for camps works offline and syncs later. MedBrains downloads the camp's packet before the team leaves and syncs records back when the connection returns." },
    { q: "Can we keep using paper forms?", a: "Yes. Keep paper as a fallback, and forms entered after the camp carry their reference so later corrections update the same person." },
  ],
  related: ["health-camp-software", "government-medical-camp-software", "ngo-health-camp-software"],
  relatedTitle: "Related",
};

export const CAMP_PAGES: ModulePage[] = [hub, government, ngo, corporate, versus];
