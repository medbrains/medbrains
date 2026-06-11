---
module: system-settings
priority: P0
status: draft
---

# SOP: System Settings & Configuration

## Overview
System Settings is the administrative backbone of MedBrains. It covers the initial setup and ongoing configuration of a tenant's operational parameters: tenant profile, department/ward/room setup, user and role management, permission matrix editing, integration credentials (PACS, payment gateways, ABDM, SMS, email), billing masters (rate cards, tax codes, GST configuration), clinical masters (drug formulary, lab catalog, ICD catalog), and system-wide notifications and thresholds. Configuration follows the 7-layer hierarchy: Global → Tenant → Campus → Building → Floor → Department → User.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `super_admin` | All settings across all tenants | Multi-tenant platform level |
| `hospital_admin` | All settings for their tenant | Tenant-scoped |
| `hr_officer` | User account creation, role assignment | Staff management only |
| `billing_clerk` | Billing masters (rate cards, tax codes) | Billing config only |
| `scheduling_admin` | OPD schedule templates, slot configuration | Scheduling masters only |

---

## Scenario 1: Hospital Admin Configures New Tenant (Initial Onboarding) — Actor: Hospital Admin / Super Admin

**Actor**: `super_admin` (creates tenant) then `hospital_admin` (completes setup)  
**Entry point**: Admin → Onboarding → New Hospital Setup  
**Preconditions**: Hospital has signed contract; subdomain/tenant slug assigned

**Steps**:
1. **Super Admin** creates tenant record: hospital name, slug (URL prefix), contact details, GSTIN, NABH accreditation number (if applicable), empanelment codes (CGHS, Ayushman Bharat).
2. **Hospital Admin** logs in to their tenant for the first time; guided setup wizard launches.
3. **Step 1 — Organisation structure**:
   - Adds campuses, buildings, floors.
   - Creates departments (OPD Surgery, OPD Medicine, IPD Ward A, ICU, OT, Lab, Pharmacy, etc.).
   - Assigns department types (OPD / IPD / Diagnostic / Support / Admin).
4. **Step 2 — Beds and rooms**:
   - Adds beds per ward: bed number, ward, room type (General / Semi-Private / Private / ICU), features (oxygen point, ventilator outlet, call button).
   - Initial bed status: `available`.
5. **Step 3 — Doctors and staff**:
   - Bulk-imports or manually creates user accounts.
   - Assigns roles (doctor, nurse, billing_clerk, etc.) and departments.
6. **Step 4 — Clinical masters**:
   - Drug formulary: imports from national formulary or uploads custom list (INN name, ATC code, schedule flag, AWaRe category).
   - Lab test catalog: imports standard tests with LOINC codes, reference ranges (age/sex-adjusted).
   - ICD-10 catalog: loaded by default; tenant can configure favourites.
7. **Step 5 — Billing masters**:
   - Consultation fees per doctor (OPD) and per department.
   - Lab, pharmacy, radiology rate cards.
   - Room charges per bed type per day.
   - GST rates per service category.
8. **Step 6 — Integrations**: see Scenario 2 for PACS; see `28-pacs-dicom.md` for detailed PACS setup.
9. Completes wizard → system runs validation: checks all mandatory masters are populated.
10. Activates tenant → system is live.

**Exit / Outcome**: Tenant fully configured; all departments, beds, users, and masters set up; system ready for patient registration.  
**Regulatory note**: Clinical Establishments Act 2010 — registration number, bed count, and department details must match physical setup; GSTIN mandatory for billing; NDPS register number required for pharmacy controlled substances.  
**Existing test**: `apps/web/e2e/scenarios/admin-setup.spec.ts` (partial); `— needs full onboarding wizard journey test`

---

## Scenario 2: Hospital Admin Manages Roles and Permission Matrix — Actor: Hospital Admin

**Actor**: `hospital_admin`  
**Entry point**: Admin → Roles & Permissions  
**Preconditions**: Tenant onboarded; default 11 system roles seeded

**Steps**:
1. Admin opens Roles page; sees 11 built-in roles (cannot be deleted — `is_system = true`).
2. Views permission tree for a built-in role (e.g., `nurse`): accordion tree of 111 permissions organised by module.
3. Creates a **custom role** (e.g., "Senior Nurse" with additional billing read access):
   - Clicks "New Role"; enters role name, description.
   - Opens permission tree; checks applicable permissions.
   - Saves; custom role available for assignment.
4. Assigns custom role to user(s).
5. **Per-user override**: opens a specific user record → Permission Overrides drawer.
   - Adds extra permissions (green — granted beyond role): e.g., grant billing.view to a doctor.
   - Adds denied permissions (red — revoked despite role): e.g., deny admin.users.list for a restricted admin.
6. System resolves effective permissions: `(role_permissions ∪ extra) − denied`.
7. Bypass roles (`super_admin`, `hospital_admin`) — system returns `true` for all checks; override tree not shown (not needed).

**Exit / Outcome**: Custom roles created; per-user permission overrides applied; effective permissions live immediately (no cache expiry needed).  
**Regulatory note**: NABH — role-based access control documented; IT Act 2000 §43A — access to sensitive patient data restricted to authorised personnel; audit log records all permission changes.  
**Existing test**: `apps/web/e2e/rbac/role-blocking.spec.ts` (automated — permission enforcement tested); `— needs role creation + override workflow test`

---

## Scenario 3: Admin Configures Notification Thresholds and Alerts — Actor: Hospital Admin

**Actor**: `hospital_admin`  
**Entry point**: Admin → System Settings → Notifications & Thresholds  
**Preconditions**: Tenant active; clinical and operational modules in use

**Steps**:
1. Admin opens Notifications settings; configures threshold values:
   - **Critical lab values**: defines panic ranges per test (e.g., K⁺ < 2.5 or > 6.5 mEq/L triggers critical alert).
   - **TAT thresholds**: lab Routine ≤240 min, Urgent ≤120 min, STAT ≤60 min.
   - **Bed dirty SLA**: housekeeping task auto-escalation after X minutes (default 90 min).
   - **Low stock alert**: pharmacy stock below X days of average consumption.
   - **Near-expiry alert**: items expiring within Y days.
   - **LOS outlier alert**: IPD patients beyond GMLOS × 1.5.
2. Configures delivery channels per alert type: in-app only / SMS / email / all.
3. Configures escalation chain: primary recipient → if unacknowledged in X minutes → escalate to secondary.
4. Tests a notification by triggering a test alert (dry run — does not affect live data).
5. Saves; thresholds take effect immediately.

**Exit / Outcome**: Alert thresholds and escalation chains configured; notification channels active; test alert confirmed.  
**Regulatory note**: NABH LAB.7 — critical value notification TAT configured; NABH MOM.6 — low-stock alerts; IPSG Goal 2 — escalation chain for critical communications.  
**Existing test**: `— needs test`

---

## Scenario 4: Admin Configures Integration Credentials — Actor: Hospital Admin

**Actor**: `hospital_admin`  
**Entry point**: Admin → Integrations  
**Preconditions**: Third-party service accounts available (ABDM, SMS gateway, payment gateway, email SMTP)

**Steps**:
1. Admin opens Integrations panel; sees all available integrations with status (configured / not configured).
2. **SMS Gateway** (MSG91 / Exotel / Twilio):
   - Enters API key, sender ID (registered DLT sender for India).
   - Tests by sending test SMS to admin mobile.
3. **Email (SMTP)**:
   - Enters SMTP host, port, credentials, from-address.
   - Tests by sending test email.
4. **Payment Gateway** (Razorpay / PayU):
   - Enters API key + secret (stored encrypted at rest — never displayed in plain text after save).
   - Configures webhook URL (auto-generated by system) → pasted into payment gateway dashboard.
   - Tests with a ₹1 test transaction (refunded automatically).
5. **ABDM Health ID**:
   - Enters facility CMC ID, HRP credentials.
   - Links to ABHA certificate generation workflow.
6. **PACS**: see `28-pacs-dicom.md` for detailed PACS integration SOP.
7. All credentials stored in encrypted secrets store; audit log records who configured what and when (values not logged).

**Exit / Outcome**: All active integrations configured and tested; credentials encrypted; audit trail of configuration changes.  
**Regulatory note**: IT Act 2000 §43A — sensitive credentials (API keys, passwords) encrypted at rest; PCI-DSS — payment gateway keys must not be stored in plain text; ABDM — facility registration via NDHM portal before MedBrains integration.  
**Existing test**: `— needs test`
