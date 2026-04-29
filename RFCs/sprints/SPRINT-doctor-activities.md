# Sprint Plan — Doctor Daily Activities (signatures, schedules, packages, dashboards)

**Status:** Draft (architecture)
**Date:** 2026-04-28
**Depends on:** Active Visit + Workspace primitive (other chat), Order Basket (this chat), Outbox (Sprint A — other chat)
**Related:** existing `routes/appointments/`, `routes/scheduling.rs`, `pages/admin/doctor-schedules.tsx`, `pages/scheduling.tsx`, migration 060_hr.sql (employees/duty_rosters/on_call), migration 032_opd_appointments.sql

## Context

A hospital doctor's day is fragmented across 8-15 distinct activities; today MedBrains surfaces these as scattered pages with no doctor-centric home. Result: doctors hop between modules manually, miss pending signatures, can't see "what's mine today" in one place. Senior doctors complain MedBrains is built for admins, not clinicians.

This sprint addresses **the doctor as a first-class subject of the system** — not just a `users.id` reference. Five interlocking pieces:

1. **Doctor profile + credentials** — MCI/state registration, specialties, accreditations, hospital affiliations, panel memberships, digital signature credential
2. **Doctor schedule + on-call + leave** — consolidate scattered schedule surfaces into one model that drives appointments, OT, rounds, on-call rotas
3. **Doctor "packages" / consultation bundles** — fixed-price multi-visit packages (chronic-care, post-surgical follow-up, family physician retainer)
4. **Digital signature + sign-off queue** — Rx, certificates, lab/radiology reports, discharge summaries, MLC, fitness, medical leave certificates
5. **Doctor dashboard ("My Day")** — single-pane consolidated view: today's appointments, pending sign-offs, OT list, ward rounds, alerts

## Scope ownership

| Sprint | Owner | Status |
|--------|-------|--------|
| Sprint A — outbox | Other chat | Foundation — needed for SMS/email notifications |
| Workspace primitive + Active Visit + Patient Banner | Other chat | UI host for sign-offs |
| Order Basket | This chat | Sibling — uses same workspace pattern |
| **Doctor Activities** | **This chat (next)** | This plan |

Sequential: order basket lands first → doctor activities builds on it (signatures workspace reuses basket's atomic-sign + audit pattern).

---

## 1. Real-world hospital scenarios (what doctors actually do)

### 1.1 Senior consultant's day
Login 08:30 → check "My Day" dashboard → 12 OPD slots queued, 3 OT cases, 18 IPD patients to round, 7 reports awaiting sign → starts OPD → between cases reviews lab reports flagged critical → signs digitally → 11:30 OPD pause → walks to OT → 2 cases → 14:00 ward rounds with junior doctor (junior writes notes, senior co-signs) → 17:00 reviews discharge summaries pending sign → 18:30 logs out.

### 1.2 Junior resident / PG
Working under attending. Drafts admission notes, prescriptions, discharge summaries → submits for senior co-sign → senior reviews + edits + signs → only signed records become legally final.

### 1.3 On-call duty
Doctor on overnight call → all emergency consults during shift attributed to them → automatically gets on-call allowance entries in HR module → roster handover at shift end.

### 1.4 Visiting consultant
Comes 2 days/week → has fixed slot capacity → patients booked specifically for them → fee structure different from full-time consultants → revenue split with hospital per package.

### 1.5 Chronic care package
Type-2 diabetes patient signs "Diabetes Care Plan" — ₹15,000 covers 12 OPD visits + quarterly HbA1c + lipid panel + dietitian × 2 + endocrinologist × 1 over 12 months. Each consumed visit decrements the package counter; expiry notices sent before lapse.

### 1.6 Doctor leaves / absent
Endocrinologist on 7-day leave → all bookings within window auto-flagged → reception offered alternates → on-call backfill.

### 1.7 Emergency MLC certificate
ER doctor stabilizes RTA victim → signs MLC certificate, fitness-to-discharge, certificate of injuries → all three are legally weighty documents requiring digital signature with timestamp + IP + device.

### 1.8 Fitness / medical leave certificates
Patient asks for "fitness for office" or "leave for 5 days" certificate → doctor selects template → fills minimal fields → digital signature appended → patient gets email + printed copy → certificate registered in MLC/cert log.

### 1.9 Lab/radiology report sign-off
Pathologist reviews 30 lab reports / radiologist reads 20 X-rays per day → each finalized by digital signature → only signed reports release to ordering doctor.

### 1.10 OT note + operative note + discharge planning
Surgeon does case → dictates operative note → assistant types → surgeon reviews + signs → goes into OT register + patient record → discharge planning starts.

### 1.11 Productivity / RVU tracking
HR/Finance asks "how many OPD consults did Dr. X do this month? OT cases? consults billed vs collected?" — needs query without doctor having to log it.

### 1.12 Doctor signing on mobile
Doctor at home reviews discharge summary on phone → signs → goes back to hospital queue. Works offline (Phase 2) → syncs when network back.

### 1.13 Two-doctor procedures (anaesthesia + surgeon)
OT procedure requires both surgeon and anesthetist signature. Both must attest separately; record finalizes only when both signed.

### 1.14 Locum / cross-coverage
Dr. A out, Dr. B covering. Dr. B sees Dr. A's patients → records attributed to Dr. B but linked-as "covering for Dr. A" for billing reconciliation.

### 1.15 Pending sign-off SLA
Some certificates (MLC, death summary) have legal SLAs. Doctor with overdue sign-offs gets escalated; admin sees compliance dashboard.

---

## 2. Architecture — five subsystems

### 2.1 Doctor Profile

`doctor_profiles` table (one per `users.id` where role contains 'doctor'/'consultant'/'resident').

Columns:
- Identity: `user_id` (FK), `prefix` (Dr./Prof.), `display_name`, `qualification_string` (e.g., "MBBS, MD (Internal Medicine)")
- Registration: `mci_number`, `state_council_number`, `state_council_name`, `registration_valid_until`
- Specialties: `specialty_ids[]` (FK to specialties master), `subspecialty`, `years_experience`
- Affiliations: `is_full_time`, `is_visiting`, `parent_employee_id` (FK to `employees`)
- Capability flags: `can_prescribe_schedule_x`, `can_perform_surgery`, `can_sign_mlc`, `can_sign_death_certificate`, `can_sign_fitness_certificate`
- Signature: `digital_signature_credential_id` (FK to `doctor_signature_credentials`)
- Bio: `bio_short`, `bio_long`, `photo_url`, `languages_spoken[]`

### 2.2 Doctor Schedule (consolidate)

Already exists: `doctor_schedules` (slot templates per day-of-week + department), `doctor_schedule_exceptions` (per-date overrides), `duty_rosters` (HR module 060), `on_call_schedules`. They are NOT consolidated. Sprint adds:

- `doctor_availability_view` — Postgres view that unions schedules + exceptions + duty roster + on-call → single read for "is Dr. X available at time T". Used by appointments, OT booking, ward assignment.
- Leave integration: leave_requests already exist in HR; view honors approved leaves.
- Cross-coverage: `doctor_coverage_assignments` table — when Dr. A is out, lists who covers and for which slots.

### 2.3 Doctor Packages

`doctor_packages` — package template. e.g., "Diabetes Care Plan", "Antenatal Care", "Post-MI follow-up".

Columns: `code`, `name`, `description`, `total_price`, `validity_days` (e.g., 365), `is_active`, `tenant_id`.

`doctor_package_inclusions` — per-template line items. Each row = "X visits with Dr.Y" or "N units of service Z included".

Columns: `package_id` (FK), `inclusion_type` (consultation | lab | procedure | other), `consultation_specialty_id`, `consultation_doctor_id` (NULL = any of specialty), `service_id` (FK to services), `included_quantity`, `notes`.

`patient_package_subscriptions` — patient buys a package. One row per active subscription.

Columns: `package_id`, `patient_id`, `tenant_id`, `purchased_at`, `purchased_via_invoice_id`, `valid_until`, `total_paid`, `status` (active | exhausted | expired | refunded).

`patient_package_consumptions` — every consumed visit/service decrements; rows audit how subscription is being used.

Columns: `subscription_id`, `consumed_at`, `inclusion_type`, `consumed_visit_id`, `consumed_service_id`, `consumed_quantity`, `consumed_by_user_id`.

Trigger: on consumption insert, recompute remaining via `get_package_balance(subscription_id) → JSONB { inclusions: [{type, included, consumed, remaining}] }`. Also trigger expiry-warning via outbox `email.package_expiring_soon` 14 days before `valid_until`.

### 2.4 Digital Signature + Sign-off Queue

#### Signature credentials

`doctor_signature_credentials` — per-doctor signature material. For Phase 1, signature is a stored cryptographic key + display image; Phase 2 can integrate eMudhra / NSDL / Aadhaar e-Sign / DSC USB tokens.

Columns: `doctor_user_id`, `credential_type` (stored_key | aadhaar_esign | dsc_usb | external_pkcs11), `public_key`, `algorithm` (Ed25519 default), `display_image_url` (the visual signature scan), `valid_from`, `valid_until`, `revoked_at`, `revoked_reason`, `created_at`.

Phase 1 implementation: server holds an Ed25519 keypair per doctor (encrypted at rest with `pgcrypto` using a tenant master key); doctor authenticates with password + TOTP to unlock signing → server signs payload hash → record stored.

Phase 2 integrations: real eMudhra/Aadhaar e-Sign for legal-grade certificates (death, MLC).

#### Signable records — uniform shape

A `signed_records` table records every sign event regardless of which document type:

Columns:
- `id`
- `tenant_id`
- `record_type` (`prescription` | `lab_report` | `radiology_report` | `discharge_summary` | `mlc_certificate` | `death_certificate` | `fitness_certificate` | `medical_leave_certificate` | `birth_certificate` | `consent_form` | `operative_note` | `progress_note`)
- `record_id` UUID — the source row
- `signer_user_id`
- `signer_role` (primary | co_signer)
- `signer_credential_id`
- `signed_at`
- `payload_hash` SHA-256 of canonicalized payload
- `signature_bytes` — Ed25519 signature
- `device_fingerprint`, `ip_address`, `user_agent`
- `legal_class` (`administrative` | `clinical` | `medico_legal` | `statutory_export`) — drives retention + signing requirements

Sign action = insert one `signed_records` row + update source record's `is_signed=true`, `signed_record_id`. Multiple signers = multiple `signed_records` rows referencing same `(record_type, record_id)`.

#### Sign-off queue

`doctor_pending_signoffs_view` — Postgres view that aggregates everything awaiting a doctor's signature:

```
UNION ALL
- prescriptions WHERE ordered_by = $doctor_id AND is_signed = FALSE
- lab_results WHERE finalized_by = $doctor_id AND is_signed = FALSE
- radiology_reports WHERE reported_by = $doctor_id AND is_signed = FALSE
- discharge_summaries WHERE completed_by = $doctor_id AND is_signed = FALSE
- certificates WHERE issued_by = $doctor_id AND is_signed = FALSE
- progress_notes WHERE drafted_by = $doctor_id AND co_sign_required AND co_signer = $doctor_id
```

Returned with overdue badges, legal_class, related patient name, draft preview.

#### Co-signer flow

Junior writes record with `co_sign_required = TRUE` and `co_signer_user_id = $senior_id`. Record is `is_draft = TRUE` until BOTH primary author signs and co-signer signs. Sign-off queue surfaces the pending row to senior.

### 2.5 Doctor Dashboard ("My Day")

Single page `/doctor/my-day` (or rendered in patient-chart-style banner when doctor logs in). Sections:

1. **Today** — appointments scheduled, statuses (waiting | in-consult | done), quick-launch "Start Visit" buttons
2. **Pending sign-offs** — count badge + list, grouped by legal_class with overdue highlighting
3. **OT today** — scheduled cases, status (pre-op | in-OT | post-op)
4. **IPD rounds** — patients under doctor's care, last-vitals timestamp, ward + bed
5. **Critical alerts** — flagged lab values, code blue events involving my patients, pending preauths
6. **Packages I'm part of** — active patient subscriptions where this doctor is named, with usage progress bars
7. **Productivity strip** — today's count of consults / OT cases / hours signed-out, week-to-date
8. **On-call** — am I on call now? next on-call date

Dashboard auto-refreshes every 30s. WebSocket for real-time alerts (uses existing `queue_broadcaster`).

---

## 3. Schema additions

Single migration `132_doctor_activities.sql`:

```sql
-- Doctor profile (one row per doctor user)
CREATE TABLE doctor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prefix TEXT,
  display_name TEXT NOT NULL,
  qualification_string TEXT,
  mci_number TEXT,
  state_council_number TEXT,
  state_council_name TEXT,
  registration_valid_until DATE,
  specialty_ids UUID[] NOT NULL DEFAULT '{}',
  subspecialty TEXT,
  years_experience INT,
  is_full_time BOOLEAN NOT NULL DEFAULT TRUE,
  is_visiting BOOLEAN NOT NULL DEFAULT FALSE,
  parent_employee_id UUID,                          -- → employees.id
  can_prescribe_schedule_x BOOLEAN NOT NULL DEFAULT FALSE,
  can_perform_surgery BOOLEAN NOT NULL DEFAULT FALSE,
  can_sign_mlc BOOLEAN NOT NULL DEFAULT FALSE,
  can_sign_death_certificate BOOLEAN NOT NULL DEFAULT FALSE,
  can_sign_fitness_certificate BOOLEAN NOT NULL DEFAULT TRUE,
  bio_short TEXT,
  bio_long TEXT,
  photo_url TEXT,
  languages_spoken TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

-- Signature credentials
CREATE TABLE doctor_signature_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  doctor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL CHECK (credential_type IN
    ('stored_key', 'aadhaar_esign', 'dsc_usb', 'external_pkcs11')),
  algorithm TEXT NOT NULL DEFAULT 'Ed25519',
  public_key BYTEA NOT NULL,
  encrypted_private_key BYTEA,                      -- pgcrypto encrypted; NULL for hardware tokens
  display_image_url TEXT,                            -- visual signature scan
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX doctor_signature_credentials_default_idx
  ON doctor_signature_credentials (tenant_id, doctor_user_id)
  WHERE is_default AND revoked_at IS NULL;

-- Universal signed records audit
CREATE TABLE signed_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN (
    'prescription', 'lab_report', 'radiology_report', 'discharge_summary',
    'mlc_certificate', 'death_certificate', 'fitness_certificate',
    'medical_leave_certificate', 'birth_certificate', 'consent_form',
    'operative_note', 'progress_note', 'package_subscription'
  )),
  record_id UUID NOT NULL,
  signer_user_id UUID NOT NULL REFERENCES users(id),
  signer_role TEXT NOT NULL CHECK (signer_role IN ('primary', 'co_signer', 'attestor')),
  signer_credential_id UUID REFERENCES doctor_signature_credentials(id),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_hash BYTEA NOT NULL,                      -- SHA-256
  signature_bytes BYTEA NOT NULL,                   -- Ed25519
  legal_class TEXT NOT NULL CHECK (legal_class IN (
    'administrative', 'clinical', 'medico_legal', 'statutory_export'
  )),
  device_fingerprint TEXT,
  ip_address INET,
  user_agent TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX signed_records_record_idx ON signed_records (tenant_id, record_type, record_id);
CREATE INDEX signed_records_signer_idx ON signed_records (tenant_id, signer_user_id, signed_at DESC);
CREATE INDEX signed_records_legal_idx ON signed_records (tenant_id, legal_class, signed_at DESC);

-- Doctor consultation packages
CREATE TABLE doctor_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  total_price NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
  validity_days INT NOT NULL DEFAULT 365 CHECK (validity_days > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE doctor_package_inclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES doctor_packages(id) ON DELETE CASCADE,
  inclusion_type TEXT NOT NULL CHECK (inclusion_type IN
    ('consultation', 'lab', 'procedure', 'service')),
  consultation_specialty_id UUID,
  consultation_doctor_id UUID REFERENCES users(id),  -- NULL = any of specialty
  service_id UUID,                                    -- → services
  test_id UUID,                                       -- → lab_test_catalog
  procedure_id UUID,
  included_quantity INT NOT NULL CHECK (included_quantity > 0),
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX doctor_package_inclusions_package_idx
  ON doctor_package_inclusions (tenant_id, package_id);

CREATE TABLE patient_package_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES doctor_packages(id),
  patient_id UUID NOT NULL,                           -- → patients.id
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  purchased_via_invoice_id UUID,                      -- → billing_invoices.id
  valid_until TIMESTAMPTZ NOT NULL,
  total_paid NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'exhausted', 'expired', 'refunded', 'suspended')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX patient_package_subscriptions_patient_idx
  ON patient_package_subscriptions (tenant_id, patient_id, status);
CREATE INDEX patient_package_subscriptions_expiry_idx
  ON patient_package_subscriptions (tenant_id, valid_until)
  WHERE status = 'active';

CREATE TABLE patient_package_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES patient_package_subscriptions(id) ON DELETE CASCADE,
  inclusion_type TEXT NOT NULL,
  consumed_visit_id UUID,                             -- → opd_visits or ipd_admissions
  consumed_service_id UUID,
  consumed_test_id UUID,
  consumed_procedure_id UUID,
  consumed_quantity INT NOT NULL DEFAULT 1,
  consumed_by_user_id UUID REFERENCES users(id),
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
CREATE INDEX patient_package_consumptions_sub_idx
  ON patient_package_consumptions (tenant_id, subscription_id, consumed_at DESC);

-- Coverage assignments (locum / cross-coverage)
CREATE TABLE doctor_coverage_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  absent_doctor_id UUID NOT NULL REFERENCES users(id),
  covering_doctor_id UUID NOT NULL REFERENCES users(id),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL CHECK (end_at > start_at),
  reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX doctor_coverage_assignments_active_idx
  ON doctor_coverage_assignments (tenant_id, absent_doctor_id, start_at, end_at);

-- RLS + triggers + force RLS for all tables above
-- (apply_tenant_rls + FORCE ROW LEVEL SECURITY + update_updated_at trigger)

-- View: pending sign-offs aggregated across all signable record types
CREATE OR REPLACE VIEW doctor_pending_signoffs_view AS
  SELECT 'prescription' AS record_type, p.id AS record_id, p.tenant_id,
         p.ordered_by AS doctor_user_id, p.created_at, 'clinical' AS legal_class
  FROM prescriptions p
  WHERE p.is_signed IS NOT TRUE
  UNION ALL
  SELECT 'lab_report', lr.id, lr.tenant_id, lr.finalized_by, lr.created_at, 'clinical'
  FROM lab_results lr
  WHERE lr.is_finalized AND lr.is_signed IS NOT TRUE
  -- ... extend per record type
;

-- View: doctor availability (consolidates schedules + exceptions + duty roster + on-call)
CREATE OR REPLACE VIEW doctor_availability_view AS
  -- Implementation in migration: SELECT … from doctor_schedules JOIN exceptions JOIN duty_rosters JOIN on_call …
;

-- Grants for outbox worker (read-only)
GRANT SELECT ON doctor_profiles, doctor_signature_credentials, signed_records,
                doctor_packages, patient_package_subscriptions
                TO medbrains_outbox_worker;
```

---

## 4. Backend changes

### 4.1 New routes

| Route | Purpose |
|-------|---------|
| `GET /api/doctors/me/profile` | Current doctor's profile |
| `PUT /api/doctors/me/profile` | Update own profile |
| `GET /api/admin/doctors` | List with filters (specialty, active, visiting) |
| `GET /api/admin/doctors/{id}` | Detail |
| `POST /api/admin/doctors` | Create profile linked to existing user |
| `PUT /api/admin/doctors/{id}` | Update |
| `GET /api/doctors/me/dashboard` | "My Day" composite payload |
| `GET /api/doctors/me/pending-signoffs` | Sign-off queue |
| `POST /api/signatures/sign` | Atomic sign action |
| `POST /api/signatures/sign-batch` | Bulk sign multiple records (lab pathologist signs 30 reports at once) |
| `POST /api/signatures/co-sign` | Co-signer attestation |
| `GET /api/admin/signature-credentials` | List credentials |
| `POST /api/admin/signature-credentials` | Issue (admin generates Ed25519 keypair) |
| `POST /api/admin/signature-credentials/{id}/revoke` | Revoke |
| `GET /api/admin/doctor-packages` | List package templates |
| `POST /api/admin/doctor-packages` | Create |
| `PUT /api/admin/doctor-packages/{id}` | Update |
| `POST /api/admin/doctor-packages/{id}/inclusions` | Add inclusion line |
| `DELETE /api/admin/doctor-packages/{id}/inclusions/{iid}` | Remove inclusion |
| `POST /api/patient-packages/subscribe` | Patient buys a package — creates subscription + invoice + line items |
| `GET /api/patient-packages/{patient_id}` | Patient's active subscriptions + balances |
| `POST /api/patient-packages/{sub_id}/consume` | Mark a visit/service consumed against subscription |
| `POST /api/patient-packages/{sub_id}/refund` | Refund + status flip |
| `GET /api/doctors/{id}/availability?date=` | Aggregated availability for date |
| `POST /api/admin/coverage-assignments` | Locum coverage |

### 4.2 Sign action — atomic + verifiable

Signature flow:
1. Client sends `{record_type, record_id}` to `POST /api/signatures/sign` with active session + recent password/TOTP re-auth (within last 5 min)
2. Server fetches record, builds canonical JSON payload (deterministic key order)
3. Computes SHA-256 hash
4. Loads doctor's default credential, decrypts private key with tenant master (pgcrypto)
5. Signs hash with Ed25519
6. Inserts `signed_records` row in tx
7. Updates source record `is_signed=true, signed_record_id=$1`
8. Outbox-queues notification (e.g., `email.signed_certificate_to_patient`)
9. Returns `{signed_record_id, signed_at, signature_bytes}`

Verification: any consumer can fetch the signed record + recompute payload hash + verify Ed25519 signature against stored public key. Public key in `doctor_signature_credentials` allows offline verification of historical signatures even if doctor leaves.

### 4.3 Permissions (`crates/medbrains-core/src/permissions.rs`)

```rust
pub mod doctor {
    pub mod profile {
        pub const VIEW: &str = "doctor.profile.view";
        pub const UPDATE_OWN: &str = "doctor.profile.update_own";
    }
    pub mod signature {
        pub const SIGN: &str = "doctor.signature.sign";
        pub const CO_SIGN: &str = "doctor.signature.co_sign";
    }
    pub mod packages {
        pub const VIEW: &str = "doctor.packages.view";
        pub const SUBSCRIBE: &str = "doctor.packages.subscribe";
        pub const CONSUME: &str = "doctor.packages.consume";
    }
    pub mod dashboard {
        pub const VIEW_OWN: &str = "doctor.dashboard.view_own";
    }
}

pub mod admin {
    // existing...
    pub mod doctors {
        pub const LIST: &str = "admin.doctors.list";
        pub const CREATE: &str = "admin.doctors.create";
        pub const UPDATE: &str = "admin.doctors.update";
    }
    pub mod doctor_packages {
        pub const LIST: &str = "admin.doctor_packages.list";
        pub const MANAGE: &str = "admin.doctor_packages.manage";
    }
    pub mod signature_credentials {
        pub const ISSUE: &str = "admin.signature_credentials.issue";
        pub const REVOKE: &str = "admin.signature_credentials.revoke";
    }
}
```

---

## 5. Frontend changes

### 5.1 Doctor Dashboard `/doctor/my-day`
- Shell: `<MyDayLayout />` with banner showing doctor profile + on-call status
- Sections via `<DashboardSection title actions>` widgets, each with TanStack query
- Auto-refresh 30s, plus WebSocket real-time push for critical alerts
- Permission gate: `doctor.dashboard.view_own`

### 5.2 Sign-off queue `<SignoffQueue />`
- Tabbed list: All | Clinical | Medico-legal | Overdue
- Row: record type icon, patient name, draft preview snippet, age, "Sign" button
- "Sign" opens `<SignWorkspace>` (uses workspace primitive from other chat)
- Bulk select for batch-sign-eligible record types (lab reports primarily)
- Re-auth modal before first sign each session (password + TOTP)

### 5.3 `<SignWorkspace>`
- Renders the record as it will be printed/exported (PDF preview)
- Side panel: signer info, credential, legal_class, audit fields preview
- Confirms with "Sign" button; on success shows green tick + signature image overlay
- Mobile-friendly (Phase 2 offline)

### 5.4 Doctor packages
- `pages/admin/doctor-packages.tsx` — list + create + edit packages
- `pages/admin/doctor-package-builder.tsx` — drag-drop inclusion lines
- Patient checkout integration: `<PackageCard>` + `<SubscribeModal>` shows price + inclusions before purchase
- Patient detail page → "Active Packages" section showing balance bars per inclusion
- Auto-consume hook: when an OPD visit is booked AND patient has matching package subscription with remaining quota, prompt "Apply package? (Saves ₹X)"

### 5.5 Doctor profile admin
- `pages/admin/doctors.tsx` — table with quick filters
- `pages/admin/doctors/[id].tsx` — profile edit + credentials management
- "Issue signature credential" admin action — generates Ed25519 keypair, shows fingerprint, marks default

---

## 6. Outbox events emitted

- `email.signed_certificate_to_patient` — fitness/leave/MLC certificate signed → email to patient
- `email.discharge_summary_to_referrer` — discharge summary signed → email to referring doctor
- `sms.package_expiring_soon` — 14 days before package `valid_until`
- `sms.package_exhausted` — when last inclusion consumed
- `email.signoff_overdue_warning` — daily cron flags doctors with >7d overdue medico-legal sign-offs
- `email.coverage_assignment_notification` — when admin assigns locum coverage
- `internal.doctor_dashboard_realtime` — pushed via queue_broadcaster for critical alerts

---

## 7. Tests

| Use case | Test |
|----------|------|
| Sign + verify | Sign a prescription, recompute hash, verify Ed25519 → matches |
| Co-sign | Junior drafts note with `co_sign_required=true`; senior signs; record `is_finalized=true` only after both sigs present |
| Revoke credential | Revoked credential rejected at sign time with `CredentialRevoked` |
| Package subscribe + consume | Buy "Diabetes Plan", consume 3 visits, balance shows 9 remaining |
| Package expiry | Subscription past `valid_until` → status auto-flips to `expired` via cron, email queued |
| Locum coverage | Dr. A absent 3 days, Dr. B covers; Dr. A's appointments auto-route to Dr. B; revenue split per coverage rule |
| Sign batch | Pathologist batch-signs 30 lab reports; one fails; transaction rolls back the failing one only (each sign is its own tx — batch is best-effort) |
| Sign-off queue | Doctor's queue includes all unsigned records authored by them; overdue flag for items >24h old (medico-legal) |
| Re-auth required | Sign attempt with last-auth >5 min → 401; re-auth → succeeds |
| Schedule conflict | Booking violates active leave → 409 conflict |

---

## 8. Acceptance criteria

1. Doctor logs in → `/doctor/my-day` loads in <500ms with all 8 sections populated
2. Doctor can sign a prescription end-to-end in 3 clicks (queue → preview → sign), result verifiable cryptographically
3. Co-sign flow: junior writes note → senior sees in queue → senior signs → record finalizes
4. Package subscribed + 3 consumptions tracked → patient detail shows correct balance
5. Lab pathologist batch-signs 30 reports in <10 seconds
6. Revoked credential cannot sign (clear error)
7. Doctor schedule + exceptions + duty roster + on-call all consolidated in `/api/doctors/{id}/availability`
8. Locum coverage redirects appointments correctly
9. Audit trail: every signed record fully recoverable + verifiable from `signed_records` row
10. Permissions: doctor cannot edit another doctor's profile; admin can; super_admin/hospital_admin bypass
11. CI green: cargo clippy, pnpm typecheck, pnpm build, make check-api

---

## 9. Effort estimate

| Phase | Hours |
|-------|-------|
| Migration 132 (7 tables + 2 views + RLS + triggers + grants) | 10 |
| Doctor profile CRUD + admin pages | 12 |
| Signature credential issue + Ed25519 sign/verify | 16 |
| `signed_records` + sign action + co-sign + batch | 14 |
| Sign-off queue view + endpoint + frontend | 12 |
| `SignWorkspace` + PDF preview integration | 10 |
| Doctor packages — schema + CRUD + subscribe + consume | 18 |
| Patient detail integration (active packages section) | 6 |
| Doctor "My Day" dashboard (8 sections) | 16 |
| Locum coverage assignment + appointment redirect | 6 |
| Schedule consolidation view + endpoint | 6 |
| Outbox events (5 types) + cron job (expiry / overdue) | 8 |
| Tests (10 scenarios) | 18 |
| Permissions wiring + i18n | 4 |
| **Total** | **~156h ≈ 4 dev-weeks** |

This is bigger than order-basket. Recommend split into two PRs:

- **PR-1 (sub-sprint A)**: Profile + signatures + sign-off queue + dashboard. Foundational.
- **PR-2 (sub-sprint B)**: Packages + consumptions + locum coverage. Builds on top.

---

## 10. Risks + mitigations

| Risk | Mitigation |
|------|-----------|
| Ed25519 keypair compromise | Encrypt private keys at rest with pgcrypto + tenant master; key rotation procedure documented; revocation flag |
| Legal validity of stored-key signatures vs DSC | Document Phase 1 = administrative-grade only; medico-legal certificates require Phase 2 eMudhra integration |
| Performance: pending_signoffs view may be slow at scale | View becomes materialized + refreshed on relevant table writes if N > 10k |
| Package balance race condition (two concurrent consumes drain stock) | `SELECT ... FOR UPDATE` on subscription row inside consumption tx |
| Schedule view with unions of 4 tables = hot path | Add covering indexes + materialize daily for reporting |
| Doctors using shared workstations | Re-auth window (5 min) for sign action; mandatory TOTP for medico-legal sign |
| Old records signed under revoked credentials | Public key archived; old signatures still verifiable; new signatures forbidden |
| Credential lost (USB token broken) | Admin reissues; old credential revoked; previously-signed records remain valid |

---

## 11. Out of scope (this sprint)

- eMudhra / NSDL / Aadhaar e-Sign integration (Phase 2 — needs vendor onboarding)
- DSC USB token (Phase 2)
- Doctor mobile app (Phase 2)
- Doctor performance analytics dashboard (Phase 3 — needs longitudinal data)
- Multi-hospital affiliation (Phase 3 — same doctor multiple hospitals)
- Telemedicine session recording with auto-sign (Phase 3)
- AI-assisted note dictation + auto-draft (Phase 4)

---

## 12. Critical files

### New
- `medbrains/crates/medbrains-db/src/migrations/132_doctor_activities.sql`
- `medbrains/crates/medbrains-server/src/routes/doctor_profile.rs`
- `medbrains/crates/medbrains-server/src/routes/doctor_dashboard.rs`
- `medbrains/crates/medbrains-server/src/routes/signatures.rs`
- `medbrains/crates/medbrains-server/src/routes/doctor_packages.rs`
- `medbrains/crates/medbrains-server/src/routes/patient_packages.rs`
- `medbrains/crates/medbrains-server/src/services/signing.rs` — Ed25519 sign/verify, canonicalization
- `medbrains/crates/medbrains-server/src/services/package_balance.rs`
- `medbrains/crates/medbrains-server/tests/integration/doctor/`
- `medbrains/apps/web/src/pages/doctor/my-day.tsx`
- `medbrains/apps/web/src/pages/admin/doctors.tsx`
- `medbrains/apps/web/src/pages/admin/doctors/[id].tsx`
- `medbrains/apps/web/src/pages/admin/doctor-packages.tsx`
- `medbrains/apps/web/src/components/Doctor/SignWorkspace.tsx`
- `medbrains/apps/web/src/components/Doctor/SignoffQueue.tsx`
- `medbrains/apps/web/src/components/Doctor/MyDay/*.tsx` (8 sections)
- `medbrains/apps/web/src/components/Patient/ActivePackagesSection.tsx`

### Modified
- `medbrains/crates/medbrains-server/src/routes/mod.rs`
- `medbrains/packages/api/src/client.ts`
- `medbrains/packages/types/src/index.ts`
- `medbrains/crates/medbrains-core/src/permissions.rs`
- `medbrains/packages/types/src/permissions.ts`
- `medbrains/apps/web/src/components/AppLayout.tsx` (doctor home redirect)
- `medbrains/crates/medbrains-server/src/state.rs` (signing service handle)

### Reused
- `users`, `employees`, `roles` (existing)
- `doctor_schedules`, `doctor_schedule_exceptions`, `duty_rosters`, `on_call_schedules` (existing)
- `prescriptions`, `lab_results`, `radiology_reports`, `discharge_summaries`, `consent_forms`
- `billing_invoices`, `services` (for package pricing)
- `outbox_events::queue_in_tx` (Sprint A)
- `useWorkspace`, `useActiveVisit` (other chat)
- `set_tenant_context`, `update_updated_at`, `apply_tenant_rls`

---

## 13. Branch + PR plan

- Branch: `feature/doctor-activities-1` for sub-sprint A (profile + signatures + dashboard)
- Branch: `feature/doctor-activities-2` for sub-sprint B (packages + coverage)
- Each PR cites this plan
- Reviewer focus: (a) Ed25519 signing correctness + canonicalization, (b) `signed_records` audit trail completeness, (c) RLS posture + worker grants, (d) package balance race conditions

---

## 14. Verification — end-to-end

1. Migration 132 applies; `\dt doctor_*` shows 7 tables
2. Admin issues signature credential to Dr. X; verify keypair in `doctor_signature_credentials`
3. Dr. X logs in → `/doctor/my-day` loads with 12 OPD slots, 5 pending sign-offs, 0 critical alerts
4. Dr. X opens sign-off queue → sees a draft prescription → opens SignWorkspace → previews → signs
5. Verify `signed_records` row created; `prescriptions.is_signed=true`; signature verifiable via `verify_record(record_id)` debug endpoint
6. Junior creates note with `co_sign_required=true; co_signer=Dr.X`; Dr. X sees in queue; signs; verify two `signed_records` rows; record `is_finalized=true`
7. Admin creates "Diabetes Care Plan" package with 12 OPD + 4 labs + 1 dietitian; price ₹15k
8. Patient buys package → invoice created → subscription `active`
9. Patient books OPD visit → consumption auto-applies → balance shows 11 remaining OPDs
10. Cron runs → 14-day-pre-expiry email queued via outbox
11. Admin assigns coverage: Dr. A absent → Dr. B covers Mon-Wed; verify appointment routing
12. Run integration tests: `cargo test -p medbrains-server --test integration doctor`
