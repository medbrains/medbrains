// The queues-and-tokens cluster: the OPD queue hub and a spoke each for
// clinics and for multi-department hospitals. Every "does" line is the token
// system as built (crates/medbrains-tokens, apps/web/src/pages/{token-console,
// token-display,screen,queue-status,kiosk}, the staff apps' doctor queue and
// desk board). What is not built is said so: no WhatsApp token alerts, call SMS
// off and not yet on DLT templates, no native TV app, no token in the patient app.

import type { ModulePage } from "./modules";

const HUB = "/opd-queue-management";
const link = (href: string, text: string) => `<a href="${href}">${text}</a>`;

const hub: ModulePage = {
  slug: "opd-queue-management",
  title: "OPD Queue Management System & Token Display | MedBrains",
  description: "An OPD queue management system for Indian hospitals and clinics: tokens at the desk or kiosk, TV boards with voice calls, priority lanes and missed patients.",
  eyebrow: "Queues and tokens",
  h1: "An OPD queue management system the whole waiting room can read",
  intro: "An OPD queue management system gives every patient a token number when they arrive, calls that number on a screen and over the speaker when the doctor is ready, and keeps the order fair while people with a reason to go first are moved up. MedBrains does this for OPD, registration, lab collection, pharmacy and billing on one token system, with boards that run on any TV with a browser.",
  sections: [
    {
      title: "How a token moves through the day",
      body: ["These are the steps a token goes through in MedBrains, in the order the patient meets them."],
      steps: [
        { title: "Issued on arrival", body: "A walk-in gets a token when the desk registers them or opens their OPD visit. A patient with an appointment gets one when they check in, at the desk or by scanning the QR on their appointment slip at the self check-in kiosk. A patient who shares their ABHA profile by scanning the registration counter's QR gets a registration token straight away. The token lands in the queue of the department the visit is for." },
        { title: "Numbered the way you want", body: "Each queue has its own prefix, starting number and padding, so the slip reads OPD-001 or ORTHO-1 as you prefer. Numbers reset every day, every session or never, a queue can stop issuing after a daily limit, and opening hours with up to six sessions decide when tokens are given out. Outside hours the desk is told when tokens resume." },
        { title: "Ordered by priority, then arrival", body: "Clinical priorities (stat, urgent and emergency referral) are always first and cannot be configured away. Senior citizens, people with disabilities and pregnant women are protected lanes that are never called after an ordinary patient. Courtesy lanes come after those, in the order the hospital sets. Within a lane, whoever arrived first is called first." },
        { title: "Called on the board and over the speaker", body: "The doctor presses Call on their OPD screen, or the desk calls the next token from the token console. The number appears on the waiting-room board at once and is spoken in the queue's languages (English, Hindi and Tamil today), digit by digit, as many times as the queue is set to repeat it. When the queue has several rooms or counters, the board says which one to go to." },
        { title: "Missed calls handled, not lost", body: "A patient who does not come is marked no-show, and the desk can put them back in the queue. A token can be put on hold while the patient steps out and brought back. A patient who came to the wrong department is moved to the right one and keeps their place by arrival time. When the day ends, tokens still waiting are closed as expired, not counted as no-shows, and a patient sent home unseen comes back the next time ahead of ordinary patients." },
        { title: "Moved up when someone gets worse", body: "A nurse or desk who sees a patient deteriorate in the waiting room can raise their priority without waiting for a doctor's order. It only goes up: nobody can be pushed down the queue." },
      ],
    },
    {
      title: "Several rooms sharing one queue",
      body: [
        "A department with three consulting rooms does not need three queues. A queue can be served by several counters or rooms, each call names the room, and a room can be limited to the staff who work there, so a doctor cannot call from a room that is not theirs. In the staff app on iOS and Android, a doctor's queue shows their own patients first and then the department's unassigned patients, with a switch to see the whole department.",
        "The same token follows the patient through the visit. When the doctor orders a test, the lab collection token carries the number the patient already holds, and so do the pharmacy and billing tokens.",
      ],
    },
    {
      title: "The TV board, the kiosk and the patient's phone",
      body: [
        "<strong>TV boards.</strong> A board is a web page, so any smart TV or TV stick with a browser can show one. The screen shows a pairing code, an administrator approves it in Admin, and from then on the TV signs in as a display that can read its own board and nothing else. Boards update live as tokens are called. By default they show the token number only; a queue can choose to show initials. Patient names never reach a waiting-room screen. Because browsers play no sound until someone touches the page, an untouched TV says voice is off and asks for a key press.",
        "<strong>Self check-in kiosk.</strong> A patient with an appointment scans the QR on their slip, is checked in and given a token. The kiosk shows a QR they can scan to follow the token on their own phone, and clears itself for the next person.",
        "<strong>Following a token by phone.</strong> The status page shows how many people are ahead and an estimated wait, and fills the screen when the patient is called. It shows no name and nothing clinical. The estimate comes from the median of how long that queue's visits have actually taken, not a fixed number.",
      ],
    },
    {
      title: "What is not built yet",
      body: [
        "There are no WhatsApp token updates. An SMS when an OPD token is called exists but is off by default and is not yet tied to the DLT-registered templates Indian SMS rules require, so do not plan a waiting room around it. Tokens are not shown in the MedBrains patient app yet; the kiosk QR is how a patient follows their place. There is no separate Android TV app: the boards run in the TV's browser. ABHA Scan &amp; Share is built for ABDM; MedBrains is not yet certified by the National Health Authority.",
      ],
    },
    {
      title: "Guides for clinics and hospitals",
      body: [
        `${link("/clinic-token-management-system", "Clinic token management system")}: one or two doctors, walk-ins and bookings in one queue, a token display on a single TV.`,
        `${link("/hospital-token-system", "Token system for hospitals")}: department queues, lab, pharmacy and billing counters, and a board for each waiting area.`,
        `Health camps use the same tokens: each station calls the same camp number, and the camp's queue can be shown on a TV board. See ${link("/health-camp-software", "health camp software")}.`,
      ],
    },
  ],
  featuresTitle: "What's in the token system",
  features: [
    { title: "Queues you configure", body: "Prefix, numbering, daily or per-session reset, daily limits, opening hours and sessions per queue." },
    { title: "Priority lanes by rule", body: "Clinical tiers first, protected lanes never behind an ordinary patient, courtesy lanes in your order." },
    { title: "TV boards with voice", body: "Any TV with a browser, paired as a display, number-only, spoken in English, Hindi or Tamil." },
    { title: "Rooms and counters", body: "Several rooms behind one queue; every call names the room, and rooms can be staff-limited." },
    { title: "No-shows, holds and moves", body: "Requeue a no-show, hold and bring back, move to the right department without losing the place." },
    { title: "Wait times that are measured", body: "Median and 90th-percentile service times per room, department and doctor, from real visits." },
  ],
  faq: [
    { q: "What is an OPD queue management system?", a: "It is the software that gives each outpatient a token number on arrival, orders the queue by priority and arrival, calls the next number on a screen and over the speaker, and handles patients who miss their call." },
    { q: "What is an OPD token system?", a: "An OPD token system replaces calling out names with numbers. The patient gets a token at registration or check-in, watches the board, and goes in when their number is called. It keeps names off public screens." },
    { q: "How does a token system work in hospitals?", a: "Each department, counter or service has its own queue. Tokens are issued on arrival, ordered by priority and then arrival time, called by the doctor or counter staff, and shown on a TV board in that waiting area. In MedBrains, lab, pharmacy and billing tokens carry the number the patient got for the visit." },
    { q: "Are patient names shown on the TV?", a: "No. The board shows the token number by default; a queue can choose to show initials. Full names are never sent to a waiting-room screen." },
    { q: "Who goes first, an emergency or a senior citizen?", a: "Clinical priorities (stat, urgent and emergency referral) are always first. Senior citizens, people with disabilities and pregnant women come next and are never called after an ordinary patient. Courtesy lanes, such as VIP, come after them." },
    { q: "What happens when a patient misses their call?", a: "They are marked no-show and can be put back in the queue. At the end of the day, tokens still waiting are closed as expired, and a patient sent home unseen is called ahead of ordinary patients when they return." },
    { q: "Can patients get SMS or WhatsApp alerts when called?", a: "Not reliably yet. A call SMS for OPD exists but is off by default and not yet tied to DLT-registered templates, and there are no WhatsApp token alerts. Patients who check in at the kiosk can follow their token on their phone through its QR." },
  ],
  related: ["clinic-token-management-system", "hospital-token-system", "clinic-management-software", "hospital-management-software", "health-camp-software"],
  relatedTitle: "Queue and token guides",
};

const clinic: ModulePage = {
  slug: "clinic-token-management-system",
  parent: "opd-queue-management",
  title: "Clinic Token Management System for Doctors | MedBrains",
  description: "A clinic token management system for small clinics and single doctors in India: walk-ins and bookings in one queue, a token display on one TV, voice calls.",
  eyebrow: "Clinic token system",
  h1: "A clinic token management system for one doctor or a few",
  intro: "A clinic token management system replaces the receptionist calling out names with a number on a screen. The patient gets a token when they arrive, sits where they can see the TV, and goes in when the number is called. MedBrains gives a small clinic the same token system a hospital uses, set up for one queue and one screen.",
  sections: [
    {
      title: "What a token system fixes in a small clinic",
      body: [
        "In a single-doctor clinic the queue is usually a register at the front desk and a receptionist's memory. Patients ask \"how many before me?\" every few minutes, the person who stepped out to the chemist comes back to find they were skipped, and an elderly patient who should have gone in first waits behind a dozen others because nobody had a rule for it.",
        "A token system makes the order visible. Everyone can see who is in and who is next, the receptionist stops answering the same question, and the rules about who goes first are written down once, in the queue, instead of decided at the desk each time.",
      ],
    },
    {
      title: "How it runs on a clinic day",
      steps: [
        { title: "Set the queue up once", body: "The clinic's queue gets a prefix and starting number, a daily reset, and its hours. A clinic with morning and evening sessions can give each its own hours and its own prefix, so M-014 and E-014 are never confused. Tokens can start a little before the session opens, and a daily limit stops the desk issuing numbers the doctor will not reach." },
        { title: "Walk-ins and bookings, one queue", body: "A walk-in gets a token when the receptionist registers them or opens their visit. A patient who booked online gets a token when they check in, at the desk or at a self check-in kiosk by scanning the QR on their appointment slip. Both join the same queue and are called by priority and then by arrival; the booking does not jump the line on its own." },
        { title: "The doctor calls the next patient", body: "The doctor presses Call on their OPD screen, or the receptionist calls next from the token console. The number appears on the TV and is spoken aloud, so the doctor does not have to come to the door." },
        { title: "Priority without arguments", body: "Emergencies are always first. Senior citizens, people with disabilities and pregnant women are never called after an ordinary patient. If a patient in the waiting room looks worse, the receptionist or nurse can move them up; nobody can be moved down." },
        { title: "Missed turns", body: "A patient who was not there when called is marked no-show and can be put back in the queue when they return, or put on hold while they step out. A patient who could not be seen before closing is called ahead of ordinary patients at their next visit." },
      ],
    },
    {
      title: "The token display: one TV is enough",
      body: [
        "The token display is a web page, so the TV already on the clinic wall will do if it has a browser, or a TV stick will. The TV shows a code, you approve it once in Admin, and it opens the clinic's board. It shows only the number being called and the next few, with no patient names, so nobody in the room learns who is waiting. The call is spoken in English, Hindi or Tamil, as many times as you choose.",
        "Patients who check in at the kiosk can scan a QR and watch their place on their own phone: how many people are ahead, an estimated wait based on how long this clinic's consultations actually take, and a full-screen notice when they are called. That is what lets someone walk to the chemist and come back in time.",
      ],
    },
    {
      title: "SMS and WhatsApp: what to expect",
      body: [
        "We get asked this most often, so plainly: MedBrains does not send WhatsApp token updates. An SMS when a token is called exists for OPD, but it is off by default and not yet tied to the DLT-registered templates that Indian SMS rules require, so a clinic should not count on it today. The phone status page from the kiosk QR is the way a patient follows their token without watching the TV.",
      ],
    },
    {
      title: "Part of the clinic software, not a separate box",
      body: [
        `The token comes from the same registration and visit the doctor writes the case sheet in, so the receptionist does not type the patient twice into a separate token machine. The rest of the clinic, bookings, the case sheet, prescriptions and the patient app, is described on the ${link("/clinic-management-software", "clinic management software")} page. If you run several departments, the ${link("/hospital-token-system", "hospital token system")} guide covers department queues and counter tokens, and the ${link(HUB, "OPD queue management")} page walks through every step a token takes.`,
      ],
    },
  ],
  featuresTitle: "What a clinic gets",
  features: [
    { title: "One queue, two sessions", body: "Morning and evening hours with their own prefixes, a daily reset and a daily limit." },
    { title: "Walk-ins and bookings together", body: "Tokens at registration or check-in, in one queue, by priority and arrival." },
    { title: "A token display on any TV", body: "Paired once, number-only, with the call spoken aloud." },
    { title: "Call from the doctor's screen", body: "The doctor calls the next patient without leaving the room." },
    { title: "Follow the token by phone", body: "Kiosk check-ins get a QR to a page with the count ahead and an estimated wait." },
    { title: "No-shows that come back", body: "Requeue or hold a missed patient; one sent home unseen goes first next time." },
  ],
  caveat: "Not built: WhatsApp token updates, reliable SMS alerts (the OPD call SMS is off by default and not yet on DLT templates), a token in the patient app, and walk-in tokens at the kiosk, which is for patients with an appointment.",
  faq: [
    { q: "What is a clinic token management system?", a: "It is software that gives each patient a numbered token on arrival, keeps the queue in a fair order, and calls the next number on a screen and over the speaker. It replaces the register and calling out names." },
    { q: "Is an OPD token system worth it for a single doctor?", a: "If patients regularly ask how long they will wait, or argue about who came first, yes. One queue and one TV are enough, and the token comes from the same registration the clinic already does." },
    { q: "Do booked patients go before walk-ins?", a: "Not automatically. A booked patient gets their token when they check in and joins the same queue, ordered by priority and then arrival. Priority lanes decide who goes first, not the booking." },
    { q: "Do I need a token display machine?", a: "No. Any TV with a browser, or a TV stick, shows the token display. It is paired once with a code." },
    { q: "Does it send WhatsApp or SMS when the token is called?", a: "No WhatsApp updates. An OPD call SMS exists but is off by default and not yet on DLT-registered templates, so do not rely on it today. Kiosk check-ins can follow their token on their phone through a QR." },
    { q: "Can the receptionist move a patient up?", a: "Yes, if the patient's condition worsens: priority can be raised, never lowered. Senior citizens, people with disabilities and pregnant women are never called after an ordinary patient." },
  ],
  related: ["opd-queue-management", "hospital-token-system", "clinic-management-software"],
  relatedTitle: "Related",
};

const hospital: ModulePage = {
  slug: "hospital-token-system",
  parent: "opd-queue-management",
  title: "Token System for Hospitals: OPD, Lab & Pharmacy | MedBrains",
  description: "A token system for hospitals with many departments: a queue per department and counter, lab, pharmacy and billing tokens, and a TV board per waiting area.",
  eyebrow: "Hospital token system",
  h1: "A token system for hospitals with many departments and counters",
  intro: "A token system in a hospital is not one queue. It is a queue at registration, one per OPD department, and more at the lab, the pharmacy and the billing counter, each with its own waiting area and screen. MedBrains runs them all on one token system, and the patient keeps the same number from the first counter to the last.",
  sections: [
    {
      title: "Why hospitals outgrow a single token machine",
      body: [
        "A stand-alone token dispenser knows nothing about the patient. The registration desk issues one number, the doctor's assistant calls names, the lab hands out paper slips and the pharmacy has its own counter display. The patient carries four numbers, nobody can say how long anyone waited, and a patient who is in the wrong department simply waits in the wrong queue.",
        "When tokens come from the hospital's own registration and orders, the queue knows which department a visit is for, what the doctor ordered and when the bill was raised, so the next token is issued at the moment it is needed.",
      ],
    },
    {
      title: "How tokens flow across departments",
      steps: [
        { title: "Registration", body: "A registration counter can run its own token queue, and a patient who shares their ABHA profile by scanning the counter's QR gets a registration token straight away. ABHA Scan &amp; Share is built for ABDM; MedBrains is not yet certified by the National Health Authority." },
        { title: "OPD, one queue per department", body: "Opening the OPD visit issues a token in that department's queue. Each department configures its own prefix, numbering, hours, sessions and daily limit. Booked patients get their token when they check in at the desk or the self check-in kiosk." },
        { title: "Lab sample collection", body: "When a lab test is ordered, the patient gets a lab collection token, once per day, carrying the number they already hold for the visit. A STAT order lifts a patient already waiting for a routine collection." },
        { title: "Pharmacy", body: "A pharmacy order issues a pharmacy token, per store counter when the store is known, again on the visit's number." },
        { title: "Billing", body: "Raising the bill issues a billing-counter token, once per patient per day." },
        { title: "Wrong department", body: "A patient sent to the wrong department is moved, and the visit, the doctor's queue and the token move together. They keep their place by arrival time instead of starting again at the back." },
      ],
    },
    {
      title: "A board for every waiting area",
      body: [
        "Each waiting area gets its own TV board. Any TV with a browser will do: the screen shows a pairing code, an administrator approves it, and it is bound to that board. A paired screen signs in as a display that can read its board and nothing else, so a TV in a corridor never holds a staff session. Boards update live when a token is called.",
        "Boards show the token number only by default, or initials if a queue chooses. Names never reach a public screen. Calls are spoken in the queue's languages (English, Hindi and Tamil today), digit by digit, and repeated as the queue is set. Where several rooms or counters serve one queue, the board tells the patient which one to go to.",
      ],
    },
    {
      title: "Counters, staff and fairness",
      body: [
        "Every queue can be served by several counters or rooms. Each call names its counter, and a counter can be limited to named staff, so calls come from the right desk. Doctors in the staff app on iOS and Android see their own patients first, then the department's unassigned patients. The token console gives desk staff call next, recall, hold, move and no-show.",
        "Order is decided by rule, the same in every department. Stat, urgent and emergency referral are always first and cannot be configured away. Protected lanes for senior citizens, people with disabilities and pregnant women are never called after an ordinary patient. Courtesy lanes such as VIP come after them, and a patient sent home unseen yesterday returns ahead of VIP. Priority can be raised by staff who see a patient worsen, never lowered.",
      ],
    },
    {
      title: "Measured waits for management",
      body: [
        "At the end of the day, every open token is closed: those still waiting are marked expired, separately from no-shows, so the hospital's own backlog does not inflate the no-show rate. Service times are reported as the median and 90th percentile, per room, department, counter and doctor, from real visits. Wait times appear on the management dashboard against the usual day.",
        `What is not built: WhatsApp token updates, SMS alerts you can rely on (the OPD call SMS is off by default and not yet on DLT templates), tokens in the patient app and a native Android TV app. The rest of the hospital is on the ${link("/hospital-management-software", "hospital management software")} page, the full token flow on the ${link(HUB, "OPD queue management")} hub, and the setup for a small practice in the ${link("/clinic-token-management-system", "clinic token system")} guide. Camps run on the same tokens, station by station, as described in ${link("/health-camp-software", "health camp software")}.`,
      ],
    },
  ],
  featuresTitle: "What a hospital gets",
  features: [
    { title: "A queue per department", body: "Its own prefix, numbering, hours, sessions and daily limit." },
    { title: "Counter tokens on the visit's number", body: "Lab, pharmacy and billing tokens issued from the order or bill, carrying the patient's number." },
    { title: "A board per waiting area", body: "Paired TVs that can read only their own board, number-only, with voice." },
    { title: "Rooms and staff per counter", body: "Every call names its counter; counters can be limited to named staff." },
    { title: "Transfers that keep the place", body: "Visit, doctor's queue and token move together to the right department." },
    { title: "Service times per room and doctor", body: "Median and 90th percentile from real visits; expired kept apart from no-shows." },
  ],
  faq: [
    { q: "What is a token system in hospitals?", a: "It is how a hospital gives each patient a number for each queue they join, registration, the OPD department, the lab, the pharmacy and billing, and calls those numbers on screens in each waiting area. It keeps names off public screens and the order fair." },
    { q: "Can each department have its own queue and screen?", a: "Yes. Each department, counter or store has its own queue settings, and each waiting area's TV is paired to its own board." },
    { q: "Does the patient get a new number at the lab and pharmacy?", a: "Lab, pharmacy and billing tokens carry the number the patient already holds for the visit, so they listen for one number all day." },
    { q: "What if a patient is in the wrong department?", a: "They are moved to the right one, and the visit, the doctor's queue and the token move together. They keep their place by arrival time." },
    { q: "Does it work on any TV?", a: "Any TV with a browser, or a TV stick, can show a board. There is no separate Android TV app." },
    { q: "Can patients get SMS or WhatsApp alerts?", a: "No WhatsApp alerts. An OPD call SMS exists but is off by default and not yet on DLT-registered templates. Patients who check in at the kiosk can follow their token on their phone through a QR." },
  ],
  related: ["opd-queue-management", "clinic-token-management-system", "hospital-management-software", "health-camp-software"],
  relatedTitle: "Related",
};

export const TOKEN_PAGES: ModulePage[] = [hub, clinic, hospital];
