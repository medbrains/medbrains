# Runbook - Camp Mode Launch

**Owner:** Clinical Apps + Platform Engineering
**Scope:** Camp module launch track for offline field use, segmented packet download, and sync-back testing.

## Decision

Camp Mode is the first offline launch wave. It belongs in the Camp module, but it must not absorb the full Patient Registration module.

The boundary is:

| Area | Source of truth | Camp Mode behavior |
|---|---|---|
| Camp profile | Camp | Camp name, type, date, venue, coordinator, team, modules, expected participants. |
| Camp intake | Camp | `camp_registrations` stores camp-specific intake, walk-in details, chief complaint, status, and optional `patient_id`. |
| Patient master | Patient Registration | UHID, MPI duplicate matching, ABHA, identifiers, consent, addresses, contacts, insurance, allergies, merge history. Camp links to this; it does not duplicate it. |
| Screening and vitals | Camp | `camp_screenings` stores BP, pulse, SpO2, temperature, glucose, BMI, visual acuity, findings, diagnosis, advice, referral fields. |
| Lab sample collection | Camp | `camp_lab_samples` stores sample type, requested test text, barcode, collection status, and optional lab order link. |
| Billing | Billing / Camp admin | Keep online for MVP. Free camps do not need offline billing. |
| Follow-up conversion | Camp + Patient/OPD | Keep online for MVP after the camp window, unless specifically required by operations. |

## RFC and compliance baseline

Relevant local RFCs:

- `RFC-INFRA-2026-002-Offline-First.md`: offline mobile uses WatermelonDB, service worker fallback is secondary, and offline writes must be audited.
- `RFC-MODULE-patient-registration.md`: Patient Registration is the gateway for UHID, MPI, ABHA, consent, demographics, identifiers, merge, and patient profile management.
- `runbooks/offline-mode-dev.md`: existing CRDT path is for T2/T3 clinical offline behavior. Billing, prescriptions, and admin remain online.

Regulatory posture:

- Minimum patient identification still uses two identifiers when linking or creating a real patient.
- ABHA is optional. A patient cannot be denied camp care because ABHA is missing.
- Aadhaar or other sensitive identifier values must not be stored casually in camp offline packets.
- Every packet download and every sync-back event must be audit logged with user, device, camp, time, and patient count.
- Offline packet data must be encrypted at rest on the device and wiped or made unreadable on logout, revoke, or packet expiry.

## Offline MVP

Offline writes for launch:

1. Camp intake registration
2. Camp screening with all vitals
3. Camp lab sample collection with barcode
4. Local sync metadata: idempotency key, device id, user id, camp id, local timestamp

Read-only packet for launch:

1. Camp profile and team
2. Assigned camp registration list
3. Minimal linked patient summary only where `patient_id` already exists
4. Recent vitals needed for camp care
5. Allergy and clinical warning summary only if already available and permitted

Out of offline MVP:

1. Full patient master registration
2. MPI merge and duplicate resolution
3. ABHA enrollment or linking
4. Billing and payment collection
5. Pharmacy dispensing and controlled substances
6. Full lab order/result lifecycle
7. IPD, OPD, radiology, and broader HMS module writes

## Patient creation rule

For a walk-in camp attendee, the field app creates a `camp_registration` offline first.

When connectivity returns:

1. Sync the camp registration.
2. Run Patient Registration duplicate search/MPI online.
3. If no match exists, create the real patient through the Patient Registration API.
4. Link `camp_registrations.patient_id` to the resulting patient.
5. Keep the original camp intake record for audit and camp analytics.

This keeps the camp fast in the field without bypassing UHID, MPI, ABHA, consent, or patient master rules.

## Surfaces

| Surface | Launch role |
|---|---|
| Web Camp page | Online command center for camp setup, team assignment, review, analytics, and post-camp conversion. |
| Mobile staff app | Primary offline field surface for intake, screening/vitals, lab sample collection, and sync status. |
| Browser/PWA | Controlled fallback only after mobile path is stable. Use IndexedDB/WebCrypto and stricter device policy. |
| Edge hub | Optional later. First soft launch should sync direct to cloud to reduce moving parts. |
| TV | Read-only dashboards only. No offline writes. |

## Acceptance tests

Before soft launch, test:

1. Online login, select camp, download assigned segment.
2. Go offline, open camp list, register walk-in, capture vitals, collect lab sample.
3. Kill and restart app while offline; data remains.
4. Interrupted packet download resumes without duplicate records.
5. Reconnect and sync; idempotency prevents duplicates.
6. Linked patient updated online while camp device is offline; stale data is detected during sync.
7. User tries to access patient outside the assigned camp segment; server denies.
8. Logout or device revoke makes local packet unreadable.
9. Packet sizes: 500, 2,000, and 10,000 camp registrations or linked patients.
10. Bad network: throttled 2G, packet loss, reconnect loops.

## First implementation slice

Do this first, in this order:

1. Keep existing Camp web and backend module as the operational command center.
2. Add a camp packet design that returns camp data plus only minimal, permitted linked patient summaries.
3. Add mobile-staff Camp screens for intake, screening/vitals, lab sample, packet download, and sync status.
4. Add local encrypted store and idempotent pending outbox for those camp entities.
5. Add sync-back endpoint for camp intake/screening/lab sample events only.
6. Add audit and packet expiry.

Do not start by changing the Patient Registration schema. Camp Mode should call Patient Registration after sync, not replace it.
