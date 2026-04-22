# MedBrains API Integration Audit Report

**Date:** 2026-04-06
**Scope:** Frontend ↔ Backend API contract, type contracts, UI coverage, permission guards

---

## Executive Summary

| Check | Result | Details |
|-------|--------|---------|
| API Contract (frontend ↔ backend routes) | **FAIL** | 28 missing in backend, 41 missing in frontend |
| UI ↔ API Coverage | **FAIL** | 331 unused API methods, 1 missing reference |
| Type Contract (TS ↔ Rust) | **FAIL** | 70 errors (required fields missing), 221 type mismatches |
| Permission Guards | **WARN** | 1 module page missing `useRequirePermission` guard |
| Overall Matched | 1,413 / 1,454 | 97.2% route coverage (good baseline) |

---

## 1. Frontend API Methods Missing Backend Routes (28)

These methods exist in `client.ts` but have **no matching route** in the Rust backend. The frontend will get 404s if these are called.

### OT Module (10 gaps — most affected)

| Method | Path | Issue |
|--------|------|-------|
| `deleteSurgeonPreference` | `DELETE /api/ot/preferences/{id}` | Path mismatch — backend uses `/api/ot/surgeon-preferences/{id}` |
| `listSurgeonPreferences` | `GET /api/ot/preferences` | Path mismatch — backend uses `/api/ot/surgeon-preferences` |
| `createSurgeonPreference` | `POST /api/ot/preferences` | Path mismatch — backend uses `/api/ot/surgeon-preferences` |
| `updateSurgeonPreference` | `PUT /api/ot/preferences/{id}` | Path mismatch — backend uses `/api/ot/surgeon-preferences/{id}` |
| `listSafetyChecklists` | `GET /api/ot/bookings/{id}/safety-checklist` | Path mismatch — backend uses `/api/ot/bookings/{id}/checklists` |
| `createSafetyChecklist` | `POST /api/ot/bookings/{id}/safety-checklist` | Path mismatch — backend uses `/api/ot/bookings/{id}/checklists` |
| `updateSafetyChecklist` | `PUT /api/ot/bookings/{id}/safety-checklist/{id}` | Path mismatch — backend uses `/api/ot/bookings/{id}/checklists/{id}` |
| `cancelOtBooking` | `PUT /api/ot/bookings/{id}/cancel` | Missing route entirely |
| `updatePreopAssessment` | `PUT /api/ot/bookings/{id}/preop/{id}` | Backend uses `PUT .../preop` (no nested ID) |
| `updateAnesthesiaRecord` | `PUT /api/ot/bookings/{id}/anesthesia/{id}` | Backend uses `PUT .../anesthesia` (no nested ID) |

**Root Cause:** OT module has systematic path naming divergence between frontend and backend.

### ICU Module (3 gaps)

| Method | Path | Issue |
|--------|------|-------|
| `removeIcuDevice` | `DELETE /api/icu/admissions/{id}/devices/{id}` | Missing backend route |
| `listIcuBundleChecks` | `GET /api/icu/devices/{id}/bundle-checks` | Path mismatch — backend nests under admissions |
| `createIcuBundleCheck` | `POST /api/icu/devices/{id}/bundle-checks` | Path mismatch — backend nests under admissions |

### IPD Module (3 gaps)

| Method | Path | Issue |
|--------|------|-------|
| `expectedDischarges` | `GET /api/ipd/discharges/expected` | Missing backend route |
| `initDischargeChecklist` | `POST /api/ipd/admissions/{id}/discharge-checklist/init` | Backend uses `POST .../discharge-checklist` (no `/init`) |
| `bedTransfer` | `POST /api/ipd/admissions/{id}/transfer` | Missing backend route |

### Pharmacy Module (3 gaps)

| Method | Path | Issue |
|--------|------|-------|
| `prescriptionAudit` | `GET /api/pharmacy/prescriptions/{id}/audit` | Missing backend route |
| `checkDrugInteractions` | `POST /api/pharmacy/interactions/check` | Missing backend route |
| `formularyCheck` | `POST /api/pharmacy/formulary/check` | Missing backend route |

### Analytics Endpoints (5 gaps — pattern issue)

| Method | Path | Issue |
|--------|------|-------|
| `campAnalytics` | `GET /api/camps/analytics` | Missing backend route |
| `campReport` | `GET /api/camps/{id}/report` | Missing backend route |
| `energyAnalytics` | `GET /api/facilities/energy/analytics` | Missing backend route |
| `visitorAnalytics` | `GET /api/front-office/analytics` | Missing backend route |
| `queueMetrics` | `GET /api/front-office/queue/metrics` | Missing backend route |

### Scheduling (1 gap)

| Method | Path | Issue |
|--------|------|-------|
| `scheduleAnalytics` | `GET /api/scheduling/analytics` | Backend uses `/api/scheduling/analytics/overview` |

### Facilities (1 gap)

| Method | Path | Issue |
|--------|------|-------|
| `schedulePm` | `POST /api/facilities/pm/schedule` | Missing backend route |

### OT Sub-record Updates (2 gaps)

| Method | Path | Issue |
|--------|------|-------|
| `updateCaseRecord` | `PUT /api/ot/bookings/{id}/case-record/{id}` | Backend uses no nested ID |
| `updatePostopRecord` | `PUT /api/ot/bookings/{id}/postop/{id}` | Backend uses no nested ID |

---

## 2. Backend Routes Missing Frontend API Methods (41)

These routes exist in `mod.rs` but **no frontend method calls them**. They are dead backend code or the frontend hasn't been wired up yet.

### Patient Sub-Resources (8 gaps)

| Route | Issue |
|-------|-------|
| `GET /api/patients/{id}/insurance` | No frontend method |
| `POST /api/patients/{id}/insurance` | No frontend method |
| `PUT /api/patients/{id}/insurance/{id}` | No frontend method |
| `DELETE /api/patients/{id}/insurance/{id}` | No frontend method |
| `PUT /api/patients/{id}/addresses/{id}` | No frontend method |
| `PUT /api/patients/{id}/contacts/{id}` | No frontend method |
| `PUT /api/patients/{id}/identifiers/{id}` | No frontend method |
| `PUT /api/patients/{id}/allergies/{id}` | No frontend method |

**Impact:** Patient insurance CRUD, address/contact/identifier updates, and allergy edits are backend-only — frontend can't use them.

### OT Surgeon Preferences (mirrored from Section 1)

Backend has `/api/ot/surgeon-preferences/*` but frontend calls `/api/ot/preferences/*` — both sides have routes, they just don't match.

### Documents/Print System (4 gaps)

| Route | Issue |
|-------|-------|
| `GET /api/documents/printers` | No frontend method |
| `POST /api/documents/printers` | No frontend method |
| `GET /api/documents/print-jobs` | No frontend method |
| `PUT /api/documents/print-jobs/{id}` | No frontend method |

### Auth (1 gap)

| Route | Issue |
|-------|-------|
| `POST /api/auth/refresh` | No frontend method — token refresh not implemented client-side |

### Other Notable Gaps

| Route | Issue |
|-------|-------|
| `POST /api/emergency/visits/{id}/admit` | ER→IPD admission not wired |
| `POST /api/quality/indicators/{id}/calculate` | Quality KPI calculation not wired |
| `POST /api/quality/committees/{id}/auto-schedule` | Committee scheduling not wired |
| `POST /api/integration/node-templates` | Integration builder template creation not wired |
| `POST /api/housekeeping/bmw/sharp-replacement` | Sharp container replacement not wired |
| `GET /api/lab/critical-alerts/doctor/{id}` | Doctor-specific critical alerts not wired |
| `GET /api/radiology/appointments` | Radiology appointment listing not wired |
| `POST /api/radiology/appointments` | Radiology appointment creation not wired |
| `GET /api/setup/config/export` | Config export not wired |
| `GET /api/module-forms/{id}` | Individual module form fetch not wired |

---

## 3. Unused API Methods (331 total)

331 API methods are defined in `client.ts` but **never referenced from any page**. Top categories:

- **Admin/widget/screen builder methods** — many CRUD methods for dashboards, widgets, screens
- **Sub-record operations** — acknowledge, batch, complete actions for various modules
- **Specialty module methods** — audiology, cytology, neonatal, rehabilitation, transplant
- **Advanced features** — polypharmacy checks, dual insurance coordination, bed reservations/turnarounds
- **Clinical documentation** — biopsy specimens, ANC visits, discharge meds

**Recommendation:** Either wire these into pages or remove them to reduce dead code. Many likely belong in sub-components or dialogs that haven't been built yet.

---

## 4. Type Contract Issues (70 errors, 221 warnings)

### Critical Errors: Required Rust Fields Missing in TypeScript (70)

These will cause **runtime deserialization failures** — the backend sends fields the frontend doesn't expect, or the frontend omits required fields.

**Most affected types:**

| Type | Missing Fields |
|------|---------------|
| `IpdNursingAssessment` | 9 fields (admission_id, tenant_id, pain_assessment, fall_risk, skin, respiratory, elimination, assessed_at, updated_at) |
| `IpdClinicalAssessment` | 5 fields |
| `IpdHandoverReport` | 5 fields |
| `IpdCarePlan` | 7 fields |
| `IpdMedicationAdministration` | 6 fields |
| `IpdProgressNote` | 2 fields |
| `ReconciliationReport` | 4 fields |
| `BedDashboardRow` | 3 fields |
| `CreateReferralRequest` | 3 fields |
| `CreateEnrollmentRequest` | 1 field |
| `FieldMaster` | 2 fields (created_at, updated_at) |
| `Vital` | 1 field (recorded_at) |
| `Facility` | 1 field (config) |

### Type Mismatches (221 warnings)

Common patterns:

- **Decimal vs string**: Financial fields (amounts, prices) are `Decimal` in Rust but `string` in TS — causes JSON parse issues
- **serde_json::Value vs typed interfaces**: Backend uses generic JSON, frontend expects typed objects (e.g., `PhysicalExamination`, `ReviewOfSystems`, `WidgetDataSource`)
- **String enums**: Backend uses `String` for enum-like fields, frontend uses proper TypeScript enums (e.g., `LabReportStatus`, `FormStatus`, `AppointmentType`)
- **Missing optional fields**: `bed_status` field name in WardBedRow differs between Rust and TS (`bed_status` vs `status`)
- **User type**: `password_hash` required in Rust but correctly absent in TS (should be excluded from API responses)

---

## 5. Permission Guard Coverage

| Category | Count | Status |
|----------|-------|--------|
| Module pages with `useRequirePermission` | 57 | OK |
| Pages correctly excluded (login, landing, onboarding, index) | 20 | OK |
| **Missing guards** | **1** | `pg-logbook.tsx` — needs permission guard |

---

## 6. Recommended Fix Priority

### P0 — Fix Immediately (breaks functionality)

1. **OT module path mismatches** (10 routes) — frontend and backend use different path conventions. Standardize to backend paths.
2. **IPD discharge checklist path** (`/init` suffix mismatch)
3. **ICU bundle check path** (nesting mismatch)
4. **Auth token refresh** — `POST /api/auth/refresh` has no frontend method. Session expiry will break silently.
5. **70 required Rust fields missing in TS** — will cause runtime crashes on IPD nursing, clinical assessments, care plans, etc.

### P1 — Fix Soon (missing features)

6. **Patient sub-resource CRUD** (8 methods) — insurance, address, contact, identifier, allergy updates not wired
7. **Pharmacy safety checks** — drug interactions, formulary check, prescription audit not wired
8. **Analytics endpoints** (5 methods) — camps, facilities, front-office, scheduling analytics not routed
9. **Print system** (4 methods) — printer management and print jobs not wired
10. **ER→IPD admission** — emergency admit-to-inpatient flow not wired
11. **Radiology appointments** — listing and creation not wired

### P2 — Clean Up (tech debt)

12. **331 unused API methods** — audit and either wire or remove
13. **221 type mismatches** — standardize Decimal handling, enum typing
14. **pg-logbook.tsx** — add permission guard
15. **admin.rs** — skeleton file (1 line), should be removed or implemented

---

## 7. Quick Reference: All 28+41 = 69 Integration Gaps

```
CATEGORY                COUNT   IMPACT
OT path mismatches      10      Frontend 404s on OT operations
Backend-only patient    8       Can't edit patient sub-records from UI
Analytics missing       5       No analytics dashboards
Print system unwired    4       No print management from UI
Pharmacy safety         3       No drug interaction/formulary checks
ICU path mismatches     3       Frontend 404s on ICU devices
IPD path mismatches     3       Discharge/transfer broken
Radiology unwired       2       Can't manage radiology appointments
Quality unwired         2       KPI calculation, committee scheduling
Auth refresh            1       Silent session expiry
ER admit unwired        1       Can't admit from ER to IPD
Other unwired           27      Various features not accessible from UI
```

---

*Generated by running `make check-all` (check-api, check-ui-api, check-types) plus manual permission audit.*
