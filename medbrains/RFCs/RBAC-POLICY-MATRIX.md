# RBAC Policy Matrix — per module / per role / per action

**Status:** Draft (Phase 2 deliverable; informs Phase 3 endpoint wiring)
**Owner:** Platform team
**Companion:** `infra/spicedb/schema.zed`, `crates/medbrains-authz/src/relations.rs`

This document is the source of truth for **who can do what, where, and why** across MedBrains. Every module section below answers four questions:

1. **What** are the actions on the module's resources? (Verb + resource: `create patient`, `view lab order`, etc.)
2. **Who** is allowed by default per role? (Tenant-wide vs. resource-scoped)
3. **What scopes the access** when more than role-checking is needed? (Department, attending relationship, group membership, explicit grant)
4. **Why** — the regulatory / safety / operational reason. NABH chapter, HIPAA section, or hospital SOP.

Every "Restrict" rule below maps to a SpiceDB relation/permission in `schema.zed` plus a `require_permission()` call in the route handler. Every "Allow all" rule means **only** the role check (`P.MODULE.ACTION`) gates access — no per-resource filter.

## Conventions

- **Tenant-wide**: any user holding the role permission sees every row in the tenant. Used for catalogs (drug, lab test) and module-scoped admin lists where there's no patient-PHI exposure.
- **Resource-scoped**: the user only sees rows where SpiceDB grants them `view` (or higher). Default for clinical resources.
- **Owner-only edit**: read may be tenant-wide, but mutations require holding `editor` or `owner` on that specific resource.
- **Bypass roles** (`super_admin`, `hospital_admin`) ignore all matrix rules — they're outside the model. Used for break-glass + admin operations only.
- **Audit always**: every read AND write is logged regardless of role. Audit is orthogonal to authz.

## Resource scope decision tree

For each new endpoint, walk this tree:

```
Does the response leak patient PHI?
├─ Yes → Resource-scoped (rebac filter required)
│   └─ Is mutation involved?
│       ├─ Yes → editor/owner check on the specific resource
│       └─ No  → view check on the specific resource
└─ No → Is it tenant-admin data (users, roles, audit)?
    ├─ Yes → admin-role-only (require_permission on admin.* code)
    └─ No  → catalog / config? Tenant-wide read OK; admin write
```

---

## Module: Patients (`/api/patients/*`)

| Action | Permission code | Default | Scope rule | Why |
|---|---|---|---|---|
| List patients | `patients.list` | All clinical roles | **Resource-scoped** by `viewer/editor/attending/dept_member/group_member` on `patient:{id}` | NABH IMS 8.1 minimum-necessary; receptionist sees registration list filtered to their counter, doctor sees their assigned patients only |
| Create patient | `patients.create` | Receptionist, doctor | Tenant-wide (anyone with the perm can register) | Walk-ins are routed to whoever's on duty; the registrant is auto-granted `owner` so the patient is visible to them |
| View patient | `patients.view` | All clinical roles | **Resource-scoped** view on `patient:{id}` | Fine-grained PHI control |
| Edit patient | `patients.update` | Receptionist (demographics), doctor (clinical) | **Resource-scoped** edit on `patient:{id}` | NABH 8.4: only authorized users alter records |
| Delete (soft) patient | `patients.delete` | hospital_admin only | Bypass | Patients aren't deletable by clinicians; merge/dedupe is a separate workflow |
| Search by phone | `patients.list` | Receptionist | Tenant-wide search returns minimal fields (uhid, name, phone) — full record requires `view` | Triage / phone enquiry desk SOP |

**Implicit grants on create**:
- `patient:{id}#owner@user:{registered_by}`
- If first encounter is created same-tx, `patient:{id}#attending@user:{doctor_id}`
- `patient:{id}#dept_member@department:{dept_id}#member`

---

## Module: Encounters / OPD (`/api/opd/encounters/*`, `/api/opd/queues/*`)

| Action | Permission code | Default | Scope rule | Why |
|---|---|---|---|---|
| List encounters | `opd.queue.list` | Doctor, nurse, receptionist | **Resource-scoped** view on `encounter:{id}` (typically dept_member or attending) | Doctor only sees encounters in their dept |
| Create encounter | `opd.visit.create` | Receptionist, doctor | Patient-scoped: caller must hold `view` on `patient:{id}` | Can't book a visit for a patient you can't see |
| View encounter | `opd.visit.view` | Doctor, nurse | **Resource-scoped** view | Same as patient |
| Update encounter (consultation) | `opd.visit.update` | Attending doctor | **Resource-scoped** edit (attending or editor) | Only the attending writes the consultation note |
| Cancel/no-show | `opd.token.manage` | Receptionist, doctor | dept_member of the encounter's dept | Front-office workflow |
| Queue dashboard (TV) | `opd.queue.list` | All clinical | dept_member only | Wards see only their queue |

---

## Module: Admissions / IPD (`/api/ipd/admissions/*`)

| Action | Permission | Default | Scope | Why |
|---|---|---|---|---|
| List admissions | `ipd.admissions.list` | Doctor, nurse, billing | **Resource-scoped** view (attending / dept_member / ward_member) | Nurse on ward 5 sees only ward 5 admissions |
| Admit patient | `ipd.admissions.create` | Doctor, ER doctor | Patient view + dept_member of admitting dept | |
| View admission | `ipd.admissions.view` | Doctor, nurse, billing | **Resource-scoped** | |
| Discharge | `ipd.discharge_summary.create` | Attending doctor | `discharge` permission on admission (= attending only) | Only attending closes the case |
| Update bed | `ipd.beds.update` | Nurse, ward staff | dept_member or ward_member | |
| MAR write | `ipd.mar.create` | Nurse | ward_member of admission's ward | Strictly ward-scoped per shift roster |
| Progress notes | `ipd.progress_notes.create` | Doctor, nurse | edit on admission | |
| Death record | `ipd.death_records.create` | Attending + 1 witness doctor | attending + signed_by group | Mandatory witness signature per MTP/MLC |

---

## Module: Lab orders (`/api/lab/orders/*`, `/api/lab/results/*`)

| Action | Permission | Default | Scope | Why |
|---|---|---|---|---|
| List lab orders | `lab.orders.list` | Doctor, lab_tech | **Resource-scoped** view (ordering_provider / dept_member) | Doctor sees orders they placed; tech sees orders for their lab |
| Create lab order | `lab.orders.create` | Doctor | view on patient | |
| Cancel order | `lab.orders.update` | ordering_provider only | `cancel` permission (= ordering_provider) | Only the ordering doc can cancel |
| Add results | `lab.results.create` | lab_tech | dept_member of lab dept | Tech in lab can add results, even if not ordering provider |
| Verify results | `lab.results.update` | lab_tech (senior) + audit_officer | edit + group_member of `lab_seniors` | NABL critical-value workflow |
| Amend results | `lab.results.amend` | Senior tech only | group_member of `lab_seniors` | Amendments are auditable |
| Lab catalog | `lab.tests.list` | Tenant-wide read | Tenant-wide | Reference data, no PHI |
| QC results | `lab.qc.list` | lab_tech, audit_officer | Tenant-wide read; mutate requires `lab.qc.manage` | NABL 7.3 quality control |

---

## Module: Pharmacy (`/api/pharmacy/orders/*`, `/api/pharmacy/stock/*`)

| Action | Permission | Default | Scope | Why |
|---|---|---|---|---|
| List pharmacy orders | `pharmacy.orders.list` | Pharmacist, doctor, billing | **Resource-scoped** view (prescriber / dept_member of dispensing dept) | Pharmacist sees their dispensary's orders only |
| Create order | `pharmacy.orders.create` | Doctor, pharmacist (OTC) | view on patient | |
| Dispense order | `pharmacy.dispensing.dispense` | Pharmacist | `dispense` permission (dept_member of dispensing dept) | Only on-shift pharmacist dispenses |
| Cancel order | `pharmacy.orders.update` | Prescriber only | `cancel` (= prescriber) | Prescription privilege |
| Stock — view | `pharmacy.stock.list` | Pharmacist, audit_officer | Tenant-wide | Inventory data, no PHI |
| Stock — write | `pharmacy.stock.manage` | Pharmacist | Tenant-wide (admin within their dispensary by separate scope on dispensary_id) | Standard inventory ops |
| NDPS register | `pharmacy.ndps.list` | Pharmacist (controlled-substances), audit_officer | Tenant-wide for audit; entries require dual-sign | NDPS Act schedule X |
| OTC sale | `pharmacy.pos.create` | Pharmacist, billing_clerk | Tenant-wide (no patient) | Walk-in retail |
| Returns | `pharmacy.returns.create` | Pharmacist | view on the source order | |

---

## Module: Radiology (`/api/radiology/orders/*`)

| Action | Permission | Default | Scope | Why |
|---|---|---|---|---|
| List radiology orders | `radiology.orders.list` | Doctor, radiology_tech | **Resource-scoped** view (ordering_provider / dept_member) | |
| Create order | `radiology.orders.create` | Doctor | view on patient | |
| Modify modality slot | `radiology.scheduling.update` | Radiology coordinator | dept_member of radiology | |
| Read images (DICOM) | `radiology.images.view` | Ordering doctor + radiologist | view + group_member of `radiologists` | DICOM viewer access |
| Reporting | `radiology.reports.create` | Radiologist only | group_member of `radiologists` | Final read |

---

## Module: Billing & invoices (`/api/billing/*`)

| Action | Permission | Default | Scope | Why |
|---|---|---|---|---|
| List invoices | `billing.invoices.list` | billing_clerk, doctor (own patient's bills only), patient | **Resource-scoped** view on `invoice:{id}` | Clerk sees their dept's invoices; doctor sees their patients' bills |
| Create invoice | `billing.invoices.create` | billing_clerk | view on patient | |
| Record payment | `billing.payments.create` | billing_clerk | `record_payment` (dept_member or owner) | Cash + card both auditable |
| Apply discount | `billing.invoices.update` | billing_clerk_senior + finance_manager | group_member of `billing_seniors` | Concession authority |
| Day close | `billing.day_close.execute` | billing_clerk | Tenant-wide once per shift | EOD reconciliation |
| Write-off | `billing.write_off.execute` | finance_manager | group_member of `finance_committee` | NABH 6.3 financial governance |
| Charge master | `billing.charge_master.list` | All billing roles | Tenant-wide | Reference data |
| Reports (P&L, MIS) | `billing.reports.view` | finance_manager, audit_officer | Tenant-wide | C-suite read |

---

## Module: Emergency / MLC (`/api/emergency/*`, `/api/mlc/*`)

| Action | Permission | Default | Scope | Why |
|---|---|---|---|---|
| Triage | `emergency.triage.create` | ER nurse, ER doctor | dept_member of ER | |
| Code blue activation | `emergency.code_blue.activate` | Any clinical | dept_member of any clinical dept | Speed > permission; logged + reviewed post-event |
| MLC documentation | `emergency.mlc.create` | ER doctor + audit_officer | attending on encounter + group_member of `mlc_signatories` | IPC § 39 mandatory reporting |
| Police intimation | `emergency.mlc.update` | Audit officer + admin only | group_member of `mlc_signatories` | Sensitive interaction with law enforcement |
| Death certificate | `emergency.death_certificate.create` | Attending + medical_director | attending + group_member of `death_certificate_signers` | MTP/MCB act |

---

## Module: Consents (`/api/consent/*`)

| Action | Permission | Default | Scope | Why |
|---|---|---|---|---|
| Capture consent | `consent.create` | Any clinical | view on patient | |
| Read consent | `consent.view` | Any clinical | view on patient | |
| Revoke consent | `consent.revoke` | Patient (via portal) + medical_director | Special: patient-self-grant tuple | DPDP § 11 right to withdraw |
| Audit trail of consents | `consent.audit.view` | audit_officer | Tenant-wide read | NABH compliance |

---

## Module: Documents / clinical notes (`/api/documents/*`)

| Action | Permission | Default | Scope | Why |
|---|---|---|---|---|
| List documents | `documents.list` | All clinical | **Resource-scoped** view on `clinical_document:{id}` | Notes carry attending-only locks |
| Sign document | `documents.sign` | Attending doctor | `sign` permission (attending) | Sign once; thereafter immutable |
| Print/export | `documents.export` | Attending + medical_director | view + group_member of `print_authorized` | Watermark every export, log download in audit |
| Delete (drafts only) | `documents.delete` | Owner only | `delete` permission | Signed docs are immutable |

---

## Module: Setup / Admin (`/api/setup/*`, `/api/admin/*`)

| Action | Permission | Default | Scope | Why |
|---|---|---|---|---|
| User CRUD | `admin.users.{list,view,create,update,delete}` | hospital_admin, IT admin | Bypass | Onboarding |
| Role CRUD | `admin.roles.*` | hospital_admin | Bypass | |
| Group CRUD | `admin.groups.*` | hospital_admin | Bypass | |
| Force logout | `admin.users.force_logout` | hospital_admin, security_officer | Bypass | Stolen-device incident response |
| Sharing — manage all | `admin.sharing.manage` | hospital_admin | Bypass | Override owner-only sharing |
| Audit log read | `admin.audit.list` | audit_officer, hospital_admin | Tenant-wide read; export gated by group | NABH compliance officer |
| Department CRUD | `admin.departments.*` | hospital_admin | Bypass | |
| Tenant config | `admin.config.*` | hospital_admin | Bypass | |

---

## Module: Integration / Pipelines (`/api/integration/*`)

| Action | Permission | Default | Scope | Why |
|---|---|---|---|---|
| List pipelines | `integration.list` | facilities_manager, IT admin | **Resource-scoped** view on `pipeline:{id}` (creator/runner/viewer) | Multi-author safety |
| Create pipeline | `integration.create` | IT admin + group_member of `integrations_admin` | Group-scoped | Pipelines can move data — must be deliberate |
| Edit pipeline | `integration.update` | Creator only | `edit` permission (creator) | |
| Delete pipeline | `integration.delete` | Creator + admin | `delete` (creator) | |
| Execute pipeline | `integration.execute` | runner relation OR creator | `run` permission | Group `pipeline_runners` carries this |
| View run history | `integration.history.view` | viewer + runner + creator | `view` permission | |
| Test connection | `integration.test_connection` | IT admin | Tenant-wide | Sandbox call |

**Why so strict on pipelines**: a misconfigured pipeline can exfiltrate patient data to a third-party endpoint. Treat like database access.

---

## Module: Reports / analytics (`/api/analytics/*`, `/api/dashboard/*`)

| Action | Permission | Default | Scope | Why |
|---|---|---|---|---|
| Dashboard widgets | `dashboard.view` | All roles | **Resource-scoped** widgets — see only data the user can see | Reuses module list filters |
| Module-specific analytics | `<module>.analytics.view` | Manager roles | Tenant-wide aggregates only (no patient names/phones in response) | Aggregate ≠ PHI per HIPAA Safe Harbor when bucket > 5 |
| Export to CSV | `<module>.export` | Manager + group `data_exporters` | Tenant-wide; logged with watermark | DPDP audit |
| Custom queries (BI) | `analytics.bi.run` | analyst + group `bi_users` | Read-replica connection only | Performance isolation |

---

## Module: TV displays / Public boards (`/api/tv/*`)

| Action | Permission | Default | Scope | Why |
|---|---|---|---|---|
| Queue board | `tv.queue.view` | Anonymous (no auth) | Tenant-wide masked (token + first name only) | Public-facing display |
| Bed availability board | `tv.beds.view` | Anonymous | Tenant-wide masked (counts only, no patient details) | |
| Code blue alert | `tv.alerts.view` | All clinical | dept_member | Internal staff display only |

---

## Module: Patient portal / mobile (`/api/portal/*`)

| Action | Permission | Default | Scope | Why |
|---|---|---|---|---|
| View own records | `portal.records.view` | Patient himself | Special: `viewer` tuple where subject = patient's user_id | Patient is the strongest viewer |
| Share with family | `portal.records.share` | Patient himself | grant `viewer` tuple to family member's user account | DPDP nominee right |
| Book appointment | `portal.appointments.create` | Patient himself | Tenant-wide (limited slots) | |
| Pay bill | `portal.payments.create` | Patient himself | view on invoice (auto-granted at invoice create) | |
| Request consent revocation | `portal.consent.revoke` | Patient himself | `delete` on consent tuple | DPDP § 11 |

---

## Cross-cutting rules

### "Read your own data" — always allowed
A user always holds `viewer` on records where they're the subject (e.g. their own employee profile, their own login history). Encoded via `user:{id}#viewer@user:{id}` self-grant.

### "Break-glass" emergency override
- ER doctor can hold `emergency_override` group membership for a 4-hour shift
- Grants temporary `editor` on every patient currently in the ER
- Auto-expires; audited; reviewed weekly by audit_officer

### "Need-to-know" tightening
For VIP / political / sensitive patients (`patients.is_vip = true`), the default `dept_member` rule is suspended — only `attending` + explicit shares apply. Prevents internal leaks.

### "Minor" cases (under 18)
Parental/guardian consent must be present (`patient_consents.consent_status = 'granted'` for relation). Without consent, even `viewer` is denied for non-emergency reads. Enforced by SpiceDB caveat `requires_minor_consent`.

### Auditor read-everything
`audit_officer` role gets `viewer` on every clinical resource via a special seeded tuple `*:*#viewer@role:audit_officer`. Read-only; cannot mutate. Used by compliance.

### Cross-tenant sharing
Currently disabled. When ABDM HIE rolls out, patient-mediated tuples like `patient:{id}#viewer@external_provider:{npi}` will be supported via `external_provider` definition (added when needed; not in current schema).

---

## Phase 3 ordering by risk

When wiring endpoints to the rebac resolver in Phase 3, do them in this order — riskiest first (so a missed wire is caught early):

1. **Patient list/detail** — biggest PHI surface
2. **Lab/pharmacy/radiology orders** — clinical mutation
3. **Admissions** — multi-relation (attending + ward + dept)
4. **Billing invoices** — financial data
5. **Documents** — print/export side
6. **Encounters / OPD queue** — high-volume
7. **Pipelines** — admin surface, smaller blast radius

Each wave: write Playwright tests **first** asserting the deny path, then the allow path, then ship the handler change.

## Verification

For every row in this matrix, the test plan in Phase 9 has at least one Playwright spec asserting:
- A user **with** the role can perform the action when the scope matches (allow path)
- A user **without** the role gets 403
- A user **with** the role but failing the scope rule gets 404 on detail / empty list / 403 on mutate
- An attempt logs a row in `audit_log`

These tests live under `apps/web/e2e/rbac/<module>/<action>.spec.ts`.
