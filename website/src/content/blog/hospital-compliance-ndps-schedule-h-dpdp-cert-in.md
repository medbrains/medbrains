---
title: "Compliance you don't have to remember: NDPS, Schedule H, DPDP and CERT-In in daily hospital work"
seoTitle: "Hospital compliance: NDPS, Schedule H, DPDP, CERT-In"
description: "How hospital software can enforce NDPS, Schedule H, DPDP and CERT-In rules at the counter and in the server room, so staff don't have to remember them."
summary: "Most compliance failures in hospitals are not deliberate. They happen at a busy counter or in a forgotten log. Good hospital software makes the rule the default: medicines sold only from a scheduled catalogue, narcotics with a witness, patient data visible only to those who need it, and logs and clocks kept the way CERT-In asks. This post explains what each rule asks and what the software should do about it."
date: 2026-11-10
category: regulatory-compliance
tags: ["NDPS", "Schedule H", "DPDP Act", "CERT-In", "NABH", "Hospital pharmacy", "Hospital compliance", "Data protection"]
faq:
  - q: "Does hospital software make a hospital compliant on its own?"
    a: "No. Software can enforce rules at the moment of work and keep the records an inspector asks for. The hospital is still responsible: licences, a registered pharmacist on duty, staff training, consent practice and who it gives access to."
  - q: "Can a pharmacy still sell items that are not in its medicine list?"
    a: "In MedBrains, no. Every sale and dispense line must be a catalogue item with its drug schedule. A missing item is added to the catalogue first, by a pharmacist, with its schedule. This closes the gap where a Schedule H or narcotic drug is typed in as free text and sold without the checks."
  - q: "What if a doctor prescribes a medicine the hospital doesn't stock?"
    a: "The doctor or nurse marks it 'Buy outside'. It prints on the prescription, shows at the pharmacy as not dispensed here, appears on the medication chart as the patient's own medicine, and is never billed."
  - q: "Where should a hospital keep its IT logs for CERT-In?"
    a: "CERT-In's April 2022 directions ask for logs to be kept for 180 days within India, and for clocks to be synchronised to the NIC or NPL time servers. A small box keeps only days of logs locally, so the 180 days need an archive. Plan this with your IT team."
sources:
  - title: "CERT-In. Directions under sub-section (6) of section 70B of the IT Act, 2000 (28 April 2022)"
    url: "https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf"
  - title: "MeitY. Data protection framework (Digital Personal Data Protection Act, 2023)"
    url: "https://www.meity.gov.in/data-protection-framework"
  - title: "CDSCO. Acts and rules (Drugs and Cosmetics Act and Rules, including Schedules H, H1 and X)"
    url: "https://cdsco.gov.in/opencms/opencms/en/Acts-and-rules/"
  - title: "Narcotics Control Bureau, Government of India"
    url: "https://narcoticsindia.nic.in/"
  - title: "National Accreditation Board for Hospitals and Healthcare Providers (NABH)"
    url: "https://nabh.co/"
  - title: "Ayushman Bharat Digital Mission (ABDM)"
    url: "https://abdm.gov.in/"
---

Ask any medical superintendent or quality coordinator where compliance breaks, and the answer is rarely "someone decided to break the law". It breaks at a busy pharmacy counter at 9 pm. It breaks in a user account nobody remembered to remove. It breaks in a server log that was quietly deleted after a week.

Rules on paper depend on people remembering them under pressure. The better approach is to make the rule the default, so the safe path is also the easiest one. This post walks through four areas Indian hospitals deal with every day, what each one asks, and what hospital software should do about it.

*This is general information, not legal advice. Check the current rules and your own licences with your compliance team.*

## 1. Schedule H, H1 and X medicines: the counter is where it matters

The Drugs and Cosmetics Rules put prescription medicines into schedules. Schedule H and H1 need a prescription, and H1 sales must be recorded. Schedule X has stricter record-keeping still. Narcotic and psychotropic drugs fall under the NDPS Act, with registers, storage rules and accountability for every unit.

**Where it goes wrong:** the medicine isn't in the system, so someone types its name into a free-text line to keep the queue moving. Now a controlled drug is sold with none of the checks, and no record says what it really was. Matching typed names against a drug list does not fix this. Misspellings, brand names and look-alike characters slip through.

**What the software should do:**

- **Sell only from the catalogue.** Every sale and dispense line is a catalogue item, and every catalogue item carries its schedule. If an item is missing, a pharmacist adds it first, with its schedule, and the counter can't skip that step.
- **Narcotics need a second person.** NDPS dispensing records who prescribed, who dispensed and who witnessed, against the register.
- **Medicines the hospital doesn't stock are marked on purpose.** A doctor or nurse marks the line "Buy outside". It prints on the prescription, shows at the pharmacy as not dispensed here, goes on the medication chart as the patient's own medicine so nurses still record it, and is never billed.

That last point matters for patients too. Nobody should be charged for a medicine they bought elsewhere.

## 2. Who can see and change what: access is a compliance control

NABH expects access to records to be controlled, and the DPDP Act expects personal data to be protected. Both fail most often through access that grew quietly: a manager who gave themselves "just one more" permission, or an old account that still works.

**What the software should do:**

- **Nobody can grant what they don't hold.** A department manager can give staff only the permissions the manager has. They can't touch administrator accounts or change their own access.
- **Administrators sign in with two steps.** A password and an authenticator code, from the first day the system is set up.
- **Removing a person removes their access everywhere**, not just in one screen.
- **Every change is in the audit trail:** who changed whose access, when and from where.

## 3. Patient data under the DPDP Act

The Digital Personal Data Protection Act, 2023 makes the hospital a data fiduciary. Patients have rights to access, correct and erase their data, to nominate someone, and to raise grievances, and the hospital has to respond within set times.

**What the software should do:**

- **Record consent**, and track each access, correction, erasure, nominee and grievance request with its due date.
- **Keep clinical values out of logs.** Error logs are useful to engineers, and they are also a classic leak. A test result or a patient ID should never end up in a log file. In MedBrains, logging the body of a failed request is switched off by default. When an engineer turns it on to debug, names, phone numbers, IDs and long numbers are scrubbed first.
- **Erasure is a human decision.** Medical records have legal retention periods, so the software tracks erasure requests and their deadlines, and a person decides.

## 4. CERT-In: logs and clocks

CERT-In's directions of April 2022 apply to organisations running IT systems in India. Two parts trip up hospitals most often:

- **Logs kept for 180 days, within India.** A small hospital server often keeps only days or weeks of logs before rotating them.
- **Clocks synchronised to the NIC or NPL time servers**, so events can be lined up across systems during an investigation.

**What the software should do:**

- **Use India's time sources by default.** In MedBrains, the main machine uses the NIC and NPL servers alongside authenticated time sources, and ward PCs take their time from the main machine.
- **Keep logs bounded locally, and archive them.** The local log is capped so it can never fill the disk, and an archive keeps the full 180 days. Archiving is switched on deliberately by the hospital's IT team, because the archive location is the hospital's choice.

## What stays the hospital's job

Software can make the right action the default and keep a clean record. It can't replace:

- valid drug and establishment licences, and a registered pharmacist on duty;
- training, so staff know why the rules exist;
- consent conversations with patients;
- deciding who should have access, and reviewing it regularly;
- choosing where logs and backups are stored.

## A simple test for any hospital system

Ask your vendor, or your own team, to show you five things live:

1. Try to sell a medicine that isn't in the catalogue. What happens?
2. As a department manager, try to give yourself an extra permission.
3. Show who changed a user's access last month, and when.
4. Show where a failed request is logged, and whether patient data appears in it.
5. Show what time source the server uses, and how long its logs are kept.

If the answers come from the system, not from someone's memory, compliance is part of the daily work rather than an extra job.
