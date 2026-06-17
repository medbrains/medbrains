# Multi-Hospital & Vendors — stories

_Auto-generated from `MedBrains_Features.xlsx` (Pending + Partial features). 74 stories. Source of truth is the xlsx; regenerate via `python3 scripts/generate_stories.py`._

## Admin

### Single sign-on (SSO) across all hospitals in the chain
> As a **group administrator**, I want **single sign-on (sso) across all hospitals in the chain**.

`Partial · Platforms: Web · Source: RFC · RFC: §3`

## Ambulance

### Third-party ambulance service integration (dispatch API, GPS tracking, billing)
> As a **group administrator**, I want **third-party ambulance service integration (dispatch api, gps tracking, billing)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

## Billing

### Split billing — hospital prescribes, external pharmacy bills directly to patient/insurance
> As a **group administrator**, I want **split billing — hospital prescribes, external pharmacy bills directly to patient/insurance**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

### Pharmacy commission/margin tracking for partner pharmacies
> As a **group administrator**, I want **pharmacy commission/margin tracking for partner pharmacies**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

### Reference lab billing reconciliation (hospital price vs lab price, margin tracking)
> As a **group administrator**, I want **reference lab billing reconciliation (hospital price vs lab price, margin tracking)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

### Split billing for outsourced tests (patient pays hospital, hospital remits to lab)
> As a **group administrator**, I want **split billing for outsourced tests (patient pays hospital, hospital remits to lab)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

### Teleradiology fee management (per-study billing to external radiologist)
> As a **group administrator**, I want **teleradiology fee management (per-study billing to external radiologist)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

## Catering

### External catering/food service integration (diet orders → vendor → delivery tracking)
> As a **group administrator**, I want **external catering/food service integration (diet orders → vendor → delivery tracking)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

## Compliance

### Controlled substance prescription tracking (Narcotic/Schedule H1 external dispensing log)
> As a **group administrator**, I want **controlled substance prescription tracking (narcotic/schedule h1 external dispensing log)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

## Equipment

### Medical equipment vendor management (AMC tracking, service call logging, response SLA)
> As a **group administrator**, I want **medical equipment vendor management (amc tracking, service call logging, response sla)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

### Third-party equipment rental tracking (ventilators, CPAP, oxygen concentrators)
> As a **group administrator**, I want **third-party equipment rental tracking (ventilators, cpap, oxygen concentrators)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

## Fulfillment

### External pharmacy fulfillment tracking (sent → acknowledged → dispensed → picked up)
> As a **group administrator**, I want **external pharmacy fulfillment tracking (sent → acknowledged → dispensed → picked up)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

### Home delivery pharmacy integration (Dunzo, Swiggy Instamart, PharmEasy, 1mg)
> As a **group administrator**, I want **home delivery pharmacy integration (dunzo, swiggy instamart, pharmeasy, 1mg)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

## General

### Anonymized KPI sharing — hospitals opt-in to share metrics (ALOS, infection rate, mortality) with peer network
> As a **group administrator**, I want **anonymized kpi sharing — hospitals opt-in to share metrics (alos, infection rate, mortality) with peer network**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Peer comparison dashboards — compare your hospital's KPIs against anonymized peers by size/type/region
> As a **group administrator**, I want **peer comparison dashboards — compare your hospital's kpis against anonymized peers by size/type/region**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### National/regional percentile ranking — see where your hospital stands (top 10%, median, bottom quartile)
> As a **group administrator**, I want **national/regional percentile ranking — see where your hospital stands (top 10%, median, bottom quartile)**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Department-level benchmarking — compare ED wait times, OT utilization, lab TAT against peer averages
> As a **group administrator**, I want **department-level benchmarking — compare ed wait times, ot utilization, lab tat against peer averages**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Custom peer group creation — define peer group by bed count, specialty mix, location, accreditation status
> As a **group administrator**, I want **custom peer group creation — define peer group by bed count, specialty mix, location, accreditation status**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Accreditation readiness score — auto-calculated NABH/JCI readiness percentage with gap identification
> As a **group administrator**, I want **accreditation readiness score — auto-calculated nabh/jci readiness percentage with gap identification**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Revenue per bed benchmarking — compare revenue metrics against similar-sized hospitals in same region
> As a **group administrator**, I want **revenue per bed benchmarking — compare revenue metrics against similar-sized hospitals in same region**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Staffing ratio benchmarking — nurse-to-patient ratio, doctor-to-bed ratio vs recommended standards
> As a **group administrator**, I want **staffing ratio benchmarking — nurse-to-patient ratio, doctor-to-bed ratio vs recommended standards**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Infection rate benchmarking — HAI rates compared to NHSN (US) or INICC (India) published benchmarks
> As a **group administrator**, I want **infection rate benchmarking — hai rates compared to nhsn (us) or inicc (india) published benchmarks**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Cost-per-case analysis — compare treatment costs by DRG/procedure against regional averages
> As a **group administrator**, I want **cost-per-case analysis — compare treatment costs by drg/procedure against regional averages**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Best-practice recommendations — AI-generated suggestions based on top-performing peers' configurations
> As a **group administrator**, I want **best-practice recommendations — ai-generated suggestions based on top-performing peers' configurations**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Benchmark trend alerts — auto-notify when your metric falls below peer average for 3 consecutive months
> As a **group administrator**, I want **benchmark trend alerts — auto-notify when your metric falls below peer average for 3 consecutive months**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Benchmarking reports for board/management — exportable PDF/PPT with peer comparison charts
> As a **group administrator**, I want **benchmarking reports for board/management — exportable pdf/ppt with peer comparison charts**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Multi-language patient concierge portal — English, Arabic, Russian, Chinese, French, German interface
> As a **group administrator**, I want **multi-language patient concierge portal — english, arabic, russian, chinese, french, german interface**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

### Visa invitation letter generation — hospital letterhead with treatment plan, cost estimate, doctor details
> As a **group administrator**, I want **visa invitation letter generation — hospital letterhead with treatment plan, cost estimate, doctor details**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

### Airport pickup/drop coordination — vehicle assignment, driver details, estimated arrival notification
> As a **group administrator**, I want **airport pickup/drop coordination — vehicle assignment, driver details, estimated arrival notification**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

### International patient coordinator assignment — dedicated communication channel per patient
> As a **group administrator**, I want **international patient coordinator assignment — dedicated communication channel per patient**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

### Travel & accommodation booking assistance — partner hotel listing with proximity, pricing, availability
> As a **group administrator**, I want **travel & accommodation booking assistance — partner hotel listing with proximity, pricing, availability**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

### Multi-currency billing — USD, AED, EUR, GBP, RUB with live exchange rates and currency conversion
> As a **group administrator**, I want **multi-currency billing — usd, aed, eur, gbp, rub with live exchange rates and currency conversion**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

### International insurance processing — BUPA, Allianz, Aetna, Cigna claim formats and direct settlement
> As a **group administrator**, I want **international insurance processing — bupa, allianz, aetna, cigna claim formats and direct settlement**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

### Interpreter/translator service booking — per language per appointment with availability calendar
> As a **group administrator**, I want **interpreter/translator service booking — per language per appointment with availability calendar**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

### Medical visa documentation package — treatment summary, cost breakdown, doctor credentials bundle
> As a **group administrator**, I want **medical visa documentation package — treatment summary, cost breakdown, doctor credentials bundle**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

### International patient outcomes portfolio — success stories filterable by nationality and procedure
> As a **group administrator**, I want **international patient outcomes portfolio — success stories filterable by nationality and procedure**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

### Post-return telehealth follow-up — cross-timezone scheduling for international patient aftercare
> As a **group administrator**, I want **post-return telehealth follow-up — cross-timezone scheduling for international patient aftercare**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

### Medical tourism package builder — treatment + hospital stay + hotel + travel as bundled pricing
> As a **group administrator**, I want **medical tourism package builder — treatment + hospital stay + hotel + travel as bundled pricing**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-hospital-usp`

## Housekeeping

### Outsourced housekeeping vendor integration (task assignment, SLA tracking)
> As a **group administrator**, I want **outsourced housekeeping vendor integration (task assignment, sla tracking)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

## Insurance

### TPA (Third-Party Administrator) portal integration (pre-auth, claims, denials)
> As a **group administrator**, I want **tpa (third-party administrator) portal integration (pre-auth, claims, denials)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

## Inventory

### Centralized procurement with hospital-wise indent and allocation
> As a **group administrator**, I want **centralized procurement with hospital-wise indent and allocation**.

`Partial · Platforms: Web, Mobile · Source: RFC · RFC: §3`

### Group purchasing organization (GPO) rate negotiation tracking
> As a **group administrator**, I want **group purchasing organization (gpo) rate negotiation tracking**.

`Partial · Platforms: Web · Source: RFC · RFC: §3`

## Laundry

### External laundry service tracking (pickup → wash → return with item count reconciliation)
> As a **group administrator**, I want **external laundry service tracking (pickup → wash → return with item count reconciliation)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

## NABL

### NABL accredited lab preference in routing rules
> As a **group administrator**, I want **nabl accredited lab preference in routing rules**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

## Onboarding

### Vendor qualification assessment (quality audit, delivery performance, pricing)
> As a **group administrator**, I want **vendor qualification assessment (quality audit, delivery performance, pricing)**.

`Partial · Platforms: Web · Source: RFC · RFC: §Ext`

## Orders

### Reference lab order routing — auto-route tests not available in-house to partner lab
> As a **group administrator**, I want **reference lab order routing — auto-route tests not available in-house to partner lab**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

### Reference lab directory with test menu, pricing, TAT per lab
> As a **group administrator**, I want **reference lab directory with test menu, pricing, tat per lab**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

### HL7/FHIR-based order transmission to external labs (ORM/OBR messages)
> As a **group administrator**, I want **hl7/fhir-based order transmission to external labs (orm/obr messages)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

## PACS

### Cloud PACS integration for multi-site image access
> As a **group administrator**, I want **cloud pacs integration for multi-site image access**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

## Payments

### Vendor payment tracking (invoice → approval → payment → reconciliation)
> As a **group administrator**, I want **vendor payment tracking (invoice → approval → payment → reconciliation)**.

`Partial · Platforms: Web · Source: RFC · RFC: §Ext`

### GST input credit tracking per vendor invoice
> As a **group administrator**, I want **gst input credit tracking per vendor invoice**.

`Partial · Platforms: Web · Source: RFC · RFC: §Ext`

## Performance

### Vendor performance scorecard (delivery timeliness, quality rejections, pricing compliance)
> As a **group administrator**, I want **vendor performance scorecard (delivery timeliness, quality rejections, pricing compliance)**.

`Partial · Platforms: Web · Source: RFC · RFC: §Ext`

### Vendor comparison analytics (price comparison across vendors per item)
> As a **group administrator**, I want **vendor comparison analytics (price comparison across vendors per item)**.

`Partial · Platforms: Web · Source: RFC · RFC: §Ext`

## Prescribing

### E-prescribing to external/retail pharmacies (electronic Rx transmission)
> As a **group administrator**, I want **e-prescribing to external/retail pharmacies (electronic rx transmission)**.

`Pending · Platforms: Web, Mobile · Source: RFC+Epic · RFC: §Ext`

### Pharmacy network directory (nearby pharmacies with stock availability)
> As a **group administrator**, I want **pharmacy network directory (nearby pharmacies with stock availability)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

### Prescription routing — in-house first, external if out-of-stock or patient preference
> As a **group administrator**, I want **prescription routing — in-house first, external if out-of-stock or patient preference**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

## Pricing

### Multi-currency support (INR, USD, AED, SAR, etc.) per hospital
> As a **group administrator**, I want **multi-currency support (inr, usd, aed, sar, etc.) per hospital**.

`Partial · Platforms: Web · Source: RFC · RFC: §3`

## QC

### External lab quality monitoring (proficiency testing results, accreditation status)
> As a **group administrator**, I want **external lab quality monitoring (proficiency testing results, accreditation status)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

## Refill

### Prescription refill request from patient to external pharmacy via app
> As a **group administrator**, I want **prescription refill request from patient to external pharmacy via app**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

## Reporting

### Consolidated HR reporting (staff count, attrition, training compliance by branch)
> As a **group administrator**, I want **consolidated hr reporting (staff count, attrition, training compliance by branch)**.

`Partial · Platforms: Web · Source: RFC · RFC: §3`

### Chain-wide quality indicator dashboard (NABH indicators aggregated)
> As a **group administrator**, I want **chain-wide quality indicator dashboard (nabh indicators aggregated)**.

`Partial · Platforms: Web, Mobile · Source: RFC · RFC: §3`

### Inter-hospital referral pattern analysis (which branches refer where)
> As a **group administrator**, I want **inter-hospital referral pattern analysis (which branches refer where)**.

`Partial · Platforms: Web · Source: RFC · RFC: §3`

### DICOM image transmission to external reporting radiologist (teleradiology)
> As a **group administrator**, I want **dicom image transmission to external reporting radiologist (teleradiology)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

### External radiologist report ingestion (structured report with findings/impression)
> As a **group administrator**, I want **external radiologist report ingestion (structured report with findings/impression)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

### After-hours / weekend teleradiology routing (auto-send to night-reading partner)
> As a **group administrator**, I want **after-hours / weekend teleradiology routing (auto-send to night-reading partner)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

## Results

### Automatic result ingestion from reference lab (HL7 ORU / FHIR DiagnosticReport)
> As a **group administrator**, I want **automatic result ingestion from reference lab (hl7 oru / fhir diagnosticreport)**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

### External lab result review and approval workflow before patient release
> As a **group administrator**, I want **external lab result review and approval workflow before patient release**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

### Result branding — hospital logo on report even when test done at reference lab
> As a **group administrator**, I want **result branding — hospital logo on report even when test done at reference lab**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

## Sample

### Sample pickup coordination (external lab courier scheduling and tracking)
> As a **group administrator**, I want **sample pickup coordination (external lab courier scheduling and tracking)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

### Sample handover documentation with temperature and time logging
> As a **group administrator**, I want **sample handover documentation with temperature and time logging**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

## Security

### Outsourced security vendor management (guard deployment, incident reporting)
> As a **group administrator**, I want **outsourced security vendor management (guard deployment, incident reporting)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §Ext`

## TAT

### External lab TAT tracking with SLA breach alerts
> As a **group administrator**, I want **external lab tat tracking with sla breach alerts**.

`Pending · Platforms: Web · Source: RFC · RFC: §Ext`

## Transfer

### Cross-hospital appointment booking (patient books at any branch)
> As a **group administrator**, I want **cross-hospital appointment booking (patient books at any branch)**.

`Partial · Platforms: Web, Mobile · Source: RFC · RFC: §3`

### Lab sample routing to sister hospital (if test not available locally)
> As a **group administrator**, I want **lab sample routing to sister hospital (if test not available locally)**.

`Partial · Platforms: Web · Source: RFC · RFC: §3`

