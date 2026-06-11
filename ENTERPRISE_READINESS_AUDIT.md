# MedBrains HMS — Enterprise Readiness Audit (2026-06-11)

Full-system audit: UI/UX, backend, database, infrastructure, security, module linkages, journeys, SOPs, configuration.

**Overall: ~50% enterprise-ready. Suitable for pilot/demo. NOT production-ready for 24/7 hospital without remediation below.**

---

## P0 — CRITICAL (block go-live)

### Security
| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 1 | JWT Ed25519 keypair auto-generated when env keys missing — prod restart invalidates ALL sessions silently | `medbrains-server/src/config.rs:186-306` | Fail startup in production if `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` unset |
| 2 | Hardcoded seed credentials: `admin/admin123`, `doctor123`, `test123` | `seed/mod.rs:77`, `seed/demo_patients.rs:18-62` | Gate seed behind `MEDBRAINS_ALLOW_SEED=true`; force password change on first login |
| 3 | SSH open to 0.0.0.0/0 on EC2 security group | `infra/terraform/modules/standalone-vm/aws-ec2/main.tf:106-112` | Restrict to operator IPs or SSM Session Manager |
| 4 | Secrets committed: GitHub PAT + AWS creds in `.env` files in git | `medbrains/.env:33`, `infra/.env:15-26` | Rotate PAT NOW; move to Secrets Manager; gitignore |
| 5 | No MFA for staff (HIPAA/NIST requirement) | — | TOTP/SMS MFA, mandatory for doctor/admin |
| 6 | No per-account lockout — brute-force possible across IPs (only per-IP rate limit) | `routes/auth.rs` login | Add `failed_login_attempts` + `locked_until` to users |
| 7 | No password reset / forgot-password flow | — | Email/SMS time-limited reset tokens |

### Database
| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 8 | 44 of 612 tenant tables MISSING RLS — cross-tenant leak risk: `backup_history`, `cross_hospital_appointments`, `inter_hospital_stock_transfers`, 6 camp tables, `iam_access_requests`, `lab_sample_routes`, `patient_transfers`, 32 `relation_tuples_p*` partitions | migrations 0001, 0053, 0117, 0120, 0028, 0011, 0003 | ENABLE RLS + tenant policy on each |

### Backend
| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 9 | Bridge heartbeat UPDATE without tenant scope — cross-tenant agent hijack | `routes/devices.rs:585-600` | Add `WHERE tenant_id = $2` |
| 10 | Unbounded `fetch_all()` no LIMIT — ~40+ list endpoints, worst: pharmacy_dispense_ops (3), ambulance (5), bedside_portal (3), analytics | systemic, ~1,180 fetch_all calls | Default pagination + LIMIT everywhere |
| 11 | `setup.rs` update_tenant/get_tenant lack `require_permission`; ~30 of 100 setup handlers unchecked | `routes/setup.rs:72-180` | Add permission checks |

### Infra
| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 12 | Single EC2, single AZ, no LB, no auto-recovery, Postgres in docker on single EBS — instance death = hospital down | `standalone-vm/aws-ec2/main.tf` | CloudWatch StatusCheckFailed alarm + recovery; document Starter limits; Growth tier for prod |
| 13 | Root EBS deleted on instance termination (no `delete_on_termination=false`) — data loss | `aws-ec2/main.tf:150-161` | Set flag; separate data volume |
| 14 | Zero CloudWatch alarms — downtime/disk-full unnoticed | terraform (no alarms) | StatusCheck, CPU>80%, disk>80%, 5xx alarms |
| 15 | Terraform state local for standalone/alagappa — no lock, no encryption | `envs/standalone/alagappa/main.tf:25-27` | S3 + DynamoDB backend |

### Clinical safety
| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 16 | Lab critical value alert = WebSocket only. No SMS/email/pager to doctor, no ack workflow | `routes/lab.rs:1115-1140` | SMS gateway + on-call lookup + delivery retry + acknowledgment |
| 17 | NABH/JCI checklists (34 depts, 700+ criteria in RFC) NOT implemented; no surgical safety checklist; no incident escalation (IPSG) | — | Build checklist schema + templates |

### Frontend
| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 18 | 25+ mutations across OPD/Pharmacy/Emergency missing `onError` — failures silent | `opd.tsx:1083-1199`, pharmacy.tsx, emergency.tsx | Add onError + toast everywhere |
| 19 | 15+ destructive actions (delete/void/cancel) without confirmation dialog | `billing.tsx:2554`, `ipd.tsx:3006`, pharmacy.tsx | `modals.openConfirmModal` wrap |

---

## P1 — HIGH (revenue, reliability, compliance)

### Revenue leakage (module linkages)
- **No auto room-rent billing on IPD admission** — daily bed charges manual (`ipd.rs`). ~3 day fix.
- **No invoice finalization on IPD discharge** — discharge checklist exists (`ipd_post_discharge.rs:69+`) but billing settlement manual.
- **Appointment reminders stored, never delivered** — `appointments/reminders.rs:24+`, no SMS/email job. 30-40% no-show cost.
- **TPA pre-auth not enforced at billing** — charges created regardless of authorization (`billing.rs:366+`); claim denials.
- **Appointment check-in does not create OPD queue entry** — manual receptionist step.
- **No billing-line auto-reversal on clinical cancellation** — manual reversal only (0112 backbone exists).

### Backend
- Multi-step billing flows (auto_charge invoice+items+history) need transaction audit — partial-write orphan risk (`billing.rs:270-420`).
- Rate limiting on login only — analytics/exports/lists unthrottled (`middleware/rate_limit.rs:20-26`).
- No graceful shutdown — SIGTERM aborts in-flight transactions (`main.rs:432`).
- Pharmacy substitution/coverage-override mutations lack audit log entries (`pharmacy_dispense_ops.rs:46-253`).
- IDOR: handlers rely solely on RLS, no application-level ownership check (`print_data.rs:30-70`).
- List endpoints (GET /patients) NOT audited — mass PHI export untracked (`middleware/audit.rs:51-52`). HIPAA read-tracking gap.
- Data retention configured but never enforced — no purge job (`routes/security.rs`, `routes/mrd.rs`).
- Public booking matches patient by name+phone — collision books into wrong record (`appointments/public.rs:31`). Need OTP verify.

### Database
- 58 tenant tables zero indexes; only 178/612 have (tenant_id, status) composite.
- 286 JSONB columns, 0 GIN indexes — full scans on JSON queries.
- ~1,600 of ~2,000 FK columns unindexed — slow joins/cascades.
- `payments`, `billing_audit_log` missing `updated_at`.
- ~36 status TEXT columns without CHECK constraints — invalid states insertable.
- 50+ log/event tables unpartitioned, no archival — unbounded growth.
- Soft-delete inconsistent; deleted rows not filtered in RLS policies.

### Infra/deploy
- No rollback mechanism — `make ship-cold` fails mid-deploy = stuck (`Makefile:544-551`).
- No pre-deploy DB backup gate; migrations embedded in app startup, no separate migrate stage.
- No blue/green — binary swap + restart = downtime, crash = outage.
- systemd `Restart=on-failure` without `StartLimitBurst` — crash loop thrashing (`medbrains-server.service:14`).
- No log rotation (journald unbounded) — disk fills silently.
- No uptime monitoring/synthetics on /api/health.
- No terraform plan in CI — drift undetected.
- Untested restore path for pg backups — restore drill never run.
- IAM/instance over-permissioning on backup bucket.

### Frontend
- ~100 of 142 pages don't render query error state — blank tables on API failure.
- 92 files exceed 450-line rule. Worst: `billing.tsx` 8,684, `ipd.tsx` 7,341, `pharmacy.tsx` 6,907, `opd.tsx` 6,512, `emergency.tsx` 6,032.
- API responses unvalidated — 1 Zod safeParse in 142 pages.
- Raw backend error strings shown to users (8 pages).

### Onboarding blocker
- **No bulk import for lab catalog (1000+ tests) / pharmacy formulary (5000+ drugs)** — single-record CRUD only = 6-12 weeks manual entry per hospital. CSV/Excel ETL needed (~1 week build).

---

## P2 — MEDIUM

### Workflow engine = dormant
- `workflow_templates`/`workflow_instances`/`workflow_step_logs` tables exist (0001_core.sql:4865-4909) but **0 templates seeded, no rules engine, no UI**. Only IPD discharge uses step logs. RFC-002 promises 120+ templates — not delivered. Clinical events use hardcoded pipelines (`orchestration/default_pipelines.rs`) instead.
- Form builder: `form_templates` schema exists, no builder UI.
- Handover SOP: shift summary only, no structured checklist (`nurse_handoff.rs`).

### Notifications mostly missing (1 wired, 8 missing)
Missing: low-stock alert to pharmacist, lab-report-ready to patient, invoice-issued, claim-approved, prescription expiry, incident escalation, patient SMS for token call. WebSocket infra exists, delivery channels (SMS/email) don't.

### Configuration gaps
- YottaDB 7-layer config NOT implemented — flat `tenant_settings` KV in Postgres instead (CLAUDE.md aspirational).
- Not configurable via UI: working hours/holidays, queue rules, lab critical thresholds, shift definitions, auto-billing toggles, invoice print template, consent form templates, drug formulations.
- Procurement PO numbers not sequence-driven (manual entry).
- No config export/import between environments.

### Journeys untested
- IPD discharge → invoice finalization (E2E gap)
- Maternity delivery + newborn registration
- Emergency MLC → police notification (compliance)
- Radiology study→report→notify, ward handover, bedside portal

### Backend/security medium
- Audit logging split: billing logs to custom table not central audit_log.
- Bypass roles (super_admin/hospital_admin) — no granular audit of what they touched.
- No field-level encryption for sensitive PII.
- Input validation: note fields no length limits, quantities no range checks.
- Bridge agent registration not idempotent — duplicate agents.
- Health check shallow — no pool stats, no auth latency.
- Test coverage: 85 Rust tests for ~125 route files; pharmacy/billing/lab integration untested. 175 E2E specs (good). No `cargo audit`/`npm audit` in CI.

### Infra medium
- t4g CPU credit exhaustion unmonitored; 40GB root volume small; pool max=20 may exhaust; no systemd resource limits; no APM/tracing backend; no slow-query logging; no WAF; no incident runbook/on-call; docker-compose dev/prod divergence; Pingora TLS min version unverified; cert renewal hooks fail silently.

### Frontend medium
- ~40 hardcoded English strings bypass i18n (pharmacy 25+, opd 15+).
- Missing skeletons (60+ tables), empty states (110+ pages).
- Optimistic updates only 3 pages; no offline banner; sparse retry config.

---

## SCORES

| Area | Score |
|------|-------|
| Frontend stability | 6/10 |
| Backend | 6/10 |
| Database | 7/10 (93% RLS, good types; index/partition gaps) |
| Infra/deploy | 4/10 (pilot-grade) |
| Security/auth | 6/10 (strong token design; missing MFA/lockout/reset) |
| Module linkages | 5.5/10 |
| Journeys (E2E) | 7/10 |
| Workflow/SOP engine | 2.5/10 (dormant) |
| Configuration/onboarding | 6/10 |
| Notifications | 2/10 |

## STRENGTHS (keep)
- Refresh-token rotation with family reuse detection, httpOnly cookies, perm_version invalidation — strong session design
- Security headers comprehensive (HSTS, CSP, COOP), strict CORS
- Auto-charge billing with idempotency + source traceability
- FEFO stock decrement atomic in dispense transaction
- 93% RLS coverage, money as NUMERIC, timestamptz everywhere
- Golden patient journey E2E (reg→OPD→lab→pharmacy→billing→IPD→discharge→MRD)
- 175 E2E specs, RBAC matrix tests
- S3 backups with 5y Object Lock

## SUGGESTED SEQUENCE
1. **Week 1**: Rotate leaked PAT; lock SSH; JWT key startup validation; seed gate; RLS on 44 tables; CloudWatch alarms; EBS retention flag; TF state→S3.
2. **Weeks 2-4**: Account lockout + password reset; mutation onError + confirm dialogs; LIMIT on all lists; auto room-rent + discharge billing; appointment reminders delivery; critical-value SMS.
3. **Weeks 5-8**: MFA; bulk catalog import; pre-auth enforcement; rollback + blue/green deploy; index/GIN backfill; log partitioning; audit consolidation.
4. **Weeks 9-12**: NABH checklists; workflow engine activation or removal decision; notification fan-out (low stock, report ready); config UI gaps; file-size refactors.

---

# PART 2 — MODULE COMPLETENESS (round 2 scans)

## Forms & Printables — 80% (print) / 15% (form builder)
- **146 print endpoints**, configurable per-tenant templates, digital signatures, watermarks, QR — strong. Covers Rx, GST invoice, lab/radiology reports, discharge, consents (surgical/anesthesia/HIV/blood), wristband, MLC, OT notes, MAR, vitals chart.
- **Print infra = browser print → PDF only.** No server-side PDF (no Puppeteer/wkhtmltopdf) → no batch print, no auto-email documents. MEDIUM.
- **Thermal ZPL/ESC-POS not implemented** — format enum exists, no code gen. Label/wristband printing can't drive real thermal printers. MEDIUM.
- **Pharmacy dispensing label**: struct defined, NO endpoint. HIGH (pharmacist workflow).
- **Print job daemon missing** — `print_jobs` table queues but no worker delivers to printers.
- **Form builder = scaffolding only.** `form_masters`/`form_fields`/regulatory-link schema exists (0007_forms.sql, form.rs) but ZERO routes, no builder UI, no runtime rendering. All 30+ clinical forms hardcoded TSX — no per-hospital customization. Birth/death cert statutory format not enforced. NABL report format not enforced.
- Document mgmt (MRD): upload/versioning/audit wired; no full-text search, no patient document portal, retention not auto-enforced.

## Devices & PACS — lab 70% / PACS 5% / bedside 20%
- **Lab analyzer HL7 v2**: bridge crate `medbrains-bridge` has working MLLP listener, ORU parsing, sample-barcode→lab_order matching, auto result post, SQLite buffer + retry. ASTM (Sysmex serial) = adapter config only, no active parser. **Missing QC hold/recheck/supervisor-approval workflow — regulatory gap.** MEDIUM-HIGH.
- **PACS/DICOM = CRITICAL gap.** `radiology_dicom_studies` table + Orthanc adapter fixture only. No live C-STORE listener, no modality worklist (MWL) from orders, no OHIF/Cornerstone viewer embed (links only), no DICOM metadata parsing. Zero production imaging integration. 4-6 wk effort.
- **Device bridge**: registration/heartbeat/buffer work; 40+ device categories enumerated. BUT no deployment/update docs, no credential rotation, file-drop transport unimplemented, capabilities schema undefined. Bridge heartbeat cross-tenant bug (see P0 #9). MEDIUM-HIGH.
- **Bedside/ICU**: vitals = manual nurse entry only. No ICU monitor HL7 feed, no ventilator/infusion-pump integration, no real-time vitals push, no device-param alerting. bedside_portal = education/nurse-call UI only. HIGH for ICU go-live.
- **FHIR R4**: read-only Patient/Encounter/$everything wired (ABDM HIP role). Missing DiagnosticReport (lab/radiology) — ABDM interop blocker. No write/transaction Bundle. HIGH.
- **ABDM**: ABHA OTP linking + HFR registration work; scan-share missing. **NHCX claims**: submission outbox-wired + callback handler done. **HL7 outbound = stub.**
- Payment (Razorpay) gateway works incl webhook. Barcode scanner/queue-TV/kiosk/RFID/biometric = schema-only.

## Operational/support modules — 82% (15 of 19 working)
- **WORKING**: OT (34 ep, WHO checklist, anesthesia record), Blood Bank (34 ep, D&C XII-B), CSSD, Housekeeping+Linen, Diet/Kitchen, Ambulance, BME/Assets, Security/Visitor, Queue+TV (WebSocket), HR/Duty-roster, Camp/Outreach (44 ep — most mature), Infection Control (HAI+BMW), Grievance/Feedback, Mobile app (26 screens), TV app (8 screens).
- **PARTIAL**: Mortuary (body admit/storage exists, no death-cert linkage), Kiosk (check-in API, no dedicated UI).
- **MISSING/CRITICAL**: **Telemedicine — zero implementation** (no routes/UI/schema). Regulatory + COVID-era expectation. Ambulance→billing linkage unverified.
- CSSD/OT expiry-alert workflows absent (compliance).

## Specialized clinical departments — 58% (6 of 13 working)
- **WORKING**: Psychiatry (HAM-D/BPRS/GAF, ECT register, seclusion/restraint, MHRB — MHCA 2017), Oncology (chemo protocols/cycles/tumor board), Cardiology (cath lab, STEMI door-to-balloon, hemodynamics), Maternity (ANC, partograph, labor, APGAR, postnatal), Gastro/Endoscopy (scope reprocessing HLD, biopsy chain-of-custody), Physiotherapy/PMR.
- **PARTIAL**: ENT (audiometry table only, no endoscopy/imaging), Nephrology/Dialysis (sessions+KT/V but **no machine scheduling, no dialyzer reuse tracking — compliance gap**), Pediatrics/NICU (scattered, no growth charts/immunization/NICU protocols).
- **MISSING**: Ophthalmology (no vision/refraction/spectacle), Dermatology (none).
- **STUB**: Dental (odontogram print template only, no charting/imaging/consent backend — CRITICAL given dental is a common OP revenue line), Medical College (20+ print stubs, no student/faculty/rotation/exam CRUD).
- Maternity missing PCPNDT auto-form (mandatory India).

## Asset management & linkages — 60% (12 of 20 working)
- **WORKING**: asset register, barcode tagging, department allocation (`department_id` FK), PM schedules, calibration tracking, breakdown→work-order, AMC/CMC contracts (SLA), service history, vendor linkage, uptime/downtime capture.
- **PARTIAL/STUB/MISSING**: 
  - **Portable asset reservation MISSING** — can't book/share ventilator, portable X-ray, ultrasound across departments. CRITICAL for surge/resource pooling.
  - **Asset→OT procedure linkage** — OT room has equipment JSONB but no FK, no charge capture on equipment use, no implant→asset link. HIGH.
  - **Asset transfer workflow = stub** — manual department_id edit, no approval/audit/downtime log. HIGH.
  - **Depreciation/ROI = missing** — no capital P&L modeling.
  - **Spare parts master = partial** — free-text on breakdown, not linked to equipment or auto-ordered. HIGH.
  - **Device-bridge↔asset link = stub** — `devices` and `bme_equipment` tables unlinked (medical-device vs BME-lifecycle taxonomies separate).
  - **Equipment→biomedical-waste linkage missing.**
  - MTBF/uptig%/cost-per-case analytics defined in types but not computed/displayed.

## Integrations / automation / ETL / portals — mixed
- **Backbone WORKING**: transactional outbox (`medbrains-outbox`, DLQ, retry, stale-reaper), tokio job queue (`job_queue`, FOR UPDATE SKIP LOCKED, exp backoff, dead-letter), cron scheduler (`scheduled_jobs`, 60s poll). 6 hardcoded event-driven pipelines (discharge→bed-dirty+SMS, dispense→NDPS+low-stock, lab-critical→SMS, invoice→WhatsApp, payment→email-receipt, encounter→confirm-SMS).
- **Connectors PARTIAL**: Razorpay + Twilio SMS working; **SMTP email = STUB, WhatsApp = STUB, ABDM connector = stub, Tally ERP = stub.** Outbox handlers registered but several return "queued" without delivering. → **email receipts/discharge docs won't actually send. HIGH.**
- **ETL**: bulk import (locations/departments/users) wired. **No bulk import for lab catalog / drug formulary / patients / tariffs / ICD — onboarding blocker (6-12 wk manual entry).** ERP export = formatted-but-not-sent stub. No legacy-HMS migration tooling.
- **API keys / OAuth = MISSING entirely.** No third-party key issuance/scope/revoke, no OAuth server, no OpenAPI spec, no outbound webhooks (inbound NHCX + Razorpay only). CRITICAL for any external integration.
- **External portals**: patient (mobile app, same JWT — no scope isolation), bedside portal (partial). Vendor/supplier, Insurance/TPA, **Lab B2B (`lab_b2b_clients` table)**, Corporate/employer = SCHEMA-ONLY, no self-service routes. Doctor referral portal = missing.
- **Public web**: appointment booking (public.rs) + CMS public posts work.
- **Procurement automation**: low-stock event fires but **no auto-indent creation**; indent→PO→GRN→payment chain manual; no approval workflow state machine.

## Content / Learning / Marketing / Research / Reporting
- **LMS — 85% WORKING** (best of this group): course catalog, modules, quizzes (MCQ/TF/fill), enrollment+progress, certificates, learning paths, role-based bulk assignment, lms.tsx wired. Gaps: CME credit system (FK only), SCORM player, content/video upload (URL-only), compliance-completion dashboard.
- **Analytics/Reports — 75% WORKING**: 9+ live operational reports (dept/doctor revenue, IPD census, lab TAT, pharmacy sales, OT utilization, ER volume, clinical indicators, OPD footfall, bed occupancy), 50+ report catalog with permissions/readiness tiers, ECharts viz, CSV export, NABH indicators. Gaps: **no custom report builder**, no scheduled/emailed reports, **financial reports incomplete (no P&L, daybook, GST returns, TDS, AR/AP aging)**, drill-down UX unclear.
- **CMS/Newsletter — 5% STUB**: schema complete (11 tables, medical-review workflow) but **all CRUD routes return 501 NOT_IMPLEMENTED.** No email campaign engine, no templates, no delivery/open/click analytics. Newsletter = subscriber table only.
- **Marketing/CRM — 0% MISSING**: no leads, segments, campaigns, patient recall/reminders, referral-source ROI, loyalty/packages, corporate B2B. Entire stack absent.
- **Research — 5% STUB**: `research_studies`/`research_enrollments` referenced in print code but **schema never migrated.** Consent type 'research' exists; no protocol/CRF/IRB/cohort/de-identification.

---

# PART 3 — UI/UX GAPS (consolidated)

Systemic, repeated across many pages (not one-offs):

**Error/empty/loading UX**
- **~100 of 142 pages don't render a query error state** — table goes blank on API failure, no retry. HIGH.
- **25+ mutations (OPD/pharmacy/emergency) have no `onError`** — failures silent, no toast. CRITICAL.
- Raw backend error strings shown to users on 8 pages (untranslated, technical).
- Missing skeletons on 60+ tables (layout shift); missing empty-state UI on 110+ pages (blank = ambiguous: empty vs error vs loading).

**Safety/destructive UX**
- **15+ delete/void/cancel actions fire with no confirmation dialog** (billing, ipd, pharmacy) — accidental permanent deletes. CRITICAL.

**Consistency/i18n**
- ~40 hardcoded English strings in notifications bypass i18n (pharmacy 25+, opd 15+) — non-English users see English in critical flows.
- Optimistic updates on only 3 pages; rest feel laggy on common status changes.

**Maintainability (UI debt)**
- **92 files exceed the 450-line rule.** Worst: billing.tsx 8,684 · ipd.tsx 7,341 · pharmacy.tsx 6,907 · opd.tsx 6,512 · emergency.tsx 6,032 · lab.tsx 5,634. Mega-components → hard to test/review, re-render cost.

**Type-safety UX risk**
- Only 1 Zod `safeParse` across 142 pages — API responses unvalidated at runtime; shape drift renders silently wrong.

**Resilience UX**
- No offline/API-down banner; sparse retry config; navigator.onLine not surfaced.

**Permissions (mostly good)**
- 139 of 142 pages correctly call `useRequirePermission`; action buttons largely gated. Minor: some permission checks recomputed per-render instead of memoized.

**Accessibility**
- Mantine gives baseline aria; custom ActionIcons/menus miss labels in spots (opd.tsx call button, billing action menus). Some custom tables lack arrow-key nav.

---

# PART 4 — OVERALL MODULE SCORECARD

| Domain | Ready % |
|--------|---------|
| Core clinical (OPD/IPD/Lab/Pharmacy/Billing) | ~75% |
| Operational/support (OT/Blood/CSSD/HK/Diet/HR/BME/Security/Camp/IC) | 82% |
| Print/documents | 80% |
| Analytics/Reports | 75% |
| LMS/Training | 85% |
| Specialized departments | 58% |
| Asset management | 60% |
| Devices — lab HL7 | 70% |
| Config/onboarding | 60% |
| Module linkages/journeys | 55% |
| Component reuse (shared UI library adoption) | ~55% |
| Integration backbone (outbox/jobs) | 80% |
| Connectors (email/WhatsApp/ERP delivery) | 40% |
| Forms builder | 15% |
| Notifications delivery (SMS/email fan-out) | 20% |
| CMS/Newsletter | 5% |
| Research | 5% |
| Devices — PACS/DICOM | 5% |
| Marketing/CRM | 0% |
| Telemedicine | 0% |
| API keys/OAuth/external API | 0% |

**Pattern: infrastructure and schema are consistently strong; last-mile delivery (actual SMS/email send, PACS wiring, bulk import, form-builder runtime, CMS handlers, portals) is consistently the gap.** Many modules are "schema + routes done, real-world connection missing."

---

# PART 5 — COMPONENT LIBRARY & PATTERNS (scan re-run 2026-06-11)

Component reuse: ~55%. Shared library exists and is good (DataTable, PageHeader, StatusBadge, StatCard, inputs/) — adoption is the gap.

| # | Finding | Severity | Files | Consolidation |
|---|---------|----------|-------|---------------|
| 1 | Inline status→color maps duplicated (`statusColors`/`STATUS_COLORS`/`COLOR` records); 1,043+ `<Badge color=...>` instances across 81 files. `StatusBadge.tsx` has a statusMap but only 4 pages use it | HIGH | 45 | Extend `components/StatusBadge.tsx` map per domain; replace inline maps |
| 2 | Raw Mantine `<Table>` instead of shared `DataTable` — 194+ duplicated column-def arrays, inconsistent pagination/sorting. Only 85/142 pages on DataTable | HIGH | 48 | Migrate to `components/DataTable.tsx` (already supports virtualization, permissions, field access) |
| 3 | Form modal scaffolding duplicated — 286 zodResolver calls, identical RHF+Zod modal blocks repeated 3-5× per mega-page (billing/ipd/pharmacy/emergency) | MED | 37 | `<FormModal>` wrapper or `useFormModal` hook; ~15-20% LOC cut in mega-files |
| 4 | Modal/Drawer + notification boilerplate — 748 inline `notifications.show` calls; 47 pages with 3+ `useDisclosure` | MED | 47 | `showNotification(type, title, msg)` helper in `lib/`; standard dialog components |
| 5 | Formatter duplication — local `formatDate`/`formatMoney`/`formatTime` despite `lib/date-utils.ts` existing | MED | 26 | Add `formatMoney`/`formatPercent`/`formatBytes` to lib; replace local copies |
| 6 | `StatCard` used in only 2 pages; 132 pages hand-roll stat cards with raw `<Card withBorder>` | MED | 132 | Promote `StatCard` adoption |
| 7 | useMutation + invalidateQueries boilerplate — 448 invalidate calls, identical pattern | LOW-MED | 86 | Shared `useCRUDMutation(queryKey)` hook |
| 8 | Field-access predicates (`access === "edit"` etc.) redefined per page | LOW | 70+ | `lib/field-access-utils.ts` with `canEditField`/`canViewField` |

**Good pattern**: PageHeader — 194 references, well adopted. No action.

Top 3 by leverage: status-map consolidation (2-3d), DataTable migration (3-5d), FormModal extraction (2d).
