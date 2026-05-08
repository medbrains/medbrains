# Screen-walkthrough issue registry

Source of truth for everything found during the per-screen walk-through (Track 0.alpha). One row per issue. When fixed, flip `Status` → `Closed` and tick the matching checkbox in the screen file.

## Severity rubric

- **P0** — blocks a core flow (can't admit, can't dispense, can't bill)
- **P1** — broken UX with workaround (filter doesn't filter, button needs double-click)
- **P2** — cosmetic / paper-cut (date in 1970 default, toast says "Saved" twice)

## Pre-walk known issues (from static audit, this session)

| # | Page | Sev | Summary | Repro / fix-hint | Status |
|---|------|-----|---------|------------------|--------|
| 001 | `billing.tsx` | P1 | `deletePackage DELETE /api/billing/packages/{id}` — false-positive from audit_screens.py path-param normalization | Verified registered at `mod.rs:1010` | Closed |
| 002 | `billing.tsx` | P1 | `deleteRatePlan DELETE /api/billing/rate-plans/{id}` — false-positive | Verified at `mod.rs:1020` | Closed |
| 003 | `consent.tsx` | P1 | `deleteConsentTemplate` — false-positive | Verified registered | Closed |
| 004 | `documents.tsx` | P1 | `deleteDocumentTemplate` — false-positive | Verified registered | Closed |
| 005 | `ipd.tsx` | P1 | `bedTransfer POST /api/ipd/admissions/{id}/transfer` — false-positive | Verified registered | Closed |
| 006 | `ipd.tsx` | P1 | `updateDischargeSummary PUT /api/ipd/admissions/{id}/discharge-summary` — false-positive | Verified registered | Closed |
| 007 | `ipd.tsx` | P1 | `updateDischargeTat PUT /api/ipd/admissions/{id}/discharge-tat` — false-positive | Verified registered | Closed |
| 008 | `lab.tsx` | P1 | `deleteLabPanel` — false-positive | Verified registered | Closed |
| 009 | `ot.tsx` | P1 | `updatePostopRecord PUT /api/ot/bookings/{id}/postop` — false-positive | Verified registered | Closed |
| 010 | `ot.tsx` | P1 | `updatePreopAssessment PUT /api/ot/bookings/{id}/preop` — false-positive | Verified registered | Closed |
| 011 | `pharmacy.tsx` | P1 | `getPosDaySummary GET /api/pharmacy/pos/day-summary` — false-positive | Verified registered | Closed |
| 012 | `security.tsx` | P1 | `updateSecurityIncident` — false-positive | Verified registered | Closed |
| 013 | `order-sets.tsx` | P1 | `deleteOrderSetTemplate` — false-positive | Verified registered | Closed |
| 014 | `admin/devices.tsx` | P1 | `deleteRoutingRule` — false-positive | Verified registered | Closed |
| 015 | `lms.tsx` | P1 | `lmsComplianceOverview GET /api/lms/compliance` — false-positive | Verified registered | Closed |
| 016 | `lms.tsx` | P1 | `myLmsCertificates GET /api/lms/my/certificates` — false-positive | Verified registered | Closed |
| 017 | `tv-displays.tsx` | P1 | `deleteTvDisplay` — false-positive | Verified registered | Closed |
| ⓘ | `scripts/audit_screens.py` | P2 | Path normalization + chained handler scan fixed | Now: 0 RED, 44 AMBER (all real). | Closed |
| 005a | `client.ts:bedTransfer` | P0 | HTTP method mismatch — frontend POST, backend PUT → 405 silently | Fixed: switched to PUT (this turn) | Closed |
| 070 | `migrations/0107_ipd_discharge_tat_logs.sql` | P0 | FK references `ipd_admissions` but actual table is `admissions` — server crashloops at migration | Fixed via sed (this turn). Same bug in 0108 fixed earlier. | Closed |
| 071 | `scripts/check_migrations.py` | P1 | Pre-deploy grep for known-bad table names + idempotency + duplicate tables/enums + NOW()-in-index | Built (this turn). Wired into `make check-all`. Found 5 issues immediately. | Closed |
| 072 | `migrations/0059_device_pairing.sql` | P1 | `CREATE POLICY paired_devices_tenant_isolation` without preceding DROP POLICY IF EXISTS → re-apply will fail | Add `DROP POLICY IF EXISTS paired_devices_tenant_isolation ON paired_devices;` before CREATE | Open |
| 073 | `migrations/0060_object_storage_lifecycle.sql` | P1 | Same pattern, 2 policies (`object_storage_transitions_tenant_isolation`, `object_storage_policies_tenant_isolation`) | Add 2 DROP POLICY IF EXISTS lines | Open |
| 074 | `migrations/0103_dlt_templates.sql` | P1 | Same pattern, `dlt_templates_tenant_isolation` | Add DROP POLICY IF EXISTS | Open |
| 075 | `migrations/0106_audit_partitioning.sql` | P0 | Creates `audit_log` table — already created in 0004 | False alarm — 0106 first renames `audit_log` → `audit_log_legacy` then recreates as partitioned. Script now allowlists `RENAME TO _legacy` pattern. | Closed |
| 076 | `migrations/0072,0078,0083,...` (54 files) | P2 | Bulk soft issues: missing IF NOT EXISTS / DROP POLICY IF EXISTS — historical baseline of 632 issues, ratchet active. New code blocked. | Track 0.gamma cleanup PR can knock these out one file at a time **only on fresh-DB-only repos** — editing already-applied migrations breaks `sqlx::migrate!` with VersionMismatch. Confirmed empirically. Script `idempotent_migrations.py` now has `--force` guard. | Open |
| 077 | `scripts/idempotent_migrations.py` | P0 | Original sweep edited 56 already-applied migrations → live DB rejected redeploy with VersionMismatch(1). Reverted via git restore. | Script now skips files in `.migrations_applied.json` by default. Must run `make db-mark-applied` to seed the list before running. | Closed |
| 018 | `admin/users.tsx` | P1 | Page exposes user data without `useRequirePermission` guard | Add `useRequirePermission(P.ADMIN.USERS.LIST)` at top | Open |
| 019 | 31 admin/settings pages | P1 | No permission guards | Add `useRequirePermission` per settings tab | Open |
| 020 | 11 onboarding pages | P2 | No permission guards (probably intentional during setup, but verify gating at App.tsx level) | Audit App.tsx route definition | Open |
| 021 | `admin/settings/MasterDataStatusSettings.tsx` | P2 | API refs without `useQuery`/`useMutation` (race-condition risk) | Wrap calls in React Query | Open |
| 022 | `admin/settings/SetupWizardSettings.tsx` | P2 | Same | Same | Open |
| 023 | 4 onboarding step pages | P2 | API refs without useQuery — direct fetch in wizard submit. **Intentional design** for sequential setup wizard; not a race-condition risk because each step is exclusive. | Audit accepts as intentional. | Closed |

## Known issues from this session's user reports

| # | Page | Sev | Summary | Repro / fix-hint | Status |
|---|------|-----|---------|------------------|--------|
| 050 | `pharmacy.tsx` (Returns / dispense) | P0 | "Pharmacy can add order without stock" — fixed via stock pre-check in `create_order_in_tx` (this session) | Verify post-deploy | Pending verify |
| 051 | `pharmacy.tsx` (consumption report) | P1 | "Consumption report not affected after order" — fixed by switching filter to `dispensed_at` | Verify post-deploy | Pending verify |
| 052 | `pharmacy.tsx` (Credit Notes label) | P2 | Renamed "Credit Notes" → "Returns" (this session) | Verify visible | Pending verify |
| 053 | `CreditNotesTab.tsx` (auto-fill) | P1 | Selecting previous order didn't fill drug name — fixed via synthetic option injection (this session) | Verify post-deploy | Pending verify |
| 054 | `pharmacy.tsx` (order detail) | P2 | Batch + expiry not shown on order detail — added (this session) | Verify post-deploy | Pending verify |
| 055 | `Patient/PatientRegisterForm.tsx` | P0 | Allergies field marked required — fixed (this session) | Verify post-deploy | Pending verify |
| 056 | `Patient/PatientRegisterForm.tsx` | P1 | Drug-allergy field separated from general allergies — added (this session) | Verify post-deploy | Pending verify |
| 057 | `Patient/PatientRegisterForm.tsx` | P2 | New VIP/multi-specialty fields (next-of-kin, dietary, room class, etc.) added (this session) | Verify post-deploy | Pending verify |
| 058 | `ipd.tsx` (drawer header) | P1 | Only 3 actions visible; many missing — Actions menu added with DAMA + Death (this session) | Verify post-deploy | Pending verify |
| 059 | `ipd.tsx` (drawer header) | P1 | Wristband / Transfer-out modals — Phase B | Wristband + TransferOut shipped (this turn). Quick Rx/Lab/Imaging shortcuts + Send-to-mortuary + Attendant-pass + floating Code-Blue still pending. | Partial |
| 060 | OPD/IPD diagnosis | P1 | "ICD codes and SNOMED codes are missing" — _need user clarification on which screen_ | DiagnosisPanel exists in OPD; verify catalog seeded; verify embedded in IPD | Open |
| 061 | OPD consultation | P1 | "Consultation summary notes should be day-based, why only entered apart history notes?" — _need user clarification_ | Either day-based notes per encounter or day-based for OPD revisits | Open |

---

## Dead-component candidates (from `scripts/check_dead_components.py`)

| # | Path | Sev | Action | Status |
|---|------|-----|--------|--------|
| 100 | `apps/web/src/components/PatientRegistrationForm.tsx` | P2 | Confirm dead vs `Patient/PatientRegisterForm.tsx` (current); delete | Open |
| 101 | `apps/web/src/components/DocumentPreview/PrintButton.tsx` | P2 | Verify zero importers, delete | Open |
| 102 | `apps/web/src/components/DocumentPreview/DocumentHistory.tsx` | P2 | Verify, delete | Open |
| 103 | `apps/web/src/components/Clinical/MedicationScheduleCard.tsx` | P2 | Verify, delete | Open |
| 104 | `apps/web/src/components/Clinical/VitalSparkline.tsx` | P2 | Verify, delete | Open |
| 105 | `apps/web/src/components/Clinical/MedAdherenceTimeline.tsx` | P2 | Verify, delete | Open |
| 106 | `apps/web/src/components/Clinical/DrugInteractionMatrix.tsx` | P2 | Verify, delete | Open |
| 107 | `apps/web/src/hooks/useFieldDataSource.ts` | P2 | Verify, delete | Open |

---

_Add new rows below. Auto-generation feeds new rows in via `scripts/gen_screen_checklist.py --append-issues` (TODO)._
