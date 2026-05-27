# MedBrains Enterprise Roadmap

> Production-ready Hospital Management System
> Last Updated: 2026-05-24

---

## Executive Summary

| Metric | Current | Target |
|--------|---------|--------|
| Features Complete | 35% (1,048/2,939) | 85% for MVP |
| Modules Ready | 35 of 67 | 50+ for launch |
| Timeline | - | 16 weeks to MVP |

---

## Phase 0: Foundation (Week 1-2)
**Goal: Production-grade infrastructure**

### 0.1 Testing Infrastructure
- [ ] Unit tests for type guards (guards.ts, primitives.ts)
- [ ] API contract tests (frontend ↔ backend)
- [ ] E2E smoke tests for critical paths
- [ ] CI/CD pipeline (GitHub Actions)

### 0.2 Security Hardening
- [ ] Input validation on all endpoints
- [ ] Rate limiting
- [ ] CSRF protection verification
- [ ] SQL injection audit
- [ ] Session management audit
- [ ] Audit trail completeness (29% → 80%)
- [ ] Delegated access policy: define who can request, approve, grant, revoke, and review normal/elevated access by org hierarchy, department, role, and risk tier

### 0.3 Error Handling & Monitoring
- [ ] Structured error responses
- [ ] Sentry/error tracking integration
- [ ] Health check endpoints
- [ ] Prometheus metrics
- [ ] Log aggregation (structured JSON)

### 0.4 Database
- [ ] Connection pooling optimization
- [ ] Query performance audit
- [ ] Backup/restore procedures
- [ ] Migration rollback testing

**Exit Criteria:** All tests green, monitoring live, security audit passed

---

## Phase 1: Clinical Core (Week 3-6)
**Goal: Complete patient care workflow**

### 1.1 Patient Journey (Complete)
- [x] Patient Registration (85%)
- [x] OPD Visit Flow (92%)
- [x] IPD Admission (94%)
- [x] Emergency (86%)
- [ ] Transfer between units
- [ ] Discharge workflow

### 1.2 Laboratory (64% → 95%)
- [ ] Sample collection workflow
- [ ] Result entry with validation
- [ ] Critical value alerts
- [ ] Report generation
- [ ] Lab analyzer integration layer: bridge-agent onboarding, HL7/ASTM/serial/TCP adapters, barcode/sample matching, OBX/result mapping, QC flags, critical-value escalation, retry/replay, and LIS result reconciliation
- [ ] Lab image and evidence capture: microscopy images, analyzer plots, scanned requisitions, specimen photos, PDFs, signed object storage, result linkage, verification/release status, doctor-view controls, and immutable access/export audit

### 1.3 Radiology (52% → 90%)
- [ ] Order management
- [ ] Worklist for technicians
- [ ] DICOM/PACS integration layer: modality worklist, DICOM router, C-STORE ingestion, DICOMweb/WADO image access, study/order reconciliation, signed viewer links, key images, report linkage, and audit-safe doctor viewing from OPD/IPD/ER
- [ ] Doctor diagnostics viewer: unified OPD/IPD/ER/patient timeline for lab results, lab evidence images, radiology reports, PACS studies, key images, critical alerts, and short-lived signed viewer sessions
- [ ] Report templates
- [ ] Device integration console for imaging and lab: hospital-LAN bridge agents, adapter catalog, modality/analyzer routing rules, connection tests, health/heartbeat, credential rotation, message quarantine, manual match/reprocess, and immutable ingest audit

### 1.4 Pharmacy (87% → 95%)
- [ ] Prescription verification
- [ ] Drug interaction checks
- [ ] Controlled substance tracking
- [ ] Return/expiry management
- [ ] Pharmacy billing and fast-dispatch redesign: research counter workflow thoroughly, then implement prescription-to-pharmacy queue, charge capture into billing, quick scan/dispatch, partial fills, substitutions, returns/refunds, batch/expiry enforcement, and insurance/TPA/accounting handoff without duplicate data entry
- [ ] Pharmacy IVR and omnichannel experience: refill requests, order readiness, pickup/delivery status, payment-link nudges, substitution approval, pharmacist callback queue, chronic medicine reminders, controlled-drug safeguards, WhatsApp/SMS/voice status sync, and escalation to live pharmacy staff

### 1.5 Nursing (Part of IPD)
- [ ] Medication administration record (MAR)
- [ ] Nursing notes
- [ ] Vital signs trending
- [ ] Shift handoff

**Exit Criteria:** Complete patient admitted → treated → discharged flow works

---

## Phase 2: Revenue Cycle (Week 7-9)
**Goal: Billing accuracy and compliance**

### 2.1 Billing (94% → 98%)
- [ ] Auto-charge capture from orders
- [ ] Full payment workbench route: invoice payment should not be a drawer; build a full-screen cashier workspace for cash/UPI/card/gateway, split tender, partial payment, advance adjustment, refund/return, credit note, write-off request/approval, void, receipt reprint, TPA/insurance settlement, day-close impact, and immutable audit
- [ ] Category-wise billing payment lanes: invoice workspace now shows source-derived charge tabs for patient, pharmacy, lab, imaging, ward/IPD, ER, and other services; next add configurable service tags for patient payable, pharmacy, lab, radiology, IPD room/bed, nursing/ward consumables, procedures, packages, camp/sponsor, corporate/TPA, advances, refunds, and write-offs, with collect/hold/waive/split/reverse/reconcile controls by lane without duplicate entry
- [ ] External business integrations backlog: implement connector-registry based adapters for TallyPrime, QuickBooks Online, Zoho Books/ERP, Zoho CRM, Salesforce, WhatsApp/SMS/email/voice providers, Razorpay, PayU/Cashfree/PhonePe/POS, with webhook inbox, idempotency, mapping, replay, health checks, and audit; see `docs/research/external-business-integrations-2026-05-25.md`
- [ ] Package billing
- [ ] Discount authorization workflow
- [ ] Receipt printing
- [ ] Day-end reconciliation

### 2.2 Insurance (70% → 90%)
- [ ] Eligibility verification with policy/member identifier masking and audit
- [ ] Pre-authorization workflow with create, submit, enhancement, denial, appeal, print/reprint
- [ ] Claim packet generation from invoice/admission/MRD case sheet and supporting clinical documents
- [ ] NHCX/TPA integration: provider/payor discovery, eligibility, pre-auth, claim, payment notice, payment acknowledgement, status fetch
- [ ] Payer query, rejection/denial, shortfall, appeal, patient self-pay conversion, and write-off handoff
- [ ] Settlement tracking, unmatched credit auto-match, TPA receivable aging, and final closure

### 2.3 Printing & Forms (26% → 70%)
- [ ] Prescription print
- [ ] Discharge summary
- [ ] Lab/Radiology reports
- [ ] Bills and receipts
- [ ] Consent forms
- [ ] MLC forms

**Exit Criteria:** Bill generation, payment collection, receipt printing works

---

## Phase 3: Operations (Week 10-12)
**Goal: Hospital runs smoothly**

### 3.1 TV Displays & Queue (0% → 80%)
- [ ] OPD token display
- [ ] Doctor availability board
- [ ] Bed status board
- [ ] Lab/Radiology queue
- [ ] WebSocket real-time updates
- [ ] Auto-refresh displays

### 3.2 Housekeeping (88% → 95%)
- [ ] Bed turnaround workflow
- [ ] Cleaning task assignment
- [ ] Status tracking

### 3.3 Inventory (96% → 98%)
- [ ] Low stock alerts
- [ ] Auto-reorder triggers
- [ ] Expiry management
- [ ] Indent approval workflow

### 3.4 Front Office (75% → 90%)
- [ ] Appointment scheduling
- [ ] Walk-in management
- [ ] Patient search
- [ ] Visitor management
- [ ] Doctor scheduler calendar QA: verify date pickers open beside the input in modals/drawers, schedule events are visible in week view, and schedule/exception actions obey `opd.schedule.*` permissions

### 3.5 Communication (64% → 85%)
- [ ] SMS notifications
- [ ] WhatsApp integration stub
- [ ] Email notifications
- [ ] Internal messaging

### 3.6 Connected Ward Operations
- [ ] Food/canteen and diet-kitchen orders linked from IPD admissions
- [ ] Bedside portal requests and feedback linked to patient/admission context
- [ ] Nurse activities dual view: due-now shift worklist plus patient timeline for MAR, vitals/NEWS-style observations, I/O, pain, wound, fall risk, restraint, handoff, code blue, and equipment checks
- [ ] Nursing handoff target workflow: outgoing nurse, incoming nurse/next-shift owner, supervisor escalation, SBAR payload, acknowledgement, and missed-handoff audit
- [ ] Ward consumables issue/return with patient chargeability and operational-cost capture
- [ ] Patient-attached assets and biomedical equipment reservation, issue, maintenance, calibration, and breakdown linkage
- [ ] Biomedical waste capture by ward/bed/admission with category, weight, handover, vendor manifest, and BMW Rules audit evidence
- [ ] Facilities/weather readiness signals for gas, water, energy, fire, and work orders in IPD, ER, and camp operations
- [ ] NMC/MSR and accreditation evidence checklist for bed strength, ward infrastructure, emergency readiness, central kitchen/canteen, BMW, BME/equipment, and clinical material norms
- [ ] Org chart and reporting hierarchy: hospital group → facility → department → unit/ward/store → role → supervisor → employee, feeding HR, scheduling, access approvals, roster swaps, and escalation rules

**Exit Criteria:** Queues flow, beds managed, stock tracked

---

## Phase 4: Compliance & Audit (Week 13-14)
**Goal: Regulatory readiness**

### 4.1 Audit Trail (29% → 90%)
- [ ] All CRUD operations logged
- [ ] User action tracking
- [ ] PHI access logging
- [ ] Report generation
- [ ] Tamper-proof storage
- [x] Split break-glass start from elevated break-glass review, with backend route enforcement and audit UI tab gating
- [ ] Staff access tiers: normal doctor, normal nurse, nursing supervisor/matron, HR officer, audit officer, and break-glass reviewer templates
- [x] Block IAM self-approval and restrict elevated access-request approvals to bypass hospital/system admin tier until finer delegated authority is implemented
- [ ] Replace raw user-id activity lookup with a staff picker filtered by HR/user permissions

### 4.2 Consent Management (65% → 90%)
- [ ] Consent capture workflow
- [ ] Digital signature
- [ ] Witness recording
- [ ] Consent withdrawal

### 4.3 Quality & NABH (91% → 95%)
- [ ] Indicator dashboards
- [ ] Incident reporting
- [ ] Patient feedback
- [ ] Quality metrics

### 4.4 Infection Control (96% → 98%)
- [ ] Surveillance dashboards
- [ ] Outbreak alerts
- [ ] Antibiotic stewardship reports

### 4.5 Compliance Center UI
- [ ] Standards register for ABDM, DPDP, DISHA readiness, MoHFW EHR, NABH Digital Health/HIS-EMR, SOC 2, ISO 27001, ISO 27701, HIPAA, GDPR, HL7/FHIR, DICOM, ICD, SNOMED CT, LOINC, ISO 13485, CE/FDA/SaMD, VAPT, and HITRUST
- [ ] Applicability wizard for deployment geography, SaaS/on-prem mode, patient origin, ABDM/NHCX participation, imaging/PACS scope, payment scope, and AI/SaMD claims
- [ ] Control matrix that maps standards to modules, screens, fields, permissions, backend routes, tests, and evidence
- [ ] Evidence locker with owners, due dates, review cadence, document uploads, sandbox certificates, VAPT reports, audit samples, screenshots, and test reports
- [ ] Gap dashboard and auditor export bundle with evidence id, timestamp, approver, checksum/hash, and change history
- [ ] Example SOC 2/ISO controls: encryption at rest for patient/audit/document/backup/log stores, TLS in transit, privileged access reviews, and break-glass review evidence

**Exit Criteria:** NABH mock audit passed, audit trails complete

---

## Phase 5: Analytics & Reporting (Week 15-16)
**Goal: Decision support**

### 5.1 Dashboards (22% → 70%)
- [ ] Executive dashboard
- [ ] Department dashboards
- [ ] Revenue dashboard
- [ ] Occupancy dashboard
- [ ] Turnaround time metrics

### 5.2 Reports
- [ ] Daily MIS reports
- [ ] Monthly statistics
- [ ] Financial reports
- [ ] Regulatory reports

### 5.3 Workflow Engine (7% → 50%)
- [ ] Basic workflow execution
- [ ] Approval chains
- [ ] Escalation rules
- [ ] SLA monitoring
- [ ] App launcher/workspace navigation for 67+ modules: keep the side drawer as quick navigation, add an app-grid launcher with clinical, inpatient, revenue, operations, compliance, and admin workspaces

### 5.4 Simulator Control Plane
- [x] Auto-refresh next-run preview when profile JSON changes, paced with TanStack Pacer debounce
- [ ] Rework simulator UI into the main HMS visual theme with intelligent, guided component-based configuration instead of raw JSON-first scheduling
- [ ] Add user-friendly simulator schedule builder with smart defaults, hospital-size presets, validation hints, and preview summaries before save/run-now
- [ ] Add an easy configuration wizard that recommends OPD/ER/IPD volumes, seasonal ICD boosts, holiday/weather multipliers, and department mix from the selected facility profile
- [ ] Harden simulator login/form inputs against browser autofill/content-script failures, including stable autocomplete attributes and null-safe input handling
- [ ] Per-state holiday picker for India state-specific public holidays and local festival weighting
- [ ] Hourly volume curve chart for OPD/ER/IPD load shaping before a run
- [ ] Live IMD/OpenWeather feed through a backend adapter with cache, source timestamp, and manual fallback advisory creation

**Exit Criteria:** Management can see KPIs, standard reports available

---

## Phase 6: Integrations (Post-MVP)
**Goal: External connectivity**

### 6.1 ABDM Integration
- [ ] Health ID verification
- [ ] Health records sharing
- [ ] Consent management

### 6.2 Payment Gateway
- [ ] UPI integration
- [ ] Card payments
- [ ] Payment reconciliation

### 6.3 External Lab/Radiology
- [ ] HL7/FHIR interfaces
- [ ] Result import
- [ ] Order export

### 6.4 Government Reporting
- [ ] Birth/death registration
- [ ] Notifiable disease reporting
- [ ] HMIS integration

---

## Deferred (Post-Launch)

| Module | Priority | Reason |
|--------|----------|--------|
| Mobile Apps | P2 | Web-first, mobile later |
| Academic ERP | P3 | Medical college specific |
| Telemedicine | P2 | COVID normalized, can add later |
| AI Documentation | P3 | Nice-to-have |
| CMS/Blog | P4 | Marketing, not operations |
| Multi-Hospital | P2 | Single hospital first |
| Analytics Builder | P3 | Standard reports first |

---

## Resource Requirements

### Team Structure
```
Product Owner (1)
├── Engineering Lead (1)
│   ├── Backend (2) - Rust/Axum
│   ├── Frontend (2) - React/Mantine
│   └── DevOps (1) - CI/CD, infra
├── QA Lead (1)
│   └── QA Engineers (2)
└── Domain Expert (1) - Hospital operations
```

### Infrastructure
- PostgreSQL 16 (primary)
- YottaDB (hierarchical config)
- Redis (caching, sessions)
- S3-compatible storage (documents)
- Load balancer + 2 app servers minimum

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Printing complexity | High | Prioritize top 10 forms first |
| TV display performance | Medium | WebSocket + Redis pub/sub |
| Integration delays | High | Use stubs, integrate later |
| Data migration | High | Build migration tools early |
| Training gap | Medium | Build help system in-app |

---

## Success Metrics

### MVP Launch Criteria
- [ ] 85% feature completion for Phase 1-4
- [ ] Zero critical bugs
- [ ] <3s page load times
- [ ] 99.5% uptime in staging
- [ ] Security audit passed
- [ ] 3 hospitals piloted successfully

### Post-Launch KPIs
- Patient registration < 2 minutes
- Bill generation < 30 seconds
- Zero revenue leakage
- 100% audit trail coverage
- <1% user-reported bugs per week

---

## Weekly Milestones

| Week | Focus | Deliverable |
|------|-------|-------------|
| 1 | Testing infra | CI/CD green, tests running |
| 2 | Security | Audit complete, fixes deployed |
| 3-4 | Lab + Radiology | Clinical orders complete |
| 5-6 | Pharmacy + Nursing | MAR working |
| 7-8 | Billing + Insurance | Revenue cycle complete |
| 9 | Printing | Top 10 forms working |
| 10-11 | TV + Queue | Real-time displays live |
| 12 | Operations | Housekeeping, inventory |
| 13 | Audit | Complete audit trails |
| 14 | Compliance | NABH checklist passed |
| 15 | Dashboards | Management views |
| 16 | Polish | Bug fixes, performance |

---

## Approval

| Role | Name | Date |
|------|------|------|
| Product Owner | | |
| Engineering Lead | | |
| QA Lead | | |
| Stakeholder | | |

---

*This roadmap is a living document. Review weekly and adjust based on progress.*
