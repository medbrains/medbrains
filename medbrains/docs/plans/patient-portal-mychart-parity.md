# Patient portal and app: MyChart parity, and past it

A plan only. No code is written until the owner approves it. Base branch `release/3.34.0`
(2027-02-09); later work goes to later quarterly releases.

The owner approved eight gaps against Epic MyChart. This plan says what exists today, verified in
the code on 2026-11-14, then for each gap: permissions, endpoints, schema, the screens on web, iOS
and Android, scenarios, regulatory notes and dependencies. It ends with a build order and the
places we go further than MyChart.

Rules this plan follows: permissions first (Rust, then generated outward), every change ships its
UI on all three patient surfaces, plan UI before build, authorization law (three outcomes, gate
the query, the service layer is the guard), the strict AI seam, one native app per audience with
modules gated at runtime, targeted changes, and refactoring only where it removes code.

## Who and when

- **Asha, 34, pregnant, on a ₹7,000 Android phone with patchy data.** She books her next ANC
  visit, fills the pre-visit form on the bus, joins the queue from the car park, and shows her
  digital MCP card at the district hospital, which scans its QR.
- **Ravi, 41, father of Arjun, 6.** He sees Arjun's vaccinations and results and books his visits.
  When Arjun turns 18, Ravi's access ends on its own.
- **Meena, 52, carer for her mother, 78.** Her mother grants her access to medicines and visits but
  not to messages. She can withdraw it from her own phone at any time.
- **Dr Rao, physician.** She answers portal messages from a pool she shares with her nurse, inside
  a target the hospital sets, and the time she spends is counted. She releases a biopsy result
  after she has spoken to the patient.
- **The billing desk.** It sends an estimate before a planned surgery and the patient accepts it in
  the app; the patient then follows the insurance claim through its stages without phoning.

## (a) What exists today, verified in code

Patient identity is structural, not role-based. `routes/portal.rs` issues a `PatientClaims` JWT
(`sub`, `pid`, `tenant_id`, `exp`; EdDSA, 12 hours) after a phone OTP (10 minutes, 5 attempts,
SHA-256 hashed in `patient_portal_otps`). A patient token has no `role` and a staff token has no
`pid`, so neither decodes as the other (`tests/patient_portal_isolation_test.rs`). Every portal
handler takes the patient from `claims.pid`, never from the path. All `/api/portal/*` data routes
sit behind `portal::require_patient` (`routes/mod.rs` 977–1055). **No portal route checks a
permission code, and `permissions.rs` has no `portal` module.** Entitlements
(`GET /api/portal/entitlements`) are per tenant and return one flag, `companion`.

| Feature | Backend | Web (`apps/web/src/pages/portal/`) | iOS `MedBrainsPatient` | Android `app-patient` |
|---|---|---|---|---|
| OTP sign-in, shared-phone "choose who" | `portal.rs` request-otp, verify | `index.tsx` | `AuthStore` | `AuthStore` |
| Home "what's waiting" | reuses lists | `PortalHome.tsx`, `portal-home.ts` | Hospital tab | Hospital tab |
| Lab results, read-only | `portal_lab_reports`: verified orders only, and held while a critical alert is unacknowledged | `views.tsx` `PortalReports`, deliberately no interpretation | list | list |
| Medicines | `/portal/prescriptions` | `views.tsx` | list | list |
| Refills and delivery choice | `portal_refills.rs` | `portal-refills.tsx`, `portal-refill-choice.tsx` | `RefillsSection` | same |
| Delivery tracking | `portal_deliveries.rs` | `portal-deliveries.tsx` (polls) | `DeliveryViews.swift` | `DeliveryScreens.kt` |
| Pharmacy storefront | `portal_store.rs` | `pages/store/*` | `StoreViews.swift` etc. | `StoreScreens.kt` etc. |
| Bills and pay | `/portal/bills`, `portal_pay.rs` (payment link) | `views.tsx`, `portal-pay.tsx` | list only, **no pay** | list only, **no pay** |
| Appointments, read-only | `/portal/appointments` | `views.tsx` | list | list |
| Teleconsult join link | `portal_tele.rs` | `portal-tele.tsx` | — | — |
| DPDP privacy, consent, export, requests (with nominee) | `portal_privacy.rs` | `portal-privacy.tsx`, `portal-privacy-contact.tsx` | `PrivacyViews.swift` | `PrivacyScreen.kt` |
| Health data (HealthKit / Health Connect), companion-gated | `portal_health.rs` | not used | `HealthDataView.swift` | `HealthDataScreen.kt` |
| Family share | no route (`/api/portal/family-share` does not exist) | — | **stub tiles** | **stub tiles** |

Outside the portal, and reusable:

| Area | What exists | Patient-facing today |
|---|---|---|
| Public booking | `/book/:tenantCode`; `/api/public/appointments/{directory,slots,otp,book}` (`routes/appointments/public.rs`) | yes, but separate from the portal session |
| Staff appointments | `/api/opd/appointments/{id}/{cancel,reschedule,check-in}`, `doctor_schedules`, `scheduling_waitlist` | no |
| Queue | `medbrains-tokens` (`/api/tokens/*`), `/api/public/queue-token/{token}`, `/queue/:token` page, `/api/public/kiosk/checkin`, `/api/opd/queue/wait-estimate`, `/ws/queue/{department_id}` | public status page, not linked from the portal; no remote join |
| Referrals | `referrals` + lifecycle (`medbrains-opd/src/referral_lifecycle.rs`) | no |
| Forms engine | `form_templates`, `form_template_versions` (1087), `medbrains-forms`, `/api/forms/live/{code}`; ANC visit form; PCPNDT Form F | no; no assignment or due-form model yet |
| Lab | `lab_results.flag`, `lab_orders.verified_at`, `lab_critical_alerts` | no per-result release state |
| AI seam | `components/ui/AiLabel.tsx`; per-item accept only in dictation (`ai_suggestion_outcomes`, 1419); LLM gateway `medbrains-server-services/src/llm.rs` | no |
| Maternity | `maternity_registrations`, `anc_visits` (0380), `/api/specialty/maternity/*` | no |
| Estimates and insurance | estimates are print-only from invoices (`print-data/estimate/{invoice_id}`, `package-estimate`), `/api/ipd/admissions/{id}/estimated-cost`; `insurance_claims`, `pre_authorization_requests`, `nhcx_*` | no |
| ABDM | `patient_abha_links`, `abdm_care_contexts`, `abdm_consent_requests`, `abdm_consent_artefacts`, `abdm_received_records`; `/api/abdm/*` | SMS link and scan-and-share only |
| Messaging | `comm_clinical_messages` (clinician to clinician), `family_messages` (one-way updates), `tele_chat_messages`, `notifications`, `device_push_tokens` | no patient-to-care-team channel; no doctor time tracking |
| Guardian | `patients.guardian_name`, `guardian_relation`; consent `guardian_signature_data`; `master_relations` | no proxy access |
| Access log | `patient_record_access_log` (0300), `access_log`; `/api/audit/access-log/patient/{id}` | no |

Native findings that change the plan:

- Both apps are small (about 2.0k lines Swift, 1.7k Kotlin) and match screen for screen.
- **No localisation:** iOS has no string catalog, Android has three strings. Text is inline English.
- **No offline store:** no SwiftData or Room; `MedBrainsOffline` exists but is not used.
- **Modules are hard-coded.** `ModuleGating` in Kit is unused by the patient app; only the Health
  tab is gated, on `companion`.
- **Server is a launch argument.** No QR binding in the patient app. iOS accepts the override in
  any build (Android limits it to debug). This is #5569, and its Phase A plan is #5585, still
  awaiting approval. **The native patient app cannot be released to stores until #5569 lands.**
- Dynamic Type and font scale work through `relativeTo:` and `sp`, but no layout has been tested
  at the largest sizes.

## Foundation F: patient scopes (permissions first)

Every gap below needs one thing the portal does not have: a way to say what *this* session may
do. Today a portal token can do everything a portal route offers. Proxy access (#3) makes that
unsafe, and hospital-level switches (#1, #2, #7) need it too.

**Proposal.** Patient scopes are defined in Rust next to staff permissions, but in their own
module, and are never granted to a staff role.

```rust
/// What a patient, or someone acting for one, may do in the portal and app.
///
/// These are never granted to a staff role. A patient's own session holds every
/// scope the hospital has switched on; a proxy session holds only the scopes in
/// its grant.
pub mod portal {
    /// See test results.
    pub const RESULTS_VIEW: &str = "portal.results.view";
    /// See medicines and ask for refills.
    pub const MEDICINES_MANAGE: &str = "portal.medicines.manage";
    /// Book, move and cancel visits, and join the queue.
    pub const VISITS_MANAGE: &str = "portal.visits.manage";
    /// Read and send messages to the care team.
    pub const MESSAGES_USE: &str = "portal.messages.use";
    /// Fill in forms the hospital has sent.
    pub const FORMS_FILL: &str = "portal.forms.fill";
    /// See bills, estimates and claims, and pay.
    pub const BILLING_MANAGE: &str = "portal.billing.manage";
    /// See the pregnancy record and MCP card.
    pub const MATERNITY_VIEW: &str = "portal.maternity.view";
    /// Link ABHA, fetch records from other hospitals, see who viewed the record.
    pub const ABDM_MANAGE: &str = "portal.abdm.manage";
    /// Give and withdraw family access. Never grantable to a proxy.
    pub const PROXY_MANAGE: &str = "portal.proxy.manage";
    /// Privacy: consent, export, requests. Never grantable to a proxy.
    pub const PRIVACY_MANAGE: &str = "portal.privacy.manage";
}
```

- **Token.** `PatientClaims` gains `act: Option<Uuid>`, the proxy grant id. `pid` stays the
  subject patient. A self session has `act = None`.
- **Check.** One extractor, `PortalScope<const S>`, resolves the effective scopes once per request:
  self = tenant-enabled scopes; proxy = grant scopes ∩ tenant-enabled scopes, read from the grant
  row on every request (complete mediation; a revoked grant fails on the next call, not at token
  expiry). Unknown (database fault) answers 503, never "denied".
- **Entitlements.** `GET /api/portal/entitlements` returns the effective scope list, replacing the
  single `companion` flag (kept as one more entry). Web, iOS and Android gate tabs on it through
  `ModuleGating`, which the patient app then starts using. A hidden module is hidden, not greyed.
- **Hospital switches** are `tenant_settings` keys (`portal.scopes.enabled`), edited on a new tab of
  the existing portal admin settings, guarded by a new staff permission `portal_settings.manage`.
- **Generation.** `scripts/generate_permissions_ts.py` emits them; `make check-role-templates` must
  learn that `portal::*` belongs to no role by design.

Staff-side permissions introduced by the gaps are listed under each gap and follow the normal
order (`permissions.rs`, generate, `access/roles.rs`, guard, gate, prove).

## (b) The eight gaps

Every screen below has the five states from the portal UI plan: loading (skeleton in the shape of
the answer), content, genuinely empty ("You have no … yet."), could not load ("We could not load
… This does not mean you have none." + retry), and not permitted (module absent). Native adds
**offline**: the last good copy with "Saved on <time>; you're offline", writes queued only where
the gap says so. Web UI uses the `@/components/ui` seam; iOS uses system containers and
`MedBrainsUI`; Android uses `MaterialExpressiveTheme` and `:ui`. Targets 44pt / 48dp; body 16px.

### IA change (shared by all gaps)

Six tabs today; eight more features will not fit. Move to a home screen plus five sections:

| Section | Holds | Web | iOS | Android |
|---|---|---|---|---|
| Home | what's waiting, next visit, live token | top of page | `TabView` tab 1 | `NavigationSuiteScaffold` item 1 |
| Visits | book, upcoming, queue, teleconsult, forms due | tab | tab | item |
| Records | results, medicines, pregnancy, records from other hospitals | tab | tab | item |
| Messages | threads | tab | tab | item |
| Billing | bills, estimates, insurance, claims | tab | tab | item |
| Account (menu) | family, ABHA, who viewed, privacy, language, text size | header menu | toolbar | top bar |

A proxy session shows a persistent banner: "You are viewing Arjun's record as his parent." with a
"Switch person" control. This is the one structural refactor in the plan; it removes the
hard-coded module list on both native apps.

---

### Gap 1. Secure messaging with the care team

**Permissions.** Patient: `portal.messages.use`. Staff (new, in `permissions.rs`):
`portal_messages.inbox.view` (see the pool's threads), `portal_messages.reply`,
`portal_messages.pools.manage` (pools, members, hours, targets), `portal_messages.reports.view`
(response times and doctor time, no message text). Granted to `doctor`, `nurse` (view, reply);
`scheduling_admin` and `medical_superintendent` (pools, reports).

**Endpoints.** New: `GET/POST /api/portal/messages/threads`, `GET /api/portal/messages/threads/{id}`,
`POST /api/portal/messages/threads/{id}/messages`, `GET /api/portal/messages/pools` (who the
patient may write to: pools tied to doctors they have seen in the last N months).
Staff: `GET /api/portal-messages/inbox`, `POST /api/portal-messages/threads/{id}/{reply,assign,close,convert-to-visit}`,
`GET/PUT /api/portal-messages/pools`, `GET /api/portal-messages/reports`.
Reused: `medbrains-notifications` dispatch and `device_push_tokens` for "you have a reply" (the
push carries no clinical text); `audit_log`.
Not reused: `comm_clinical_messages` (clinician to clinician, nullable patient) and
`family_messages` (one-way, free-text contact). Widening either mixes populations.

**Schema.**

```sql
portal_message_pools (id, tenant_id, name, department_id, member_user_ids uuid[],
  hours jsonb, response_target_hours int CHECK (BETWEEN 1 AND 168), is_active, ...usual columns)
portal_message_threads (id, tenant_id, patient_id, pool_id, topic text CHECK (in list),
  opened_by_grant uuid NULL, status text CHECK (open|answered|closed),
  due_at timestamptz, first_reply_at, assigned_to uuid, closed_at, ...)
portal_messages (id, tenant_id, thread_id, author_kind text CHECK (patient|proxy|staff),
  author_id uuid, body text CHECK (length <= 4000), attachment_id uuid NULL, created_at, read_at)
portal_message_work (id, tenant_id, thread_id, user_id, started_at, ended_at)  -- doctor time
```

`due_at` is computed in Rust from the pool's hours and target, so the clock starts at the next
opening time. Doctor time is open-to-reply intervals from the staff client, capped at 30 minutes
each so a forgotten tab does not count. Messages are part of the clinical record: the thread is
listed on the patient's case-sheet timeline.

**UI.**
- Web patient: Messages section; thread list (topic, pool, status badge with words); thread view;
  composer with topic `Select`, 4,000-character `Textarea` with counter, one attachment. A fixed
  `Alert` above every composer: "Not for emergencies. Call 108 or <hospital number>." Out of hours,
  a second line: "The team reads messages from 9:00 tomorrow."
- iOS: `NavigationSplitView` list and detail; composer as a sheet; draft kept in SwiftData offline,
  sent on reconnect only after the patient taps Send again (no silent background send of clinical
  text). Android: same with `ListDetailPaneScaffold`, Room.
- Web staff: a "Patient messages" worklist in OPD, sorted by `due_at`, overdue in words and colour;
  reply, assign, close, "Book a visit instead". Native staff (doctor module): inbox and reply only.
- Denied: a proxy without the scope sees no Messages section. A staff user without
  `portal_messages.inbox.view` never issues the inbox query.

**Scenarios.**
- Given Asha has seen Dr Rao in the last 6 months, When she writes about a rash at 14:00 on a
  weekday, Then the thread goes to Dr Rao's pool with `due_at` 2 working days later and Asha sees
  "Your care team usually replies within 2 working days".
- Given it is 23:30 on Saturday, When Asha sends, Then she sees the out-of-hours line and the
  emergency number, and `due_at` starts at Monday 09:00.
- Given a thread passes `due_at` unanswered, When the hourly job runs, Then the pool lead is
  notified and the thread shows "Overdue" on the worklist.
- Given Meena's grant does not include messages, When she opens the app for her mother, Then there
  is no Messages section and `GET /portal/messages/threads` answers 403.
- Given Dr Rao replies, Then a push reads "You have a reply from your care team" with no text, and
  `portal_message_work` holds her time.
- Given a message asks for a new prescription, When Dr Rao chooses "Book a visit instead", Then
  the thread closes with a booking link, since a prescription needs a consultation record.

**Regulatory.** Telemedicine Practice Guidelines 2020 classify text messaging as asynchronous
teleconsultation: the RMP is identified on every reply, replies are recorded, and messaging is not
for emergencies. Replies are clinical records under NMC retention. DPDP: the purpose is treatment.
The banner and response target limit liability for unread messages; both are hospital settings.
Charging for messages (e-visits) is an owner decision.

**Dependencies.** Foundation F; staff OPD worklist; push on native.

---

### Gap 2. Self-booking, reschedule, remote queue, live token

**Permissions.** Patient: `portal.visits.manage`. Staff: none new; booking rules are edited under
the existing `opd.schedule.manage`.

**Endpoints.** New portal wrappers that call the same service functions as public booking, so
there is one booking rule set: `GET /api/portal/booking/doctors`, `GET /api/portal/booking/slots`,
`POST /api/portal/appointments`, `POST /api/portal/appointments/{id}/reschedule`,
`POST /api/portal/appointments/{id}/cancel`, `POST /api/portal/appointments/{id}/check-in`,
`GET /api/portal/queue/current`.
Reused: `public_available_slots`, `public_bookable_doctors`, `public_book_appointment` logic
(minus the OTP, since the session is already verified); staff `reschedule`/`cancel` service code;
`kiosk_checkin` logic for remote check-in, which issues a token through `medbrains-tokens`;
`public_token_status` and `/api/opd/queue/wait-estimate` for the live view. The `/queue/:token`
page becomes the web live view.

**Schema.** None new. `tenant_settings` keys: `booking.horizon_days`, `booking.cancel_cutoff_hours`,
`booking.max_open_per_patient`, `queue.remote_checkin_window_minutes`. Online-created bookings
already carry their creator (migration 1028).

**UI.**
- Home: next visit card with "Check in" inside the window, then a live token card: number in
  display type, "5 people ahead, about 20 minutes", room name. Live updates poll every 20 s with
  ETag while visible (cheap on data; no socket held on a cheap phone), stop when hidden.
- Visits: "Book a visit" → doctor search (`Select` with search; doctor, department, language,
  next free day) → day picker → slot `Chip` group → confirm. Reschedule and cancel on the visit row.
- iOS/Android: same flow; live token as a Live Activity (iOS) and an ongoing notification
  (Android) once checked in, removed when served.
- Offline: booking is online-only and says so; the token card shows the last number with its time.

**Scenarios.**
- Given Dr Rao has a free 10:30 slot tomorrow, When Ravi books it for Arjun, Then the appointment
  is created with Arjun as patient and Ravi's grant as creator, and both see it.
- Given the slot was taken a second earlier, Then booking answers 409 and the app offers the next
  three slots.
- Given cancel cutoff is 4 hours and the visit is in 2, Then Cancel is replaced by "Call the
  hospital to cancel".
- Given the check-in window is 30 minutes, When Asha taps Check in 90 minutes early, Then she sees
  "You can check in from 10:00".
- Given Asha is checked in, When the doctor calls her token, Then her phone shows "Go to Room 4
  now" within one poll interval.
- Given the queue service is down, Then the card says "We can't reach the queue. Your place is
  kept." never "No token".

**Regulatory.** IPSG 1: the booking carries two identifiers (name and UHID or date of birth), and a
proxy booking records who booked. Consumer Protection Act: cancellation rules are shown before
confirming.

**Dependencies.** Foundation F; queue unification (`tokens`) for a single token per visit.

---

### Gap 3. Family (proxy) access

**Permissions.** Patient: `portal.proxy.manage` (adult subjects only; never in a proxy grant).
Staff (new): `portal_proxy.verify` (record a parent or legal-authority grant after checking
documents), `portal_proxy.revoke`, `portal_proxy.list`. Granted to `front_office_staff` and `receptionist` (verify,
list), `mrd_officer` (all).

**Endpoints.** New: `GET /api/portal/proxy/grants` (given and held), `POST /api/portal/proxy/grants`
(adult patient grants a carer by phone), `POST /api/portal/proxy/grants/{id}/revoke`,
`POST /api/portal/session/switch` (re-issue token with another `pid` and `act`).
Staff: `POST /api/patients/{id}/portal-proxies`, `GET .../portal-proxies`,
`POST /api/portal-proxies/{id}/revoke`.
Reused: OTP verify already returns a `choose` list for shared phones; it gains the grants held by
that phone. `patients.guardian_*` pre-fills the staff form.

**Schema.**

```sql
portal_proxy_grants (id, tenant_id, subject_patient_id, proxy_phone_hash, proxy_name,
  relation_id REFERENCES master_relations, basis text CHECK
  (parent_of_minor|patient_consent|legal_guardian|mhca_nominated_representative),
  scopes text[] CHECK (scopes <@ ARRAY[...] AND NOT 'portal.proxy.manage' = ANY(scopes)),
  evidence_document_id uuid, granted_by_kind text CHECK (patient|staff), granted_by uuid,
  starts_at, ends_at, revoked_at, revoked_by, revoke_reason, ...)
```

`ends_at` for `parent_of_minor` is set to the child's 18th birthday and cannot be later.
Sensitive categories (sexual and reproductive health, mental health, HIV, MTP) are withheld from
parent grants from an age the owner sets, through field data classes, not per screen.

**UI.**
- Account → Family: "People who can see your record" (grants given: name, relation, what they see
  as plain words, until when, "Withdraw") and "People you can look after" (grants held).
- Give access: phone, relation, checklist of what they may see and do (`Checkbox` per scope, none
  pre-ticked), end date. The carer gets an SMS and signs in with their own OTP.
- Staff: on the patient page, a "Portal access" panel to add a parent or guardian with the evidence
  upload, and to revoke.
- Native stubs in `PatientHomeView` / `PatientHome.kt` are replaced, not added beside.

**Scenarios.**
- Given Ravi is recorded by the front desk as Arjun's parent, When Ravi signs in, Then he chooses
  "Arjun (son)" and sees Arjun's results and visits with the proxy banner.
- Given Arjun turns 18 today, When Ravi opens the app, Then Arjun is gone from his list and he sees
  "Arjun is now an adult and manages his own record."
- Given Meena's mother withdraws Meena's access, When Meena's next request arrives (token still
  valid), Then it answers 401 with "This access has ended" and the app returns to Meena's own home.
- Given a 15-year-old's record has a sexual-health visit, When her parent views visits, Then that
  visit is absent, with no gap a parent could infer.
- Given a carer grant lacks results, Then the Records section shows medicines only and
  `GET /portal/lab-reports` answers 403.
- Given a proxy tries to create another grant, Then it is refused: `portal.proxy.manage` is never in
  a grant.

**Regulatory.** DPDP Act 2023 s.9: a child's data needs verifiable parental consent; the staff
verification is that check. DPDP Rules 2025 set how; confirm the commencement of each rule at build
time. Mental Healthcare Act 2017: a nominated representative has defined rights, and mental-health
information is confidential (s.23). HIV and AIDS Act 2017 and MTP Act s.5A: confidentiality,
including from family. Every proxy action is audited with both people.

**Dependencies.** Foundation F; field data classes for sensitive categories.

---

### Gap 4. Pre-visit forms on the phone

**Permissions.** Patient: `portal.forms.fill`. Staff: the forms stream defines assignment
permissions; this gap adds none.

**Endpoints.** New: `GET /api/portal/forms` (due), `GET /api/portal/forms/{assignment_id}`,
`PUT /api/portal/forms/{assignment_id}/draft`, `POST /api/portal/forms/{assignment_id}/submit`.
Reused: the published version from `form_template_versions` and server-side validation in
`medbrains-core/src/form_template.rs`; the assignment and response model from the forms stream.

**Schema.** None in the portal. The forms stream owns assignments (due, overdue, done) and
responses. Patient answers land as **patient-reported, unverified** values; the clinician accepts
them into the record per item, and pre-fill carries them forward.

**UI.** Visits → "Forms to fill before your visit" with a due date; one question per screen on
phones, large `Radio` and `Checkbox` targets, progress "3 of 12", save as you go. Native fills
offline into SwiftData / Room and submits on reconnect after the patient confirms. Staff see the
answers on the visit with "From the patient" and accept or correct each.

**Scenarios.**
- Given a new-patient history form is assigned to Asha's visit, When she submits it the night
  before, Then the doctor's visit opens with her answers marked "From the patient, not yet checked".
- Given Asha fills it offline on the bus, When she is back online and taps Send, Then it submits
  once (idempotency key) and shows "Sent".
- Given the hospital publishes a new version after Asha started, Then her draft finishes on the
  version she started.
- Given the visit is cancelled, Then the assignment closes and the form leaves her list.

**Regulatory.** Patient-entered data is labelled as such in the record (NABH documentation
standards). Coded fields keep LOINC / SNOMED codes from the template.

**Dependencies.** The forms stream's assignment model and the standard forms library
(`memory/project_standard_forms_library.md`). Not buildable before them.

---

### Gap 5. Results in plain language, abnormal results held

**Permissions.** Patient: `portal.results.view`. Staff (new): `lab.results.release_to_patient`
(release a held result, write a note to the patient), `portal_results.rules.manage` (which tests
are held, and for how long). Granted to `doctor` (release) and `medical_superintendent`
(rules).

**Endpoints.** Changed: `GET /api/portal/lab-reports` adds the release condition and returns
`explanation` and `doctor_note`. New staff: `GET /api/lab/results/awaiting-release`,
`POST /api/lab/orders/{id}/release-to-patient`, `GET/PUT /api/portal-results/rules`.

**Schema.**

```sql
ALTER TABLE lab_orders ADD COLUMN patient_released_at timestamptz,
  ADD COLUMN patient_released_by uuid, ADD COLUMN patient_note text;
result_release_rules (id, tenant_id, test_id NULL, category text NULL,
  hold_when text CHECK (always|abnormal|critical), auto_release_after_days int NULL, ...)
```

The current two holds (unverified; unacknowledged critical alert) stay. A result is shown when
verified, no open critical alert, and (no rule holds it, or it is released, or the auto-release
time has passed).

**Plain language, in two tiers.**
1. **No AI, shipped first:** a reviewed content library per LOINC analyte ("what this test
   measures", "what high and low can mean", "what to do next"), written by clinicians, translated
   by people, versioned. It is cheap, works offline, and needs no model call.
2. **AI summary, later, through the strict seam only:** a draft written for the result set is
   shown to the releasing doctor in the AI draft card; it reaches the patient only if she accepts
   it (edit tracked). The patient sees it with `AiLabel`: "Written with AI and checked by Dr Rao".
   Nothing is generated on the patient's request.

**UI.** Results show value, range and a flag in words and an icon ("Higher than the normal range").
A held result appears as "Your doctor will go through this result with you", with the expected
date when a rule sets one, never as absence. Staff get an "Results to share with patients"
worklist in the doctor inbox, web and native doctor module.

**Scenarios.**
- Given histopathology is held always, When the report is verified, Then Asha sees "Your doctor
  will go through this result with you" and the doctor's worklist shows it.
- Given Dr Rao releases it with a note, Then Asha sees the result, the note, and the library
  explanation.
- Given a potassium of 7.2 has an unacknowledged critical alert, Then nothing appears until the
  alert is acknowledged, as today.
- Given an AI summary was drafted and Dr Rao rejects it, Then the patient sees only the result,
  the library text and the note; the rejection is recorded in `ai_suggestion_outcomes`.
- Given the auto-release time passes with no action, Then the result shows with "Your doctor has
  not reviewed this yet" and the doctor is told.

**Regulatory.** ICMR ethical guidelines for AI in healthcare (2023): human oversight and labelling.
The strict AI seam rule applies in full. Critical-value communication stays a phone call (NABL).
Whether to auto-release, and after how long, is a hospital policy; the default is owner-set.

**Dependencies.** Foundation F; AI seam per-item accept generalised beyond dictation (tier 2).

---

### Gap 6. Pregnancy journey and digital MCP card

**Permissions.** Patient: `portal.maternity.view`. Staff: existing `specialty.maternity.*`. New
public verification needs no permission and returns no clinical data.

**Endpoints.** New: `GET /api/portal/episodes`, `GET /api/portal/episodes/{id}/timeline`,
`GET /api/portal/episodes/{id}/mcp-card` (data), `GET /api/portal/episodes/{id}/mcp-card.pdf`,
`GET /api/public/verify/{token}`. Reused: `maternity_registrations`, `anc_visits`, the forms
stream's MCP-card template and its print layout, the signing approach in the forms plan.

**Schema.** None new for the timeline. The QR carries a compact JWS signed by the hospital
(`typ` `mcp-card+jws`): hospital, card id, version, signer role and registration number, signed-at;
**no clinical data**. Verification works offline against the hospital public key.

**UI.** Records → "Your pregnancy": week of pregnancy and EDD at the top, next visit and next due
test, then a timeline of visits, scans, tests, vaccinations (TT/Td), and forms. "Your MCP card"
shows the card in the familiar government layout, with Download and Show QR. Native caches the
card for offline use.

**Scenarios.**
- Given Asha is registered at 10 weeks, Then she sees week 10, her EDD, and "Next: visit at 14
  weeks".
- Given a scan report exists, Then the timeline shows it **without fetal sex**, on every surface.
- Given the district hospital scans her QR offline, Then it shows "Genuine. Signed by ANM,
  <registration>, <hospital>, <date>", and seeing the content needs ABDM consent or a login.
- Given the card was updated after printing, Then scanning the old QR shows "A newer version
  exists".
- Given the pregnancy ends in loss, Then the journey stops, reminders stop at once, and the screen
  is worded with care (wording signed off clinically).

**Regulatory.** PCPNDT Act: fetal sex is never shown or inferable. MCP card follows the MoHFW
format. RCH portal reporting stays staff-side. IT Act 2000 for the electronic signature.

**Dependencies.** Forms stream (MCP template, episode model, signing); ABDM for cross-facility
content.

---

### Gap 7. Cost estimate, insurance and claim status

**Permissions.** Patient: `portal.billing.manage`. Staff (new): `billing.estimates.create`,
`billing.estimates.list`, `billing.estimates.share` (send to the portal). Granted to `billing_clerk`
and `insurance_officer`.

**Endpoints.** New: `GET /api/portal/estimates`, `POST /api/portal/estimates/{id}/accept`,
`GET /api/portal/insurance`, `GET /api/portal/claims`. Staff: `POST /api/billing/estimates`,
`POST /api/billing/estimates/{id}/share`. Reused: tariff and `tpa_rate_cards` pricing,
`/api/ipd/admissions/{id}/estimated-cost`, the estimate print layout, `patient_insurances`,
`insurance_claims` and `nhcx_*` status, mapped to plain stages (submitted, query from insurer,
approved, settled, rejected with reason).

**Schema.** Estimates are print-only today, built from invoices. Check at build whether invoices
carry a proforma status; if so, reuse it. If not:

```sql
cost_estimates (id, tenant_id, patient_id, title, lines jsonb, total numeric,
  payer_share numeric NULL, patient_share numeric, valid_until date,
  status text CHECK (draft|shared|accepted|expired), shared_at, accepted_at,
  accepted_by_grant uuid NULL, ...)
```

**UI.** Billing → Estimates: total, "Your share", "Insurance share", valid until, line list,
"Accept estimate". Insurance: policies on file. Claims: a stage list with dates and the next step
in words. Offline: last copy with its time; accept is online-only.

**Scenarios.**
- Given the desk shares a ₹1,20,000 estimate with ₹30,000 patient share, When Asha accepts, Then
  the estimate is accepted, and the desk sees who accepted and when.
- Given the estimate expired, Then Accept is replaced by "Ask the billing desk for a new estimate".
- Given the insurer raised a query, Then the claim shows "Your insurer asked a question. The
  hospital is answering it." with the date.
- Given NHCX status cannot be read, Then the claim shows "We can't get the latest status" with the
  last known stage, never "No claims".

**Regulatory.** Clinical Establishments (Central Government) Rules 2012: display of rates. IRDAI
Health Insurance Master Circular 2024: cashless pre-authorisation and discharge timelines, which
the claim view can show. Consumer Protection Act 2019: an estimate states what is not included.
GST shown per line where applicable.

**Dependencies.** Foundation F; the NHCX transport fixes in the ABDM conformance work.

---

### Gap 8. ABHA, records from other hospitals, and who viewed

**Permissions.** Patient: `portal.abdm.manage`. Staff: existing `abdm.*`.

**Endpoints.** New: `GET /api/portal/abha`, `POST /api/portal/abha/link/{start,verify}`,
`POST /api/portal/abdm/fetch-requests` (patient-initiated HIU consent request, purpose
patient-requested), `GET /api/portal/abdm/requests`, `GET /api/portal/abdm/records`,
`GET /api/portal/access-log`. Reused: the ABHA service code behind `/api/abdm/abha/*`,
`abdm_consent_requests`, `abdm_consent_artefacts`, `abdm_received_records`, `abdm_care_contexts`,
and `patient_record_access_log` plus `access_log` for the log.

**Schema.** None new. The access log is a read model over existing tables: internal views (by role
and department), and external access (ABDM consent artefacts and health transfers: which hospital,
what, when).

**UI.** Account → ABHA: linked address or "Link your ABHA" (OTP flow). Records → "From other
hospitals": "Fetch my records", which tells the patient to approve the request in their ABHA app,
then shows the status and the received documents. Account → "Who has seen your record": a list by
date, "Doctor, General Medicine, viewed results", "Apollo Hospital fetched your discharge summary
(you approved on 2 March)".

**Scenarios.**
- Given Asha links her ABHA, Then her visits here are linked as care contexts and the app says so.
- Given she asks to fetch records, When she approves in the ABHA app, Then received documents appear
  under "From other hospitals" with their source.
- Given she denies or the request expires, Then the status says so, and nothing is fetched.
- Given a staff member opened her chart, Then the access log shows the role and department and time.
- Given a break-glass access happened, Then it is shown, marked "Emergency access".

**Regulatory.** ABDM Health Data Management Policy and consent artefacts: consent is granted in the
consent manager (ABHA app), not in our UI; we show it. DPDP s.11: the right to a summary of
processing and of other fiduciaries the data was shared with. Showing staff names is an owner
decision.

**Dependencies.** ABDM conformance fixes (the ABHA V3 gap: OAEP encryption, the token kept off the
browser) and sandbox credentials; Foundation F.

## Impact check across surfaces

| Change | Web | iOS | Android | Staff web | Staff native |
|---|---|---|---|---|---|
| F scopes + IA | `portal/index.tsx`, `PortalHome.tsx`, `portal.service.ts`, `packages/api` | `PatientHomeView.swift`, adopt `ModuleGating` | `PatientHome.kt`, adopt `ModuleGating` | portal settings tab | — |
| Localisation + offline cache (for every gap) | i18n namespaces exist | add String Catalog, SwiftData cache | add `values-*`, Room cache | — | — |
| 1 messaging | Messages section | Messages tab | Messages item | OPD worklist | doctor inbox |
| 2 booking + token | Visits, Home, `/queue/:token` | Visits, Live Activity | Visits, ongoing notification | — | — |
| 3 proxy | Account → Family, banner | replace stub | replace stub | patient page panel | — |
| 4 forms | Visits → forms | form renderer (Kit `forms`) | form renderer (`:kit`) | visit review | — |
| 5 results | Records → results | same | same | release worklist, rules page | doctor module |
| 6 pregnancy | Records → pregnancy | same, offline card | same, offline card | — | — |
| 7 billing | Billing | Billing (adds pay link too) | same | estimate share | — |
| 8 ABDM | Account, Records | same | same | — | — |

Every row updates `medbrains/docs/NATIVE-PARITY.md`, adds XCUITest and Compose journeys to
`PatientJourneyTests.swift` / `PatientJourneyTest.kt`, and a Playwright journey per role (patient,
proxy, doctor, desk). Each feature ships its user-guide page under
`medbrains/apps/docs/docs/user-guides/` in the STYLE.md voice once #5599 merges.

## (c) Build order

| Release | Contents | Why here |
|---|---|---|
| **3.34.0 (2027-02-09), first slice** | **F scopes + IA + #2 self-booking and live token**, web, iOS and Android; String Catalog / `values-*` scaffolding with English and one Indian language; last-good cache for Home and Visits | Highest reuse (booking, tokens, wait estimate all exist), lowest clinical liability, and F unblocks every other gap. Native ships to stores only if #5569 Phase A lands in 3.34.0; otherwise it stays in internal testing. |
| 3.35.0 | #3 proxy; #5 tier 1 (release rules, held state, plain-language library); #8 access log | Proxy needs F. Held results are safety. Access log is a read model. |
| 3.36.0 | #1 messaging (patient, staff web, native doctor inbox); #7 estimates, insurance, claims | Messaging needs pools, rotas and targets set up by hospitals. Claims need NHCX fixes. |
| 3.37.0 | #4 pre-visit forms; #6 pregnancy and MCP card; #5 tier 2 AI summaries; #8 ABHA link and fetch | Forms stream, signing and ABDM conformance must land first. |

## (d) Where we go further than MyChart

- **Across hospitals, not across one vendor.** MyChart joins records between Epic organisations.
  ABHA and national exchanges join any hospital, and the country-exchange layer extends this beyond
  India.
- **Who viewed, including other hospitals.** Internal and external access in one list.
- **Light and offline.** Last-good copies on the phone, polling with ETag instead of held sockets,
  no clinical text in pushes, booking and forms that say clearly what needs a connection.
- **The patient's language, large text, WCAG 2.2.** A reviewed, human-translated result library
  instead of machine text; layouts tested at the largest text sizes on all three surfaces.
- **Paper that verifies itself.** The MCP card QR proves authenticity offline and carries no data.
- **Held results that say so.** The patient sees that a result exists and when the doctor expects
  to speak to them, instead of an unexplained gap.
- **Proxy access that ends on time.** Parental access stops at 18; adolescent sensitive care is
  withheld by data class; carers are granted by the patient, scope by scope.
- **Price before treatment.** Estimates accepted in the app and claims tracked in plain stages.
- **Doctor time counted.** Messaging workload is measured, so hospitals can staff it or bill it.

## Decisions for the owner

1. **Patient scopes** live in Rust as `portal::*`, never in a staff role; tokens carry the proxy
   grant id and are re-checked per request (Foundation F).
2. **Result release policy:** default hold rules, auto-release or never, and after how many days.
3. **AI summaries** reach patients only after a doctor accepts them (recommended), or not at all.
4. **Messaging:** default response target, who staffs pools, and whether messages are billable.
5. **Proxy:** the age from which adolescent sensitive care is withheld from parents, and whether a
   patient may grant a carer in-app without staff verification.
6. **Access log:** show staff names, or role and department only.
7. **Booking:** cancellation cutoff, remote check-in window, and whether check-in needs location.
8. **Native release:** whether native features ship in 3.34.0 depends on approving #5585 (#5569
   Phase A) for the same release.
9. **IA change** to five sections plus Account on all three surfaces.
10. **Estimates:** indicative or binding wording; reuse invoices or a `cost_estimates` table.
