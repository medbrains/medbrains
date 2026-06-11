---
module: analytics-reports
priority: P0
status: draft
---

# SOP: Analytics & Reports

## Overview
The Analytics module provides structured reporting across five domains visible in the application: OPD/Bed utilisation, IPD Census, Lab TAT, and Revenue. Each tab aggregates data from transactional modules and presents trend charts, pivot tables, and downloadable exports. Reports serve hospital management for operational decisions, billing for revenue cycle review, quality for NABH indicator tracking, and finance for board-level reporting. Data is computed on-demand from PostgreSQL aggregation queries and cached per tenant per time window.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `hospital_admin` | All tabs, all departments, export all formats | Full cross-department access |
| `billing_clerk` | Revenue tab, billing summary reports | Finance-scoped |
| `quality_officer` | Clinical tab, Lab TAT tab, quality indicator exports | Clinical quality-scoped |
| `audit_officer` | Read-only access to all tabs | No export of PHI without explicit approval |
| Department head (`doctor`) | Their department's data only (OPD/IPD panels) | Dept-scoped |

---

## Scenario 1: Hospital Admin Reviews OPD & Bed Utilisation — Actor: Hospital Admin

**Actor**: `hospital_admin`  
**Entry point**: Analytics → OPD/Bed tab  
**Preconditions**: OPD encounters and IPD admissions exist for the selected period

**Steps**:
1. Admin opens OPD/Bed tab; selects date range (default: current month).
2. Views OPD metrics:
   - Total new registrations vs revisits (trend line).
   - Patients by department (bar chart).
   - Average wait time OPD (registration → doctor).
   - No-show rate by doctor.
3. Views Bed metrics:
   - Average daily bed occupancy % by ward.
   - Average Length of Stay (ALOS) by ward and diagnosis group.
   - Bed turnover ratio (discharges per bed per period).
4. Drills into a specific ward → sees patient-level breakdown (anonymised for general admin; identifiable for clinical admin).
5. Exports report as PDF or Excel for management committee meeting.

**Exit / Outcome**: OPD volume trends and bed utilisation KPIs visible; report exported for governance.  
**Regulatory note**: NABH AAC.1 — patient flow metrics; MOHFW HMIS — monthly OPD/IPD statistics submitted to district health office; data export must not include PHI in aggregate reports sent externally.  
**Existing test**: `— needs test`

---

## Scenario 2: Billing Clerk Reviews Revenue Cycle Report — Actor: Billing Clerk

**Actor**: `billing_clerk`  
**Entry point**: Analytics → Revenue tab  
**Preconditions**: Billing transactions exist for the period

**Steps**:
1. Billing clerk opens Revenue tab; selects period (daily / weekly / monthly).
2. Views:
   - **Collections by payment mode**: cash, card, UPI, insurance settlement, corporate credit.
   - **Payer mix**: % self-pay vs TPA vs CGHS vs corporate vs Ayushman Bharat.
   - **Outstanding receivables**: pending insurance claims by TPA name and age (0–30, 31–60, 60–90, 90+ days).
   - **Revenue by department**: OPD, IPD, Lab, Pharmacy, Radiology contribution.
   - **Refund rate**: refunds issued as % of total collection.
3. Identifies high-outstanding TPA bucket; escalates to insurance officer.
4. Generates daily collection summary for finance head (auto-scheduled or manual export).
5. Compares current month vs prior month vs same month last year (YoY trend).

**Exit / Outcome**: Revenue KPIs reviewed; outstanding claims escalated; collection report exported.  
**Regulatory note**: GST Act — revenue data must reconcile with GSTR-1 filings; CGHS/TPA — outstanding claim age drives follow-up priority; internal audit — daily collection reconciliation against POS/bank statements.  
**Existing test**: `— needs test`

---

## Scenario 3: Quality Officer Pulls Lab TAT Compliance Report — Actor: Quality Officer

**Actor**: `quality_officer`  
**Entry point**: Analytics → Lab TAT tab  
**Preconditions**: Lab orders and results exist for the period; TAT targets configured per order urgency

**Steps**:
1. Quality officer opens Lab TAT tab; selects period and filter by urgency (Routine / Urgent / STAT).
2. Views:
   - **TAT distribution histogram**: x = TAT in minutes, y = % of orders.
   - **% within target**: Routine ≤240 min, Urgent ≤120 min, STAT ≤60 min (configurable per tenant).
   - **Worst offenders**: tests or departments with highest TAT breach rate.
   - **Critical value notification TAT**: time from result entry to doctor acknowledgement.
3. Drills into "STAT breaches" → sees individual orders with timestamps (order placed → sample received → result entered → released).
4. Identifies bottleneck stage (e.g., sample collection delay vs analysis delay vs reporting delay).
5. Generates NABH LAB.7 compliance report; attaches to quality indicator log.

**Exit / Outcome**: Lab TAT compliance quantified per urgency tier; bottleneck stage identified; NABH LAB.7 report generated.  
**Regulatory note**: NABH LAB.7 — critical value TAT ≤30 min; NABL ISO 15189 §5.10 — TAT monitored and reported; lab accreditation renewal requires TAT compliance evidence.  
**Existing test**: `— needs test`

---

## Scenario 4: Admin Generates Clinical Outcomes Report — Actor: Hospital Admin

**Actor**: `hospital_admin`  
**Entry point**: Analytics → Clinical tab  
**Preconditions**: IPD data with diagnosis codes (ICD-10) and outcomes exists

**Steps**:
1. Admin opens Clinical tab; selects period and filter by department / diagnosis group.
2. Views:
   - **Mortality rate** by ward and diagnosis (per 100 discharges).
   - **Readmission rate** (unplanned readmissions within 30 days).
   - **Surgical complication rate** (linked to OT module — post-op adverse events).
   - **C-section rate** (Maternity — NABH and FOGSI benchmark).
   - **Hospital-acquired infection rate** (from Infection Control module).
3. Benchmarks against NABH national targets and prior-period performance.
4. Flags indicators in red (above acceptable threshold); creates quality action note.
5. Exports clinical outcome summary for Medical Audit Committee meeting (quarterly).

**Exit / Outcome**: Clinical outcome indicators benchmarked; non-compliant indicators flagged; Medical Audit Committee report exported.  
**Regulatory note**: NABH QPS.2 — clinical outcome indicators monitored; MOHFW — maternal mortality, neonatal mortality reportable; C-section rate monitored (FOGSI recommendation ≤ 20–25%); ICMR — HAI rates submitted to national AMR surveillance.  
**Existing test**: `— needs test`
