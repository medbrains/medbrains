# Medical College (Academic) module — scope

Status: **scoping only, nothing built** (2026-10-12). Feeds the 15 print forms in
`crates/medbrains-print-data/src/academic.rs` that return `501 NotImplemented`.

Sources read: `academic.rs`, `medbrains-core/src/print_data.rs` (lines 4575-5170),
`apps/web/src/lib/print/print-registry*.ts`, `scripts/generate_print_registry.py`,
`crates/medbrains-db-migrations/src/migrations/*.sql`, `medbrains-core/src/permissions.rs`,
RFC-HMS-v2.1-Continuation Part D (D1-D12; file is at `RFCs/old/RFC-HMS-v2.1-Continuation.pdf`),
`apps/web/src/data/features.json` (Academic ERP: 59 rows, all Pending).

---

## 1. Purpose and users

A teaching hospital carries a college: interns rotating through its wards, PG
residents logging cases, students sitting exams, an ethics committee approving
research, CME for its doctors, hostels. Today the HMS knows these people only as
`users`/`employees`; nothing records the academic facts the 15 documents print.

| User | Does |
|---|---|
| Dean / Principal | issues internship completion certificates, signs hall tickets, approves plans |
| Academic coordinator / MEU | admissions, rotations, exams, CME calendar |
| HOD / unit head | certifies an intern's posting, approves internal assessment |
| Faculty / examiner | enters IA marks, OSCE scores, runs simulation sessions |
| IEC chair / member secretary / members | review proposals, issue approval certificates |
| Principal investigator | submits research proposals |
| HR / finance | stipend runs, service bonds |
| Warden / chief warden | hostel allotment |
| Disability coordinator (NMC "enabling unit") | accommodation plans |
| Intern / PG resident / student | own schedule, own logbook, own documents (self-view) |

---

## 2. How print data is wired (and what each of the 15 needs)

- Handler in `academic.rs` → typed struct in `medbrains-core/src/print_data.rs` →
  client method in `packages/api/src/client.ts` (all 15 already exist, e.g.
  `getStudentAdmissionFormPrintData`) → registry.
- `scripts/generate_print_registry.py` writes `print-registry.generated.ts` and
  **excludes** handlers that return NotImplemented, have no `require_permission`,
  read a table nothing INSERTs into, or whose client method takes >1 id. So a
  form appears in the UI automatically once its handler reads a table that a
  screen writes, and carries a permission. That is the "done" test per form.
- `osce-scoring-sheet/{exam_id}/{station_number}` takes two ids → will stay
  excluded. Re-key it to `/osce-scoring-sheet/{score_id}` when built.

| # | Form (route) | Data it needs beyond users/departments/tenant |
|---|---|---|
| 1 | student-admission-form/{admission_id} | student master: course, batch, NEET score/rank, category, quota, parents, addresses, documents checklist, fee summary, fitness, undertaking flag, university, registrar |
| 2 | intern-rotation-schedule/{schedule_id} | internship + postings (dept, unit, dates, days, core/elective, supervisor, status), leave allowed, mentor, coordinator |
| 3 | internal-assessment-marks/{assessment_id} | student, subject, term, theory/practical/viva components, attendance %, eligibility, faculty, HOD |
| 4 | exam-hall-ticket/{ticket_id} | exam, session, papers (code, date, time, type), centre, instructions, controller, barcode |
| 5 | osce-scoring-sheet/{exam_id}/{station} | station (type, minutes, scenario, task rubric), candidate, task marks, global rating, examiner |
| 6 | simulation-debriefing/{session_id} | scenario, type, participants+roles, objectives, event timeline (expected vs actual), debrief points, facilitator, centre |
| 7 | cme-certificate/{certificate_id} | CME event, hours, credit hours, accreditation body + number, faculty, participant registration, QR verify |
| 8 | iec-approval-certificate/{approval_id} | proposal, PI, co-Is, design, sample size, review type, category, conditions, valid-until, CTRI no., chair, member secretary, meeting no./date |
| 9 | research-proposal-form/{proposal_id} | full protocol summary: objectives, criteria, outcomes, stats, consent process, funding, budget heads |
| 10 | hostel-allotment-order/{order_id} | hostel, room, type, floor, period, mess, fee heads, emergency contact, warden |
| 11 | anti-ragging-undertaking/{undertaking_id} | student + parent declarations, dates, helpline, Aadhaar last 4 |
| 12 | disability-accommodation-plan/{plan_id} | disability type/%, certificate (UDID), limitations, accommodations (class/exam/hostel), review date, consent, coordinator |
| 13 | internship-completion-certificate/{certificate_id} | internship totals, leave, extension, postings + satisfactory flags, conduct, SMC, principal |
| 14 | service-bond-agreement/{bond_id} | **employee**-centric: bond period/amount (+words), clauses, surety, two witnesses, notary |
| 15 | stipend-payment-advice/{advice_id} | recipient (intern/PG/fellow), bank, earnings/deductions, attendance/leave days, arrears, prepared/verified/approved |

Institution-level strings (university name, State Medical Council, principal,
registrar, controller of exams, anti-ragging helpline) → `tenant_settings` keys
under `academic.*`, not a new table.

---

## 3. What already exists (reuse candidates)

**No academic tables exist** — no student, internship, exam, OSCE, CME, IEC,
hostel, ragging, bond or stipend table in the 141 live migrations or the 262
archived ones. No role for intern/student/faculty/dean in `user_role`. But a lot
is reusable:

| Existing | Where | Reuse for |
|---|---|---|
| `pg_logbook_entries` (+ create/list in `medbrains-telehealth/src/cds.rs`, page `apps/web/src/pages/pg-logbook.tsx`) | `0080_clinical.sql` | intern logbook too (same shape: user, dept, supervisor, verified). PG logbook print is the only implemented academic form. |
| `employees.employment_type` enum already has `intern`, `resident`, `fellow` | `0001_…sql:1157` | interns/PGs as employees → stipend through payroll |
| `salary_structures`, `payroll_runs`, `payslips` (earnings/deductions jsonb, lop/paid days) + `medbrains-payroll` crate | `0310_payroll.sql` | **stipend advice = a payslip of an intern/resident/fellow**; no new table |
| `attendance_records`, `leave_applications`, `aebas_*` | `0190_hr.sql` | intern leave count; AEBAS is already the NMC faculty-attendance feed |
| `clinical_trials`, `trial_irb_submissions` (initial/amendment/renewal/sae_report/closure; submitted…approved) + `apps/web/src/pages/clinical-trials/irb-modal.tsx` | `0080`, `0090` | IEC review ledger — extend rather than duplicate (see P2) |
| `quality_committees` (chair, secretary, members jsonb), `quality_committee_meetings` (meeting_number, dates, minutes, decisions) | quality migrations | IEC as a committee (`committee_type='iec'`), its meetings |
| `training_programs`, `training_records`, `training_attendance`, `trainings`, `lms_*` incl. `lms_certificates` | `0190_hr.sql`, `0330_print_data.sql` | staff training only (employee_id, no accreditation, no external delegates) — **not** a fit for CME; FDP (BCME/ACMET) tracking can live in `employee_credentials`/`training_records` |
| `employee_credentials` (issuing_body, registration_no, state_code, expiry) | `0190_hr.sql` | doctor's SMC registration number on CME certs |
| `sequences` table (atomic `UPDATE … RETURNING`) | | admission no., certificate no., hall-ticket no., bond no. |
| `invoices.verify_code` + `app_verify_invoice()` public lookup | `1061_invoice_verify_code.sql` | QR verification pattern for CME + completion certificates |
| `facility_type` / `hospital_type` = `medical_college` | `0001_…sql` | entitlement gate (`server-core/middleware/entitlement.rs`). Note `onboarding` turns every module on for `multi_specialty` too — academic must be gated to `medical_college` explicitly |
| `amount_to_words` — **two copies** (`print-data/src/admin.rs:1474`, `billing.rs:2348`) | | bond amount in words: hoist one to a shared fn, don't add a third |
| location hierarchy (`locations`/facilities) | | skills-lab / hostel buildings (open decision §8) |

Permissions that exist and fit: `hr.payroll.runs.list` (stipend advice),
`hr.employees.*`, `specialty.clinical_trials.{list,create,unblind}`, `lms.*`,
`hr.training.*`, `research.triage_export` (so a `research` module already exists
in Rust — new research codes nest under it). Nothing named `academic.*`.

Surprises:
- `get_pg_logbook_entry` is gated on `opd.queue.view` (front desk holds it) and
  has **no client method**, so it is not in the print registry either. Fix in P1:
  new `academic.logbook.*` permission + client method.
- The RFC's internship list (Medicine 2 mo, Surgery 2 mo…) is the **pre-2021**
  schedule. CRMI 2021 differs (below). Build to the gazette, not the RFC.
- `service-bond-agreement` is shaped for an **employee** bond (designation,
  date of joining), not the state PG/UG service bond the RFC describes.

---

## 4. Regulatory norms

| Area | Norm | Rule the system must enforce | Source |
|---|---|---|---|
| Internship | NMC Compulsory Rotating Medical Internship (CRMI) Regulations 2021 | ≥12 months; complete within **2 years** of passing final MBBS/FMGE/NExT-1. Schedule (52 wk): Community Medicine 12 wk (incl. 3-wk rotations at CHC/RHC), Gen Medicine 6, Psychiatry 2, Paediatrics 3, Gen Surgery 6, Anaesthesia 2, OBG 7, Orthopaedics 2, Emergency/Trauma 2, Forensic Med 1, DVL 1, ENT 2, Ophthalmology 2, Electives 4 (broad specialty ≥1 wk; optionally 1 wk AYUSH). Leave: **15 days total** (medical leave inside it); not all 15 in one 1–2-week posting; paternity 2 wk; maternity per govt rules; beyond 15 days → extension equal to excess, **repeated in that same department**. Logbook verified by the supervising MO; Unit head + HOD certify each posting; Dean issues cumulative completion certificate. Stipend as fixed by state/authority, **not paid during extension** except Medical-Board-approved medical/maternity/paternity; max 52 weeks paid. | [CRMI 2021 gazette (TN Health)](https://thc.nic.in/Central%20Governmental%20Regulations/National%20Medical%20Commissions%20(Compulsory%20Rotating%20Medical%20Internship)%20Regulations,%202021.pdf), [NMC CRMI FAQs](https://medicaldialogues.in/news/education/nmc-releases-faqs-on-crmi-regulations-2021-details-92494), [amended CHC schedule](https://www.santosh.ac.in/assets/images/pdf/56th%20BOM-Minutes%20held%20on%2030.03.2022.pdf) |
| UG curriculum / exam eligibility | NMC GMER 2023 + CBME Curriculum 2024 (+UGMSR 2023 amendments 2025, 2026) | Attendance **≥75% theory and ≥80% practical per subject per phase** to sit the university exam. IA: common university rule theory ≥40%, practical ≥40%, combined ≥50% — **varies by university → configurable**. Remedial for IA failure. Competency (Knows/Knows how/Shows how/Does) + AETCOM logbook. | [NMC rules page](https://www.nmc.org.in/rules-regulations-nmc/), [VNSGU eligibility circular](https://vnsgu.ac.in/uploads/syllabus/Syllabus%20(2022-2023)/Medical/Circular%20Regarding%20%20Medicine%20%20Faculty%20MBBS%20Eligibility%20&%20%20Assessment%20policy.pdf), [CG Health Univ letter](https://cghealthuniv.com/news/05082024031523_letter%20of%20high%20court%20for%20all%20medical%20college%20about%20attendance%20or%20internal%20marks.pdf) |
| Anti-ragging | UGC Regulations on Curbing the Menace of Ragging 2009; NMC (Prevention and Prohibition of Ragging) Regulations 2021 | Separate undertaking from **student and parent/guardian**, at admission and **every academic year** (online at antiragging.in; NMC Form II on notarised stamp paper for parent). Anti-Ragging Committee + Squad; annual report to NMC. Helpline 1800-180-5522, helpline@antiragging.in. | [NMC undertakings (IPGMER)](https://ipgmer.gov.in/pdf/notice/NMC-Antiragging-undertakings-Student-Guardian.pdf), [HIMSR parent form](https://www.himsr.co.in/wp-content/uploads/2026/08/11.-Anti-ragging-undertaking-%E2%80%94-by-the-parent-or-guardian.pdf), [UGC 2009 text](https://www.khudirambosecentralcollege.com/documents/20220518_UGC_Regulations_Anti-Ragging.pdf), [NMC Dec 2024 enforcement](https://news.careers360.com/nmc-cracks-down-on-ragging-in-medical-colleges-emphasises-strict-adherence-anti-ragging-policies/amp) |
| Disability | RPwD Act 2016; NMC Guidelines on Assessment of PwBD for MBBS 2026 (27-Jul-2026) | Benchmark ≥40% + permanent **UDID**; Medical Assessment Board functional assessment, outcomes Eligible / Eligible with Reasonable Accommodation / Ineligible (reasoned). Colleges run an **enabling unit**. Disability data is health data → sensitive field class. | [Medical Dialogues summary](https://medicaldialogues.in/amp/health-news/nmc/nmc-notifies-pwbd-assessment-guidelines-for-mbbs-admissions-2026-introduces-competency-based-framework-check-complete-details-175891), [TeamLease RegTech](https://teamleaseregtech.com/updates/article/58592/nmc-issued-the-guidelines-on-assessment-of-persons-with-benchmark-disabilities-pwbd-for-admission-to-the-mbbs-course-2026/) |
| Ethics committee | NDCT Rules 2019 (EC registration, Rule 17 / Ch. IV; SAE Ch. VI); ICMR National Ethical Guidelines 2017 | EC registered with CDSCO (trials) / DHR (other biomedical research), registration validity tracked. 7–15 members, multidisciplinary, gender balance, ≥50% non-affiliated preferred, **quorum ≥5**. Membership changes reported. Records kept **≥5 years** after trial completion. Review types: full / expedited / exempt; initial, amendment, continuing, SAE. | [CDSCO EC registration letter](https://cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadEthicsReRegistration/SIMStnrcrr.pdf), [DHR registration (KEM)](https://kem.edu/wp-content/uploads/2024/08/IEC-I/IEC-I-DHR-registration-2021-to-2026.pdf) |
| Trial registration | DCGI mandate (15-Jun-2009); CTRI prospective-only since 1-Apr-2018 | CTRI number **before first participant enrolled**; CTRI rejects EC approval older than 1 year. | [CTRI FAQ](https://www.ctri.nic.in/Clinicaltrials/faq.php), [CTRI home](https://www.ctri.nic.in/) |
| CME | State Medical Council registration renewal (e.g. TN, Goa: **30 credit hours / 5 years**); NMC CPD draft similar | Credit hours only for SMC-accredited programmes; certificate carries accreditation number; per-doctor credit ledger. | [TN Medical Council gazette](https://medicaldialogues.in/all-doctors-have-to-submit-proof-of-cme-credit-hours-tn-medical-council-gazette), [Goa MC](https://www.medicaldialogues.in/news/health/doctors/goa-medical-council-directs-doctors-to-renew-registrations-within-15-days-122677) |
| Service bond | State bond policies; SC 2019 upheld PG service bonds; NMC Jan-2024 asked states to review/drop **seat-leaving** bonds; MoHFW drafting scrap guidelines (2024) | Bond terms are **state-specific and in flux** → all amounts/periods are data, never constants. | [LiveLaw SC 2019](https://www.livelaw.in/amp/top-stories/compulsory-service-bonds-admission-pg-medical-super-speciality-courses-upheld-147316), [Medical Dialogues NMC relax](https://medicaldialogues.in/amp/health-news/nmc/nmc-considering-to-relax-bond-policies-report-129154) |
| Faculty development | NMC BCME (incl. AETCOM), ACMET | Validity tracked (colleges cite 5 yr) — HR credentials, not this module's print forms. | [AVMC BCME](https://avmc.edu.in/basic-course-in-medical-education) |
| Privacy | DPDP Act 2023, Aadhaar Act | Store **Aadhaar last 4 only** (form needs only that); minors' (under-18 first-years) data needs guardian context. | — |

Not verified to primary text (flagged): exact IA thresholds (university-specific),
current NMC skills-lab standards in UGMSR 2023, NMC CPD regulation text.

---

## 5. Permissions (proposed; none exist except where marked)

Defined in `crates/medbrains-core/src/permissions.rs` with `///` docs, generated
to TS, granted in `access/roles.rs`. Self-access (an intern reading their own
internship, a student their own hall ticket) is a per-record relation check on
`user_id = claims.sub`, not a broad permission.

```
academic.logbook.list / .verify            (replaces opd.queue.view on PG logbook print)
academic.internship.list / .manage         rotations, leave, extensions
academic.internship.certify_posting        unit head / HOD sign-off
academic.internship.issue_completion       Dean/Principal only
hr.payroll.runs.list                       EXISTS — stipend advice print
hr.service_bonds.list / .manage            employee bonds (P3)
research.proposals.list / .create / .manage
research.iec.review                        member: own assigned proposals
research.iec.decide                        chair / member secretary: issue approval
academic.cme.list / .manage / .issue_certificate
academic.students.list / .view / .create / .update
academic.anti_ragging.manage
academic.disability.view / .manage         sensitive class — masked elsewhere
academic.assessment.list / .enter / .approve
academic.exams.manage / .issue_hall_ticket
academic.osce.manage / .score              score immutable after submit
academic.simulation.list / .manage
academic.hostel.list / .manage
```

Data classes (`check-field-classes`): disability fields, `medical_conditions`
on hostel allotment, parents' contact, bank account → sensitive/masked.

---

## 6. Phases

Each phase: migration → Rust handlers + print handler → client + types → web
screen → registry regenerates → Playwright journey. Sizes are rough
(S ≤3 d, M 4–8 d, L 9–15 d) and include tests.

### P1 — Internship (CRMI) + stipend advice  · **M, ~6–7 days, ~1.8k LOC**
Smallest useful slice: interns already exist as users/employees in the
hospital's own wards; no student master needed; stipend is pure payroll reuse.

**Unlocks 3 forms:** intern-rotation-schedule, internship-completion-certificate,
stipend-payment-advice. Also fixes the PG logbook print gate.

Tables (all `tenant_id` + RLS + soft-delete cols, `update_updated_at()` trigger):
- `internships` — `user_id`→users, `employee_id`→employees (nullable; required
  for stipend), `qualifying_exam` (final_mbbs|fmge|next1), `qualified_on` (2-yr
  window), `mbbs_university`, `mbbs_pass_year`, `batch_label`, `start_date`,
  `planned_end_date`, `actual_end_date`, `mentor_user_id`, `coordinator_user_id`,
  `status` (planned|ongoing|extended|completed|withdrawn|cancelled),
  `extension_days`, `conduct`, `completion_certificate_no`, `verify_code`,
  `completed_by`, `completed_at`. Partial unique on `(tenant_id,user_id)` where
  live and not cancelled.
- `internship_postings` — `internship_id`, `crmi_code`, `department_id`,
  `unit_name`, `start_date`, `end_date`, `leave_days`, `is_extension`,
  `extension_stipend_approved` (Medical Board), `supervisor_user_id`, `status`,
  `assessment` jsonb (knowledge/skills/attitude), `satisfactory`,
  `unit_head_certified_by/at`, `hod_certified_by/at`.
- CRMI schedule = a Rust constant (`medbrains-core/src/academic/crmi.rs`, 14
  rows) — it's a gazette, not tenant config. ponytail: a master table only if a
  university imposes a variant.

Rules (service layer): completion blocked unless every mandatory `crmi_code`
is completed + satisfactory + double-certified, electives = 4 wk; total leave
>15 d auto-creates an extension posting in the same department; ≤15 d but all
in one 1–2-wk posting rejected; completion after `qualified_on + 2y` flagged;
payroll skips/zeroes intern stipend for extension days unless
`extension_stipend_approved`; stipend never beyond 52 weeks.

Endpoints: `GET/POST /academic/internships`, `GET/PATCH /academic/internships/{id}`,
`POST /academic/internships/{id}/postings`, `PATCH /academic/postings/{id}`,
`POST /academic/postings/{id}/certify`, `POST /academic/internships/{id}/complete`,
`GET /academic/internships/me`; print handlers re-key: rotation schedule on
`internship_id`, completion on `internship_id`, stipend advice on `payslip_id`
(where employee type ∈ intern/resident/fellow).

Screens: `/academic/internship` — list (batch, status, current posting,
leave used/15); detail drawer: CRMI checklist timeline, add/edit posting
(department picker, supervisor picker), leave entry, certify buttons gated on
`certify_posting`, "Issue completion certificate" gated on `issue_completion`.
HR payroll payslip row: "Print stipend advice" for intern/resident/fellow.
`pg-logbook.tsx` gains print. Mobile: none in P1 (intern self-view → P7).

### P2 — Research proposals + IEC  · **M, ~7–8 days, ~2k LOC**
**Unlocks 2:** research-proposal-form, iec-approval-certificate.
- `research_proposals` — `proposal_number`, `title`, `pi_user_id`,
  `pi_department_id`, `research_type`, `study_design`, `objectives` text[],
  `background`, `methodology`, `sample_size`, `sample_size_justification`,
  `inclusion`/`exclusion`/`outcome_measures`/`expected_outcomes` text[],
  `statistical_methods`, `ethical_considerations`, `consent_process`,
  `funding_source`, `budget` jsonb (5 heads), `duration_months`,
  `co_investigators` jsonb, `is_thesis`, `clinical_trial_id`→clinical_trials
  (nullable), `ctri_number`, `status`.
- Extend `trial_irb_submissions` into the one ethics ledger: `trial_id` nullable
  + `proposal_id`, add `review_type` (full|expedited|exempt), `meeting_id`→
  `quality_committee_meetings`, `approval_number`, `conditions` text[],
  `reporting_requirements` text[], `valid_until`, `decided_by`. CHECK one of
  trial/proposal set.
- `quality_committees` + `cdsco_registration_no`, `dhr_registration_no`,
  `registration_valid_until` for `committee_type='iec'`.
Rules: decision requires a meeting with ≥5 present (attendees jsonb); PI/co-I
cannot vote on own proposal; trial enrolment blocked without CTRI number;
warn if approval >1 yr old when CTRI no. is entered; records retained ≥5 yr
(no hard purge).
Screens: `/research` — Proposals (my / all), IEC queue + decision drawer;
clinical-trials IRB modal reads/writes the same ledger.

### P3 — CME certificates + service bonds  · **M, ~5 days, ~1.4k LOC**
**Unlocks 2:** cme-certificate, service-bond-agreement.
- `cme_events` — title, dates, `duration_hours`, `credit_hours`,
  `accreditation_body`, `accreditation_number`, `organizing_department_id`,
  `organizing_secretary_user_id`, `topics` text[], `faculty` jsonb, `status`.
- `cme_attendees` — `event_id`, `user_id` (nullable: external delegates),
  `full_name`, `registration_number`, `smc`, `designation`, `institution`,
  `attended`, `certificate_number`, `verify_code`, `issued_at`. Credits only
  if attended and event has an accreditation number. Per-doctor credit view =
  sum by `user_id`. Public QR verify like `app_verify_invoice`.
- `service_bonds` — `employee_id`, `bond_number`, `bond_date`, `bond_type`,
  `period_months`, `amount`, `terms` text[], `leave_rules`, `exit_clause`,
  `penalty_clause`, `surety` jsonb, `witnesses` jsonb (exactly 2),
  `notarization_required`, `notary_name/date`, `service_start_date`,
  `status` (active|served|released|forfeited|waived), `released_at`,
  `forfeiture_amount`.
Screens: `/academic/cme` (events, attendance, issue certificates); HR employee
detail → "Bonds" tab.

### P4 — Student register, admission, anti-ragging, disability  · **L, ~12 days, ~3k LOC**
**Unlocks 3:** student-admission-form, anti-ragging-undertaking,
disability-accommodation-plan.
- `academic_programs` — code (MBBS, MD-…), name, university, duration_years,
  `sanctioned_intake` (NMC); admission blocked over intake per batch.
- `students` — `user_id` (nullable until portal), `admission_number`,
  `roll_number`, `admission_date`, `program_id`, `batch_year`, `current_phase`,
  names, `date_of_birth`, `gender`, `photo_document_id`, parents, addresses
  jsonb, contacts, `blood_group`, `nationality`, `category`, `is_pwbd`,
  `admission_quota`, `neet_roll_no`, `neet_score`, `neet_rank`,
  `qualifying_exam`, `qualifying_percent`, `documents` jsonb, `admission_fee`
  jsonb + `fee_receipt_no`, `medical_fitness_certified`, `hostel_opted`,
  `status` (admitted|active|detained|discontinued|graduated).
- `anti_ragging_undertakings` — `student_id`, `academic_year`,
  `undertaking_number`, `antiragging_portal_ref`, student declaration + signed
  date, parent name/relationship/contacts/address + signed date,
  `regulations_read`, `consequences_understood`, `aadhaar_last4`. Unique
  (student, academic_year). Student cannot move to `active` for a year without
  both signatures.
- `disability_accommodation_plans` — `student_id`, `udid_number`,
  `disability_type` (RPwD 21 categories), `percentage`, `issuing_authority`,
  `board_outcome` (eligible|eligible_with_accommodation|ineligible),
  `functional_limitations` text[], `accommodations` jsonb, classroom/exam/hostel
  text[], assistive devices, support staff, `review_period_months`,
  `next_review_date`, `student_consent`, `coordinator_user_id`, `approved_by`.
Screens: `/academic/students` (list, admission drawer RHF+Zod, detail tabs:
profile, documents, undertakings, accommodation). Fee ledger out of scope (§8).

### P5 — Assessment, exams, OSCE  · **L, ~12–14 days, ~3.2k LOC**
**Unlocks 3:** internal-assessment-marks, exam-hall-ticket, osce-scoring-sheet.
- `academic_subjects` (program, code, name, phase).
- `internal_assessments` — student, subject, academic_year, term,
  `components` jsonb (name, kind theory|practical|viva, marks, max, date),
  theory/practical sessions held/attended, computed `eligible`, remarks,
  `faculty_user_id`, `approved_by/at`, locked after approval.
  ponytail: attendance as per-term held/attended counts entered by faculty;
  per-session attendance (or AEBAS/biometric) when a college asks.
- `exams`, `exam_papers` (subject, date, time, paper_type), `exam_hall_tickets`
  (exam, student, number, `verify_code`, `withheld_reason`). Issue blocked when
  any paper's subject is ineligible (75/80 attendance, IA thresholds from
  `tenant_settings`).
- `osce_exams`, `osce_stations` (number, name, type, minutes, scenario, `tasks`
  rubric jsonb, max/pass marks), `osce_scores` (station, student, examiner,
  task marks, global rating, comments, `submitted_at` — immutable after).
Screens: `/academic/assessment` (marks entry grid per subject/term, HOD
approve), `/academic/exams` (exam setup, eligibility list, issue tickets),
OSCE examiner score entry (tablet-friendly web; native later).

### P6 — Skills lab debrief + hostel  · **M, ~7 days, ~1.8k LOC**
**Unlocks 2:** simulation-debriefing, hostel-allotment-order.
- `simulation_sessions` (date, scenario, type, minutes, objectives, CBME
  competency codes, facilitator, technician, location_id, events jsonb,
  debrief points jsonb, outcomes, improvements, feedback, `recording_consent`),
  `simulation_participants` (student_id or user_id, role). Mannequins = BME
  equipment, not a new inventory.
- `hostel_rooms` (hostel, block, floor, number, type, capacity, gender) or
  locations (§8); `hostel_allotments` (order number, student, room, year,
  from/to, mess, mess_type, fee jsonb, rules_acknowledged, emergency contact,
  `medical_conditions` sensitive, warden, chief warden, status). Capacity
  enforced in the allotting transaction (`SELECT … FOR UPDATE` on room).

### P7 (later, no print form) — self-service + mobile
Intern/PG/student self-view in the native staff app (own rotation, logbook
entry with supervisor verify — features.json marks these Mobile=Y), anti-ragging
complaints (anonymous, dual-key per RFC STU-001), ICC/POSH and counselling
(strict isolation), library, anatomy/cadaver register, NMC NARF dashboard.

| Phase | Forms unlocked | Running total | Size |
|---|---|---|---|
| P1 | rotation schedule, completion cert, stipend advice | 3/15 | M |
| P2 | research proposal, IEC approval | 5/15 | M |
| P3 | CME cert, service bond | 7/15 | M |
| P4 | admission, anti-ragging, disability plan | 10/15 | L |
| P5 | IA marks, hall ticket, OSCE sheet | 13/15 | L |
| P6 | simulation debrief, hostel allotment | 15/15 | M |

Total ≈ 50–55 dev-days, ~13k LOC.

---

## 7. Cross-cutting

- Entitlement: `require_module_enabled("academic")`, enabled by default only for
  `hospital_type = medical_college` (onboarding currently turns all modules on
  for `multi_specialty` too — exclude academic there).
- Numbers from `sequences` (`ADM/`, `INT-CC/`, `CME/`, `HT/`, `BOND/`).
- Each print handler: `require_permission` + per-record self/relation check;
  `NotFound` for denial, never fabricated fallbacks (the 501 comment's rule).
- Every list screen renders an authz/outage error distinctly from "no rows".
- 450-line file cap → one crate `medbrains-academic` with per-phase modules.

## 8. Open decisions

1. **P1 vs P2 first.** Recommended P1 (internship): highest daily use, NMC
   completion certificate is a registration prerequisite. P2 is equally cheap
   if the client's immediate need is IEC.
2. Are interns/PGs required to have an `employees` row (needed for stipend via
   payroll)? Recommended yes.
3. IEC: extend `trial_irb_submissions` (recommended, one ledger) vs a new
   `iec_reviews` table.
4. Students: login users (portal) from day one, or records only until P7?
5. IA pass thresholds and attendance make-up rules per affiliated university —
   defaults 40/40/50 + 75/80, editable in `tenant_settings`?
6. Student fees: separate academic fee ledger, or billing module invoices with
   a non-patient payer? (Admission form only needs a summary.)
7. Service bond scope: employee bonds only (matches the print struct), or also
   state PG/UG service bonds on students — which are legally in flux (NMC 2024).
8. Hostel rooms and skills lab: model in the location hierarchy or own tables.
9. Roles: add built-in roles (dean, academic_coordinator, iec_secretary,
   intern, pg_resident, faculty, warden) to `BUILT_IN_ROLES`, or leave to
   custom roles?
10. Does an intern's leave come from `leave_applications` (HR) or a posting
    field? Recommended HR leave, summed per posting window.
