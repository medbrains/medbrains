# Camp Mode Screen and Field Contract

**Purpose:** lock the Camp app workflow before implementation. Remote camps are temporary care
sites, so screens must support care delivery, patient safety, NABH evidence, offline survival, and
post-camp reconciliation. This contract is intentionally stricter than the current
`apps/mobile-camp/src/modules/camp.tsx` preview screen.

## Boundaries

Camp Mode owns:

- Camp profile and field readiness.
- Camp intake registration.
- Screening, vitals, findings, advice, and referral decision.
- Lab sample collection and barcode capture.
- Camp referral, incident, checklist, supply, and sync evidence.
- Read-only linked patient history required for camp care.

Patient Registration owns:

- UHID/MPI duplicate search.
- ABHA and identifiers.
- Full patient master demographics.
- Consent registry beyond camp operational consent.
- Merge history and patient profile corrections.

Camp creates a camp intake record first. UHID creation/linking happens online after sync through the
Patient Registration workflow.

## Product Principle

Camp Mode is a smaller hospital workflow for rural and remote settings. It is not just a camp
registration app.

The camp is the operating context; the patient is the center. The app must support a compact
field-hospital flow:

1. Registration.
2. Triage and vitals.
3. Doctor screening/consultation.
4. Lab sample collection.
5. Medicine/counselling when enabled.
6. Referral/follow-up.
7. Quality, incident, supplies, and NABH evidence.
8. Local and official reporting.

The packet must include a permissioned **care capsule** for each assigned or linked patient. This is
not a full hospital dump. It is the minimum safe patient slice needed for care in the field.

| Domain | Camp app role | Offline mode |
|---|---|---|
| Patient identity | Search, confirm two identifiers, show UHID if linked | Read/write camp intake; patient master linking online |
| OPD history | Recent visits, diagnosis summary, prescriptions, advice | Read-only |
| Vitals and screening | Record current camp vitals and view recent vitals | Write camp screening; read prior vitals |
| Allergies and risk flags | Prevent unsafe decisions | Read-only, prominent warnings |
| Lab | Collect sample, scan barcode, view selected recent reports | Write sample; read selected history |
| Radiology/DICOM | Show report/imaging availability and key impression | Read-only metadata; no bulk image cache by default |
| Pharmacy | View active medicines and allergy/schedule warnings | Read-only for launch; controlled dispensing online-required |
| Referrals | Create transfer/follow-up referral with urgency and facility | Write referral |
| Quality and incidents | Capture near miss, privacy, IPC/BMW, equipment, crowd incidents | Write incident |
| Supplies/logistics | Track packed, consumed, returned, shortages | Write supply updates |
| Management reporting | Footfall, screened, referred, samples, incidents, sync health | Local dashboard + server reports after sync |
| Continuous improvement | Closure review, corrective actions, future camp planning | Online-heavy; packet includes field evidence |

## Screen Map

| Screen | Surface | Purpose | Source tables / API | Offline behavior |
|---|---|---|---|---|
| Command Center - Camp Setup | Web | Plan camp, site, team, modules, packet scope | `camps`, `camp_team_members`, `/api/camp/camps` | Online only |
| Command Center - Remote Readiness | Web | NABH mapped site readiness, supplies, incidents | `camp_remote_setups`, `camp_remote_checklist_items`, `camp_supply_items`, `camp_incidents` | Online setup, included in packet |
| Command Center - Packet Audit | Web | Preview/download packet and audit counts | `GET /api/camp/camps/{id}/packet`, `audit_log` | Online only |
| Login / Device Health | Mobile | Authenticate and show device/API/local DB readiness | auth, local device record | Must work before field departure |
| Camp Selector | Mobile | Select assigned camp and packet state | local packet index + `listCamps` online | Show downloaded camps offline |
| Packet Download | Mobile | Download segmented packet with progress and integrity | `GET /api/camp/camps/{id}/packet` | Store encrypted locally |
| Field Dashboard | Mobile | One-screen operational status | local DB + outbox | Fully offline |
| Patient Search | Mobile | Find packet patients and walk-ins quickly | local FTS/index | Fully offline |
| Patient Chart | Mobile | Read linked history and current camp record | local DB | Fully offline |
| Walk-in Intake | Mobile | Register camp attendee | `camp.registration.create` | Queue locally |
| Screening / Vitals | Mobile | Record clinical screening and vitals | `camp.screening.create` | Queue locally |
| Lab Sample | Mobile | Capture sample + barcode | `camp.lab_sample.create` | Queue locally |
| Referral | Mobile | Transfer/follow-up decision | `camp.referral.create` | Queue locally |
| Incident / Near Miss | Mobile | Patient safety, IPC/BMW, privacy, network, crowd incidents | `camp.incident.create` | Queue locally |
| Checklist / Supplies | Mobile | Update readiness and consumed/returned quantities | `camp.checklist.update`, `camp.supply.update` | Queue locally |
| Sync Center | Mobile | Show pending, applied, duplicate, failed, retry | `camp_sync_events`, local outbox | Fully offline with retry |
| Wipe / Expiry | Mobile | Logout, revoke, expired packet wipe | local key + packet metadata | Must wipe local key |
| Reports Dashboard | Mobile | Field summary for camp lead | local aggregates | Fully offline |
| Post-Camp Review | Web | Convert patients, close referrals, review incidents, audit sync | camp + patient + OPD + lab + quality | Online |

## Care Capsule Contents

Each packet patient should be represented by a normalized local care capsule:

| Section | Fields | Reason |
|---|---|---|
| Identity | patient_id, UHID, display name, age/DOB, gender, masked phone, village/address, blood group | Search and two-identifier confirmation |
| Risk flags | active allergies, no-known-allergy flag, VIP, MLC, pregnancy/high-risk if available | Patient safety |
| Recent vitals | last 3 vitals rows with BP, pulse, SpO2, temp, weight, BMI, recorded time | Clinical continuity |
| OPD visits | last 5 encounters with department, doctor, visit date, notes, diagnosis summary, prescription summary | Doctor context |
| Diagnoses | recent ICD/SNOMED-capable diagnosis rows | Decision support and reporting |
| Medicines | active/recent medicines, dosage, frequency, route, status, prescribed date | Avoid duplicate/unsafe prescribing |
| Lab history | selected recent lab results, especially critical/chronic disease tests | Diabetes, renal, anemia, infection screening |
| Radiology | study/report metadata, modality, body part, impression, report status, viewer link if online | Doctor knows imaging exists without caching heavy files |
| Camp history | past camp registrations and referrals | Follow-up continuity |
| Current camp | registration, screening, sample, referral, outbox status | Field workflow |

Heavy assets such as DICOM images should not be bundled by default. The packet should include
metadata and report/impression. Image thumbnails or selected key images can be a separate explicit
download when the camp type requires it and storage policy permits it.

## Management and Improvement Screens

### Field Dashboard

Show:

- Expected footfall vs registered.
- Screened count.
- Not screened count.
- Referred count by urgency.
- Lab samples collected and pending barcode.
- Incidents by severity.
- Supply shortages.
- Pending outbox count.
- Last sync time.
- Packet expiry.
- Readiness score.

Algorithms:

- Maintain local aggregate counters incrementally when outbox events are created.
- Recompute from normalized tables on app launch as a correctness check.
- Use O(1) maps for per-status counters instead of scanning the full roster on every render.

### Reports Dashboard

Reports must work offline for camp lead review:

- Footfall by hour.
- Age/gender split.
- Village/pincode split.
- Chief complaint top list.
- High BP / high sugar / low SpO2 counts.
- Referral list by urgency and facility.
- Lab sample list by sample type and barcode missing.
- Incidents and near misses.
- Supply consumption and shortages.
- Sync health: pending/applied/failed/duplicate.

After sync, server reports become official. Mobile reports are operational and marked as local until
synced.

### Post-Camp Review

Online web workflow after camp:

1. Reconcile synced registrations.
2. Run MPI duplicate search.
3. Create/link UHIDs where required.
4. Convert relevant cases to OPD follow-up.
5. Close/refine referrals.
6. Link lab samples to lab orders/results.
7. Review incidents and corrective actions.
8. Reconcile supplies and BMW handoff.
9. Export audit and camp report.
10. Mark improvement actions for the next camp.

## Web Command Center Fields

### Camp Setup

| Field | Required | Notes |
|---|---:|---|
| Camp name | Yes | Human-readable camp title |
| Camp type | Yes | `general_health`, `eye_screening`, `dental`, `blood_donation`, `vaccination`, `specialized` |
| Scheduled date, start time, end time | Yes | Defines packet expiry window |
| Venue name, address, village/city, state, pincode | Yes | Must be visible in mobile packet |
| GPS latitude/longitude | Optional | Useful for remote site verification |
| Organizing department | Yes | Drives staffing and reporting |
| Coordinator | Yes | Named operational owner |
| Expected participants | Yes | Used for supply planning |
| Allowed workflows | Yes | Intake, screening, lab sample, referral, incident, supplies |
| Is free camp / discount | Yes | Billing is online-only for launch |
| Logistics notes | Optional | Field instructions |
| Equipment list | Optional | Structured JSON, visible in packet |

### Remote Setup

| Field | Required | Notes |
|---|---:|---|
| Village, block, district, landmark | Yes | Operational location |
| Site contact name/phone | Yes | Local owner |
| Local authority name/phone | Recommended | Permission and coordination |
| Referral facility name/phone | Yes | Continuity of care |
| Ambulance contact name/phone | Yes for remote camps | Emergency transfer |
| Emergency route notes | Yes | Route and pickup point |
| Network plan | Yes | Online, weak network, or paper fallback |
| Power plan | Yes | Charging, generator, power bank |
| Water/sanitation plan | Yes | NABH/FMS/HIC evidence |
| Privacy plan | Yes | Patient rights and examination privacy |
| Crowd-control plan | Yes | Queue and safety flow |
| Biomedical waste plan | Yes | Colour-coded bags/bins and sharps handling |
| Infection-control plan | Yes | Hand hygiene, PPE, disinfection, needle-stick response |
| Status | Yes | `draft`, `ready`, `blocked`, `closed` |

### Supplies

| Field | Required | Notes |
|---|---:|---|
| Category | Yes | `equipment`, `consumable`, `medicine`, `ppe`, `biomedical_waste`, `document`, `it`, `other` |
| Item name | Yes | Searchable |
| Unit | Recommended | `nos`, `pcs`, `sets`, `pairs`, etc. |
| Planned quantity | Yes | Before departure |
| Packed quantity | Yes | Before departure |
| Consumed quantity | Yes | Updated during/after camp |
| Returned quantity | Yes | Closure reconciliation |
| Batch number | Required for consumables/medicine | Traceability |
| Expiry date | Required where applicable | FEFO and patient safety |
| Critical flag | Yes | Highlights blockers |
| Shortage notes | Conditional | Required if packed < planned for critical item |

## Mobile Fields

### Camp Selector

Show:

- Camp name, code, date.
- Village/city, state, pincode.
- Status and readiness score.
- Packet state: not downloaded, downloaded, expired, pending refresh.
- Pending outbox count.

Actions:

- Open packet.
- Re-download if online.
- Wipe packet.

### Packet Download

Show:

- Download progress by section: camp, team, registrations, patient summaries, allergies, vitals,
  history, checklist, supplies.
- Counts per table.
- Packet revision.
- Downloaded at.
- Expires at.
- Integrity status.

Required local metadata:

- `camp_id`
- `packet_revision`
- `downloaded_at`
- `expires_at`
- `device_id`
- `user_id`
- `table_counts`
- `content_hash`

### Patient Search

Search fields:

- Registration number.
- Name.
- UHID.
- Phone last 4 digits.
- Age.
- Gender.
- Village/address.
- Chief complaint.
- Patient risk flags.

Filters:

- Not screened.
- Screened.
- Referred.
- Lab sample pending.
- Linked UHID.
- Walk-in only.
- Allergy warning.

Implementation requirement:

- Use local full-text index for text search.
- Use maps for joins: `patient_id -> summary`, `registration_id -> current registration`.

### Patient Chart

Tabs:

- Summary.
- Current Camp.
- Vitals.
- Registration History.
- Visit History.
- Diagnoses.
- Medicines.
- Lab Samples.
- Referrals.

Summary fields:

- UHID or camp registration number.
- Name.
- Age / gender.
- Phone masked or entered camp phone.
- Blood group.
- Chief complaint.
- Active allergy warning.
- MLC/VIP/high-risk flags if present in packet.

Current Camp fields:

- Registration status.
- Walk-in flag.
- Current screening status.
- Lab sample status.
- Referral status.
- Outbox state for locally created records.

### Walk-in Intake

| Field | Required | Validation / offline rule |
|---|---:|---|
| Person name | Yes | 2-80 chars |
| Approx age or DOB | Yes | Age accepted in camp; DOB can be added online later |
| Gender | Yes | Use existing gender values |
| Phone | Recommended | Indian phone validation when present |
| Village/address | Recommended | Required if no phone |
| Guardian / attendant name | Optional | Important for child/elderly attendee |
| Chief complaint | Yes | Free text, max length |
| ID proof type | Optional | Do not require Aadhaar |
| ID proof last 4 / reference | Optional | Avoid storing full sensitive identifier offline |
| Consent/education acknowledged | Yes | Camp operational consent; full consent registry stays online |
| High-risk flag | Optional | Pregnancy, elderly, child, disability, emergency symptoms |

Sync:

- Event: `camp.registration.create`
- Local entity id generated before save.
- Server preserves `client_entity_id`.

### Screening / Vitals

| Field | Required | Validation |
|---|---:|---|
| Registration | Yes | Must exist in local camp packet or local intake |
| BP systolic / diastolic | Recommended | Numeric range checks |
| Pulse | Recommended | Numeric range checks |
| Respiratory rate | Optional | Numeric range checks |
| SpO2 | Recommended | 0-100 |
| Temperature | Recommended | Numeric, C |
| Random blood sugar | Camp-type dependent | Required for diabetes camp |
| Height / weight / BMI | Recommended | Auto-calculate BMI |
| Visual acuity L/R | Eye camp dependent | Required for eye camp |
| Findings | Recommended | Structured quick options + free text |
| Provisional diagnosis | Recommended | ICD/SNOMED mapping later, text allowed offline |
| Advice | Recommended | Local-language counselling text later |
| Referred to hospital | Yes | Boolean |
| Referral department | Conditional | Required if referred |
| Referral urgency | Conditional | `routine`, `urgent`, `emergency` |

Sync:

- Event: `camp.screening.create`

### Lab Sample

| Field | Required | Validation |
|---|---:|---|
| Registration | Yes | Local registration id |
| Sample type | Yes | Blood/urine/sputum/swab/other |
| Test requested | Recommended | Free text until catalog picker is added |
| Barcode | Yes for collection | Manual entry or scan |
| Collected at | Auto | Device timestamp |
| Collected by | Auto | Logged-in user |
| Specimen condition | Recommended | Accepted/hemolysed/insufficient/etc. |
| Cold chain required | Optional | Camp-type dependent |
| Notes | Optional | Free text |

Sync:

- Event: `camp.lab_sample.create`

### Referral

| Field | Required | Validation |
|---|---:|---|
| Registration | Optional | Can report site-level urgent referral too |
| Referred facility | Yes | Default from remote setup |
| Department | Recommended | Medicine/eye/dental/OBG/etc. |
| Urgency | Yes | `routine`, `urgent`, `emergency` |
| Reason | Yes | Red flags and clinical reason |
| Transport mode | Recommended | Self/ambulance/hospital vehicle/other |
| Ambulance required | Yes | Boolean |
| Attendant name/phone | Recommended | Required for emergency if known |

Sync:

- Event: `camp.referral.create`

### Incident / Near Miss

| Field | Required | Validation |
|---|---:|---|
| Type | Yes | patient safety, infection control, BMW, facility safety, staff safety, data privacy, equipment, network, crowd control, other |
| Severity | Yes | low/moderate/high/critical |
| Linked registration | Optional | Required if patient-specific |
| Description | Yes | What happened |
| Immediate action | Recommended | Required for high/critical |
| Status | Yes | open/contained/closed |

Sync:

- Event: `camp.incident.create`

### Sync Center

Show:

- Queue count.
- Last successful sync.
- Failed event count.
- Duplicate count.
- Current connectivity.
- Current API base URL.
- Device id.
- Packet expiry.

Actions:

- Sync now.
- Retry failed.
- View failed event reason.
- Export audit summary when online.

Local outbox fields:

- `id`
- `camp_id`
- `device_id`
- `event_type`
- `client_entity_id`
- `idempotency_key`
- `payload_json`
- `status`
- `attempt_count`
- `last_error`
- `created_at`
- `updated_at`
- `last_attempt_at`

## Data Structures and Algorithms

Use these implementation rules:

1. Single active-camp session: global selected camp + packet + pending count. Field staff select the camp once; all screens operate inside that workspace.
2. Normalized local tables, not one giant JSON blob.
3. FTS index for patient search.
4. Hash map indexes for fast patient chart joins.
5. Prebuilt lowercase search text per roster row for fast local filtering.
6. Append-only outbox with idempotency keys.
7. Batch sync in priority order:
   - registration
   - screening
   - lab sample
   - emergency referral
   - incident
   - checklist/supply updates
8. Exponential backoff with jitter for failed sync attempts.
9. Dirty-field mask for mutable local updates.
10. Packet manifest hash before marking packet as usable.
11. Packet expiry check at app launch and before every write.
12. Cryptographic self-destruct: delete SecureStore AES key first, then encrypted packet and encrypted outbox files.
13. If expired with unsynced clinical outbox, lock patient browsing and allow only Sync Center until sync completes or authorized wipe is chosen.

## WASM / Native Rust Boundary

MedBrains already has three related execution paths:

| Runtime | Current repo path | Use for Camp |
|---|---|---|
| Web WASM | `packages/crdt` uses `loro-crdt`; proxy/CSP allows the Loro WASM asset | Browser/PWA fallback, CRDT docs, shared validation helpers that need to run in web |
| Mobile native Rust | `crates/medbrains-edge-rn` + `packages/edge-rn-bindings` through UniFFI | Primary mobile Camp app. Prefer this over browser WASM on iOS/Android |
| Device adapter WASM | `crates/medbrains-adapter-sdk` | Lab/radiology/device simulators and machine adapters, not patient UI storage |

Camp should not run its primary mobile offline database through browser-style WASM. The native app
needs filesystem access, secure key handling, background-safe sync, and platform database behavior.
For that, use native Rust/UniFFI plus the local DB layer.

Use WASM for:

- Web/PWA Camp fallback.
- Shared packet manifest validation where the same logic must run in web and server tests.
- CRDT operations already powered by Loro on web.
- Device adapter plugins where hospitals ingest data from machines through sandboxed code.

Use native Rust/UniFFI for:

- Mobile JWT verification.
- Offline permission and revocation checks.
- Loro CRDT operations on iOS/Android.
- Future packet hash/manifest verification if it must be identical to web/server logic.

Do not use WASM for:

- Mobile encrypted packet storage.
- Mobile outbox durability.
- Background sync scheduling.
- Direct access to secure storage keys.

## Acceptance Criteria

- App can open downloaded camp after kill/restart with no network.
- Patient search works offline for 10,000 packet records.
- Walk-in intake, vitals, lab sample, referral, and incident survive app restart.
- Duplicate sync submission returns `duplicate`, not duplicate rows.
- Failed sync event remains visible with server error.
- Packet expiry blocks new writes but still allows controlled review until wipe policy runs.
- Logout/revoke wipes local encryption key.
- No full Aadhaar or unnecessary sensitive identifiers are stored in the packet.
