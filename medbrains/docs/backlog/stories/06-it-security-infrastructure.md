# IT, Security & Infrastructure — stories

_Auto-generated from `MedBrains_Features.xlsx` (Pending + Partial features). 395 stories. Source of truth is the xlsx; regenerate via `python3 scripts/generate_stories.py`._

## ABAC Monitoring

### Access denied events logged
> As a **system administrator**, I want **access denied events logged**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 E`

### Privilege escalation detection
> As a **system administrator**, I want **privilege escalation detection**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 E`

### Segregation of duties monitoring (e.g., PO create vs PO approve)
> As a **system administrator**, I want **segregation of duties monitoring (e.g., po create vs po approve)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 E`

### Time-based access compliance (vendor access expired but still active)
> As a **system administrator**, I want **time-based access compliance (vendor access expired but still active)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 E`

### External user access monitoring (police, auditor, vendor — time-limited)
> As a **system administrator**, I want **external user access monitoring (police, auditor, vendor — time-limited)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 E`

## AI Analytics

### Natural language to SQL — 'show revenue by department last month' → generates PostgreSQL query via LLM
> As a **system administrator**, I want **natural language to sql — 'show revenue by department last month' → generates postgresql query via llm**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### AI chart suggestion — given a dataset, AI recommends best chart type and column mapping
> As a **system administrator**, I want **ai chart suggestion — given a dataset, ai recommends best chart type and column mapping**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Anomaly detection — automatic alerting when KPIs deviate from historical patterns (spike/drop)
> As a **system administrator**, I want **anomaly detection — automatic alerting when kpis deviate from historical patterns (spike/drop)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### AI-generated insights — auto-summarize dashboard ('ER volume up 23% vs last week, driven by...')
> As a **system administrator**, I want **ai-generated insights — auto-summarize dashboard ('er volume up 23% vs last week, driven by...')**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Trend prediction — forecast next 30/60/90 days for key metrics using statistical models
> As a **system administrator**, I want **trend prediction — forecast next 30/60/90 days for key metrics using statistical models**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Comparative analysis — AI compares periods, highlights statistically significant changes
> As a **system administrator**, I want **comparative analysis — ai compares periods, highlights statistically significant changes**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Conversational analytics — chat interface to ask follow-up questions about displayed data
> As a **system administrator**, I want **conversational analytics — chat interface to ask follow-up questions about displayed data**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Root cause analysis — when anomaly detected, AI drills into sub-dimensions for contributing factors
> As a **system administrator**, I want **root cause analysis — when anomaly detected, ai drills into sub-dimensions for contributing factors**.

`P2 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

## AI Auto-Configuration

### AI config generator — deterministic lookup from KB, pre-fills ~75% of device config (protocol, port, field mappings, transforms)
> As a **system administrator**, I want **ai config generator — deterministic lookup from kb, pre-fills ~75% of device config (protocol, port, field mappings, transforms)**.

`P0 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Field mapping template engine — maps device output fields to MedBrains entity fields (e.g., OBX.5 → lab_results.value)
> As a **system administrator**, I want **field mapping template engine — maps device output fields to medbrains entity fields (e.g., obx.5 → lab_results.value)**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Data transformation rules — unit conversions, code mappings, range normalization auto-applied per device model
> As a **system administrator**, I want **data transformation rules — unit conversions, code mappings, range normalization auto-applied per device model**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### QC recommendation engine — suggests Westgard rules, critical value alerts based on device type and test catalog
> As a **system administrator**, I want **qc recommendation engine — suggests westgard rules, critical value alerts based on device type and test catalog**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Confidence scoring — shows admin how much was auto-filled vs needs manual input (0.0-1.0 score)
> As a **system administrator**, I want **confidence scoring — shows admin how much was auto-filled vs needs manual input (0.0-1.0 score)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Config regeneration — re-run AI config when KB is updated or device firmware changes
> As a **system administrator**, I want **config regeneration — re-run ai config when kb is updated or device firmware changes**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Custom device onboarding — blank protocol template for unknown devices, saved back to KB for future use
> As a **system administrator**, I want **custom device onboarding — blank protocol template for unknown devices, saved back to kb for future use**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

## Access Control

### ABAC (attribute-based access control) per RFC §6.1
> As a **system administrator**, I want **abac (attribute-based access control) per rfc §6.1**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

### Field-level access control
> As a **system administrator**, I want **field-level access control**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

### IP address whitelisting
> As a **system administrator**, I want **ip address whitelisting**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

### Multi-factor authentication (TOTP) — at minimum: admin, DBA, break-glass
> As a **system administrator**, I want **multi-factor authentication (totp) — at minimum: admin, dba, break-glass**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

### Tamper-evident audit chain (SHA-256)
> As a **system administrator**, I want **tamper-evident audit chain (sha-256)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

### Break-glass review workflow
> As a **system administrator**, I want **break-glass review workflow**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

### Address-based conflict detection (staff vs patient)
> As a **system administrator**, I want **address-based conflict detection (staff vs patient)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

### Sensitive case escalation (HIV, psychiatry)
> As a **system administrator**, I want **sensitive case escalation (hiv, psychiatry)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

### Anonymized data access (students)
> As a **system administrator**, I want **anonymized data access (students)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

### VPN requirement for remote access
> As a **system administrator**, I want **vpn requirement for remote access**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-19/31`

## Access Logs

### Role change logging (who changed, old vs new, approver)
> As a **system administrator**, I want **role change logging (who changed, old vs new, approver)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 B`

### Access card/biometric provisioning logs
> As a **system administrator**, I want **access card/biometric provisioning logs**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 B`

## Admin UI

### Device dashboard — connected/disconnected counts, message volume chart, recent errors, bridge agent status
> As a **system administrator**, I want **device dashboard — connected/disconnected counts, message volume chart, recent errors, bridge agent status**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Add Device wizard — 5-step: manufacturer → model → AI config review → network/credentials → test & save
> As a **system administrator**, I want **add device wizard — 5-step: manufacturer → model → ai config review → network/credentials → test & save**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### AI config review step — pre-filled fields green, empty fields amber, field mapping visual editor
> As a **system administrator**, I want **ai config review step — pre-filled fields green, empty fields amber, field mapping visual editor**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Device detail page — config view/edit, message log, connection status, health metrics, config history
> As a **system administrator**, I want **device detail page — config view/edit, message log, connection status, health metrics, config history**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Bridge agents page — list registered agents with status, version, device count, last heartbeat
> As a **system administrator**, I want **bridge agents page — list registered agents with status, version, device count, last heartbeat**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Device catalog browser — searchable knowledge base of available device profiles
> As a **system administrator**, I want **device catalog browser — searchable knowledge base of available device profiles**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

## Aggregators

### MediBuddy / Practo / Lybrate appointment sync
> As a **system administrator**, I want **medibuddy / practo / lybrate appointment sync**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Karkinos oncology referral integration
> As a **system administrator**, I want **karkinos oncology referral integration**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Medall / SRL diagnostics lab integration
> As a **system administrator**, I want **medall / srl diagnostics lab integration**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Sufalam / InstaHealth data exchange
> As a **system administrator**, I want **sufalam / instahealth data exchange**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### ABDM health locker — push/pull patient records
> As a **system administrator**, I want **abdm health locker — push/pull patient records**.

`Pending · Platforms: Web, Mobile · Source: MocDoc+RFC · RFC: §Ext`

### Insurance TPA portal integration (pre-auth, claim status)
> As a **system administrator**, I want **insurance tpa portal integration (pre-auth, claim status)**.

`Pending · Platforms: Web · Source: MocDoc+RFC · RFC: §Ext`

### International compliance adapters (AASANDHA/Maldives, VAT/Fiji)
> As a **system administrator**, I want **international compliance adapters (aasandha/maldives, vat/fiji)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

## Alert

### Warning before submitting critical orders on degraded connection
> As a **system administrator**, I want **warning before submitting critical orders on degraded connection**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

## Alerts

### Auto-escalation on TAT breach (notify supervisor when SLA exceeded)
> As a **system administrator**, I want **auto-escalation on tat breach (notify supervisor when sla exceeded)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

## Analytics

### Department-wise revenue analytics
> As a **system administrator**, I want **department-wise revenue analytics**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

### Doctor-wise revenue analytics
> As a **system administrator**, I want **doctor-wise revenue analytics**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

### IPD census (admission/discharge/death)
> As a **system administrator**, I want **ipd census (admission/discharge/death)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### Lab TAT analytics
> As a **system administrator**, I want **lab tat analytics**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### Pharmacy sales analytics
> As a **system administrator**, I want **pharmacy sales analytics**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### OT utilization analytics
> As a **system administrator**, I want **ot utilization analytics**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### Emergency department analytics
> As a **system administrator**, I want **emergency department analytics**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### Patient satisfaction dashboard
> As a **system administrator**, I want **patient satisfaction dashboard**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### Clinical indicators dashboard (mortality, infection rates)
> As a **system administrator**, I want **clinical indicators dashboard (mortality, infection rates)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

### MIS report builder (custom reports)
> As a **system administrator**, I want **mis report builder (custom reports)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

### Export to Excel/PDF
> As a **system administrator**, I want **export to excel/pdf**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### Scheduled report delivery (email)
> As a **system administrator**, I want **scheduled report delivery (email)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### Cross-timezone analytics
> As a **system administrator**, I want **cross-timezone analytics**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### Multi-location comparison analytics
> As a **system administrator**, I want **multi-location comparison analytics**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### Population dashboard — disease prevalence, outcomes, cost per capita
> As a **system administrator**, I want **population dashboard — disease prevalence, outcomes, cost per capita**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### HEDIS/quality measure tracking (compliance rates per measure)
> As a **system administrator**, I want **hedis/quality measure tracking (compliance rates per measure)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Cohort builder — dynamic patient groups by diagnosis, age, location, risk
> As a **system administrator**, I want **cohort builder — dynamic patient groups by diagnosis, age, location, risk**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### SDOH impact analytics — correlation between social factors and readmission/outcomes
> As a **system administrator**, I want **sdoh impact analytics — correlation between social factors and readmission/outcomes**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Real-time KPI tiles (ALOS, mortality, infection rate, patient satisfaction)
> As a **system administrator**, I want **real-time kpi tiles (alos, mortality, infection rate, patient satisfaction)**.

`Partial · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

### Campaign ROI analytics (cost per acquisition, conversion rate, revenue generated)
> As a **system administrator**, I want **campaign roi analytics (cost per acquisition, conversion rate, revenue generated)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

## Audit Trail

### Every data CREATE logged (who, what, when, IP/device)
> As a **system administrator**, I want **every data create logged (who, what, when, ip/device)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 A`

### Every data READ/VIEW logged (who viewed which patient record)
> As a **system administrator**, I want **every data read/view logged (who viewed which patient record)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 A`

### Every data UPDATE logged (old value vs new value, timestamp)
> As a **system administrator**, I want **every data update logged (old value vs new value, timestamp)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 A`

### Every data DELETE logged (soft-delete only, confirm deletion not allowed)
> As a **system administrator**, I want **every data delete logged (soft-delete only, confirm deletion not allowed)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 A`

## Booking

### Google Reserve / Google Maps appointment booking integration
> As a **system administrator**, I want **google reserve / google maps appointment booking integration**.

`Pending · Platforms: Web, Mobile · Source: iElixir+Epic · RFC: §Ext`

### Practo / Lybrate / DocPrime profile sync (availability, fees)
> As a **system administrator**, I want **practo / lybrate / docprime profile sync (availability, fees)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

## Break-Glass

### Break-glass access fully logged (who, reason, duration, data accessed)
> As a **system administrator**, I want **break-glass access fully logged (who, reason, duration, data accessed)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 D`

### Auto-notification to data owner, HOD, IT Security, Medical Superintendent
> As a **system administrator**, I want **auto-notification to data owner, hod, it security, medical superintendent**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 D`

### Break-glass auto-expires after configurable time
> As a **system administrator**, I want **break-glass auto-expires after configurable time**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 D`

### Post-break-glass review workflow
> As a **system administrator**, I want **post-break-glass review workflow**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 D`

### Break-glass abuse detection (repeated triggers → alert)
> As a **system administrator**, I want **break-glass abuse detection (repeated triggers → alert)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 D`

### Break-glass monthly report for NABH audit
> As a **system administrator**, I want **break-glass monthly report for nabh audit**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 D`

## Bridge Agent

### Single Rust binary with feature flags — compile with --features hl7,astm,dicom,serial,rest,mqtt as needed
> As a **system administrator**, I want **single rust binary with feature flags — compile with --features hl7,astm,dicom,serial,rest,mqtt as needed**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### On-premise deployment mode — installed near serial/USB devices, communicates to MedBrains API over HTTPS
> As a **system administrator**, I want **on-premise deployment mode — installed near serial/usb devices, communicates to medbrains api over https**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Cloud sidecar mode — runs as container alongside MedBrains for network-accessible devices
> As a **system administrator**, I want **cloud sidecar mode — runs as container alongside medbrains for network-accessible devices**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Agent registration — self-registers with MedBrains API using pre-provisioned API key
> As a **system administrator**, I want **agent registration — self-registers with medbrains api using pre-provisioned api key**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Heartbeat — 30-second heartbeat with device counts, message volume, buffer depth, memory usage
> As a **system administrator**, I want **heartbeat — 30-second heartbeat with device counts, message volume, buffer depth, memory usage**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Config polling — polls MedBrains API for updated device configs (fallback when NATS unavailable)
> As a **system administrator**, I want **config polling — polls medbrains api for updated device configs (fallback when nats unavailable)**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### SQLite offline buffer — stores messages locally when MedBrains API unreachable, drains FIFO on reconnect
> As a **system administrator**, I want **sqlite offline buffer — stores messages locally when medbrains api unreachable, drains fifo on reconnect**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Exponential backoff retry — failed API deliveries retried 1s→2s→4s→...→5min, max 100 retries
> As a **system administrator**, I want **exponential backoff retry — failed api deliveries retried 1s→2s→4s→...→5min, max 100 retries**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Multi-device multiplexing — single bridge handles multiple devices concurrently
> As a **system administrator**, I want **multi-device multiplexing — single bridge handles multiple devices concurrently**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

## CERT-In

### CERT-In incident reporting integration (6-hour mandatory reporting)
> As a **system administrator**, I want **cert-in incident reporting integration (6-hour mandatory reporting)**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

### Vulnerability assessment scheduling and tracking
> As a **system administrator**, I want **vulnerability assessment scheduling and tracking**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Security event log retention (180 days as per CERT-In)
> As a **system administrator**, I want **security event log retention (180 days as per cert-in)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### VAPT (Vulnerability Assessment & Penetration Testing) report dashboard
> As a **system administrator**, I want **vapt (vulnerability assessment & penetration testing) report dashboard**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### ISO 27001 control mapping dashboard
> As a **system administrator**, I want **iso 27001 control mapping dashboard**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### HIPAA compliance checklist tracker
> As a **system administrator**, I want **hipaa compliance checklist tracker**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### GDPR data subject request handling (right to erasure, portability)
> As a **system administrator**, I want **gdpr data subject request handling (right to erasure, portability)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### SOC 2 Type II evidence collection automation
> As a **system administrator**, I want **soc 2 type ii evidence collection automation**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Compliance dashboard — multi-standard view (NABH + HIPAA + ISO + CERT-In)
> As a **system administrator**, I want **compliance dashboard — multi-standard view (nabh + hipaa + iso + cert-in)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

## Caller Mgmt

### Patient CRM — unified caller profile (call history, preferences, complaints, satisfaction)
> As a **system administrator**, I want **patient crm — unified caller profile (call history, preferences, complaints, satisfaction)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Inbound call routing with caller identification and context display
> As a **system administrator**, I want **inbound call routing with caller identification and context display**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

## Care Gaps

### Care gap identification (overdue screenings, vaccinations, follow-ups)
> As a **system administrator**, I want **care gap identification (overdue screenings, vaccinations, follow-ups)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Automated outreach for care gaps (SMS/WhatsApp/email reminders)
> As a **system administrator**, I want **automated outreach for care gaps (sms/whatsapp/email reminders)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

## Chart & Visualization

### Chart type picker — bar, line, area, pie, donut, scatter, heatmap, gauge, funnel, treemap, KPI card
> As a **system administrator**, I want **chart type picker — bar, line, area, pie, donut, scatter, heatmap, gauge, funnel, treemap, kpi card**.

`P1 · Pending · Platforms: Web, Mobile · Source: Superset · RFC: RFC-MODULE-analytics-builder`

### Chart configurator — map data columns to axes, colors, sizes, tooltips with live preview
> As a **system administrator**, I want **chart configurator — map data columns to axes, colors, sizes, tooltips with live preview**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

### Multi-series charts — overlay multiple measures on one chart (admissions + discharges + deaths)
> As a **system administrator**, I want **multi-series charts — overlay multiple measures on one chart (admissions + discharges + deaths)**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

### Conditional formatting — color-code values by thresholds (red >85% occupancy, green <70%)
> As a **system administrator**, I want **conditional formatting — color-code values by thresholds (red >85% occupancy, green <70%)**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

### Drill-down — click chart segment to filter into sub-dimension (dept → doctor → patient)
> As a **system administrator**, I want **drill-down — click chart segment to filter into sub-dimension (dept → doctor → patient)**.

`P2 · Pending · Platforms: Web, Mobile · Source: Superset · RFC: RFC-MODULE-analytics-builder`

### Cross-filtering — click on one chart filters all other charts on the same dashboard
> As a **system administrator**, I want **cross-filtering — click on one chart filters all other charts on the same dashboard**.

`P2 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

### KPI/Scorecard widget — big number + trend arrow + sparkline + comparison to target/previous period
> As a **system administrator**, I want **kpi/scorecard widget — big number + trend arrow + sparkline + comparison to target/previous period**.

`P1 · Pending · Platforms: Web, Mobile · Source: Superset · RFC: RFC-MODULE-analytics-builder`

### Pivot table widget — configurable rows/columns/values with subtotals and conditional formatting
> As a **system administrator**, I want **pivot table widget — configurable rows/columns/values with subtotals and conditional formatting**.

`P2 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

## Clinical AI

### AI-generated discharge summary draft (from clinical notes, labs, meds)
> As a **system administrator**, I want **ai-generated discharge summary draft (from clinical notes, labs, meds)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

### AI drug interaction checker (beyond standard — ML-based severity scoring)
> As a **system administrator**, I want **ai drug interaction checker (beyond standard — ml-based severity scoring)**.

`Pending · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

### AI-powered triage assistant (symptom → urgency classification)
> As a **system administrator**, I want **ai-powered triage assistant (symptom → urgency classification)**.

`Pending · Platforms: Web, Mobile · Source: Epic+iElixir · RFC: §Ext`

## Clinical Access Monitor

### Patient record access log — which staff accessed which patient
> As a **system administrator**, I want **patient record access log — which staff accessed which patient**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

### VIP/celebrity patient access alerting (unusual access pattern)
> As a **system administrator**, I want **vip/celebrity patient access alerting (unusual access pattern)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

### Cross-department access tracking
> As a **system administrator**, I want **cross-department access tracking**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

### After-hours access alerting
> As a **system administrator**, I want **after-hours access alerting**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

### Bulk data access detection (abnormal download volume)
> As a **system administrator**, I want **bulk data access detection (abnormal download volume)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

### Psychiatric record access monitoring (Rule PSY-001)
> As a **system administrator**, I want **psychiatric record access monitoring (rule psy-001)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

### Substance abuse record access monitoring (Rule PSY-002)
> As a **system administrator**, I want **substance abuse record access monitoring (rule psy-002)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

### Counseling record access monitoring (Rule STU-002: ZERO visibility)
> As a **system administrator**, I want **counseling record access monitoring (rule stu-002: zero visibility)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

### Print/export/download tracking
> As a **system administrator**, I want **print/export/download tracking**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 C`

## Comparison

### Patient inflow rate comparison — period vs period (this month vs last month vs last year)
> As a **system administrator**, I want **patient inflow rate comparison — period vs period (this month vs last month vs last year)**.

`Pending · Platforms: Web · Source: iElixir+Bahmni · RFC: §Ext`

### Department-wise patient volume trending (OPD, ER, Lab, Radiology)
> As a **system administrator**, I want **department-wise patient volume trending (opd, er, lab, radiology)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

### Doctor-wise patient load comparison
> As a **system administrator**, I want **doctor-wise patient load comparison**.

`Pending · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

## Completeness

### Data completeness dashboard — % of records with missing demographics, diagnosis, vitals
> As a **system administrator**, I want **data completeness dashboard — % of records with missing demographics, diagnosis, vitals**.

`Pending · Platforms: Web, Mobile · Source: iElixir+Bahmni · RFC: §Ext`

### Mandatory field compliance tracking per department
> As a **system administrator**, I want **mandatory field compliance tracking per department**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

## Configuration

### Department master
> As a **system administrator**, I want **department master**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

### Designation/role master
> As a **system administrator**, I want **designation/role master**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

### Master file management (lab tests, drugs, services, rates)
> As a **system administrator**, I want **master file management (lab tests, drugs, services, rates)**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

### Form builder (dynamic form configuration)
> As a **system administrator**, I want **form builder (dynamic form configuration)**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

### Template management (print templates, report templates)
> As a **system administrator**, I want **template management (print templates, report templates)**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

### Numbering/sequence configuration (UHID, bill, lab report)
> As a **system administrator**, I want **numbering/sequence configuration (uhid, bill, lab report)**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

### System settings (date format, currency, timezone)
> As a **system administrator**, I want **system settings (date format, currency, timezone)**.

`Partial · Platforms: Web · Source: RFC · RFC: §2`

### System health dashboard
> As a **system administrator**, I want **system health dashboard**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

### Backup management
> As a **system administrator**, I want **backup management**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

### Data export tools
> As a **system administrator**, I want **data export tools**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

### Branding configuration (logo, colors, header/footer)
> As a **system administrator**, I want **branding configuration (logo, colors, header/footer)**.

`Pending · Platforms: Web · Source: RFC · RFC: §2`

### Configurable incentive slabs (percentage-based, flat-rate, tiered)
> As a **system administrator**, I want **configurable incentive slabs (percentage-based, flat-rate, tiered)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Doctor referral incentive tracking (internal + external)
> As a **system administrator**, I want **doctor referral incentive tracking (internal + external)**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

### Target-based incentive calculation (monthly/quarterly)
> As a **system administrator**, I want **target-based incentive calculation (monthly/quarterly)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Department-wise incentive rules (surgery, lab, radiology)
> As a **system administrator**, I want **department-wise incentive rules (surgery, lab, radiology)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Incentive approval workflow (calculate → review → approve → disburse)
> As a **system administrator**, I want **incentive approval workflow (calculate → review → approve → disburse)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Incentive statement generation (PDF for doctor)
> As a **system administrator**, I want **incentive statement generation (pdf for doctor)**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

### Integration with billing — auto-calculate from revenue
> As a **system administrator**, I want **integration with billing — auto-calculate from revenue**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

## Coordination

### Discharge coordinator view — all patients pending discharge with blocker list
> As a **system administrator**, I want **discharge coordinator view — all patients pending discharge with blocker list**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Environmental services tracking (bed cleaning status, room turnaround)
> As a **system administrator**, I want **environmental services tracking (bed cleaning status, room turnaround)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

### Transport management (patient transport requests, porter tracking)
> As a **system administrator**, I want **transport management (patient transport requests, porter tracking)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

## Dashboard

### Unified TAT dashboard — all departments on one screen with deviation heat map
> As a **system administrator**, I want **unified tat dashboard — all departments on one screen with deviation heat map**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

### TAT trend analysis — weekly/monthly improvement or degradation tracking
> As a **system administrator**, I want **tat trend analysis — weekly/monthly improvement or degradation tracking**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

## Dashboard Composer

### Drag-drop dashboard layout — arrange charts/tables/KPIs in 12-column configurable grid (enhance existing)
> As a **system administrator**, I want **drag-drop dashboard layout — arrange charts/tables/kpis in 12-column configurable grid (enhance existing)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Dashboard-level filters — global date range, department, doctor filters that cascade to all widgets
> As a **system administrator**, I want **dashboard-level filters — global date range, department, doctor filters that cascade to all widgets**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Auto-refresh with configurable interval per dashboard (30s, 1m, 5m, manual)
> As a **system administrator**, I want **auto-refresh with configurable interval per dashboard (30s, 1m, 5m, manual)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Dashboard templates — pre-built hospital analytics (CEO Overview, CMO Clinical, HOD Department, Finance)
> As a **system administrator**, I want **dashboard templates — pre-built hospital analytics (ceo overview, cmo clinical, hod department, finance)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Dashboard sharing — share via link, embed in pages, role/department-based visibility (enhance existing)
> As a **system administrator**, I want **dashboard sharing — share via link, embed in pages, role/department-based visibility (enhance existing)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Full-screen presentation mode — cycle through dashboards on TV displays with auto-rotate
> As a **system administrator**, I want **full-screen presentation mode — cycle through dashboards on tv displays with auto-rotate**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### PDF/PNG export of entire dashboard with current data snapshot
> As a **system administrator**, I want **pdf/png export of entire dashboard with current data snapshot**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Scheduled report delivery — auto-email PDF dashboards to stakeholders (daily/weekly/monthly)
> As a **system administrator**, I want **scheduled report delivery — auto-email pdf dashboards to stakeholders (daily/weekly/monthly)**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

## Detection

### Real-time network connectivity indicator in UI (green/yellow/red bar)
> As a **system administrator**, I want **real-time network connectivity indicator in ui (green/yellow/red bar)**.

`Pending · Platforms: Web · Source: iElixir+Bahmni · RFC: §Ext`

### Auto-save clinical data locally when network drops (IndexedDB / WatermelonDB)
> As a **system administrator**, I want **auto-save clinical data locally when network drops (indexeddb / watermelondb)**.

`Pending · Platforms: Web · Source: iElixir+Bahmni · RFC: §Ext`

## Device Data Ingest

### Lab result ingest endpoint — bridge posts parsed lab data, server creates lab_results with QC validation
> As a **system administrator**, I want **lab result ingest endpoint — bridge posts parsed lab data, server creates lab_results with qc validation**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Radiology/DICOM ingest — receive study metadata and images, link to radiology_orders
> As a **system administrator**, I want **radiology/dicom ingest — receive study metadata and images, link to radiology_orders**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Vitals streaming ingest — patient monitor data → icu_flowsheets or vitals records
> As a **system administrator**, I want **vitals streaming ingest — patient monitor data → icu_flowsheets or vitals records**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Generic ingest endpoint — catch-all for custom device data with configurable target module
> As a **system administrator**, I want **generic ingest endpoint — catch-all for custom device data with configurable target module**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Audit logging — every device-ingested record logged with bridge agent IP, device ID, raw payload hash
> As a **system administrator**, I want **audit logging — every device-ingested record logged with bridge agent ip, device id, raw payload hash**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Integration pipeline trigger — device data ingest fires internal events for automation pipelines
> As a **system administrator**, I want **integration pipeline trigger — device data ingest fires internal events for automation pipelines**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

## Device Instance Management

### Device instance CRUD — per-tenant create, read, update, decommission devices with full lifecycle tracking
> As a **system administrator**, I want **device instance crud — per-tenant create, read, update, decommission devices with full lifecycle tracking**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Device status tracking — pending_setup → configuring → testing → active → degraded → disconnected → maintenance → decommissioned
> As a **system administrator**, I want **device status tracking — pending_setup → configuring → testing → active → degraded → disconnected → maintenance → decommissioned**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Connectivity test — admin triggers test connection to device via assigned bridge agent, returns latency/status
> As a **system administrator**, I want **connectivity test — admin triggers test connection to device via assigned bridge agent, returns latency/status**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Credential encryption — AES-256-GCM for device passwords/API keys at rest, masked in API responses
> As a **system administrator**, I want **credential encryption — aes-256-gcm for device passwords/api keys at rest, masked in api responses**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Config history audit trail — every config change (AI or human) logged with before/after diff and reason
> As a **system administrator**, I want **config history audit trail — every config change (ai or human) logged with before/after diff and reason**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### BME equipment linkage — FK to bme_equipment for maintenance/calibration tracking
> As a **system administrator**, I want **bme equipment linkage — fk to bme_equipment for maintenance/calibration tracking**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Facility/department/location assignment — bind device to physical location for routing
> As a **system administrator**, I want **facility/department/location assignment — bind device to physical location for routing**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Device message log — raw inbound/outbound message log with parsed payload, processing status, retry count
> As a **system administrator**, I want **device message log — raw inbound/outbound message log with parsed payload, processing status, retry count**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Failed message retry — admin retries failed/rejected messages from the message log
> As a **system administrator**, I want **failed message retry — admin retries failed/rejected messages from the message log**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

## Device Knowledge Base

### Global device manufacturer catalog — searchable registry of medical device manufacturers with logos and support URLs
> As a **system administrator**, I want **global device manufacturer catalog — searchable registry of medical device manufacturers with logos and support urls**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Device model profiles — per-model defaults: protocol, port, baud rate, AE title, field mappings, transforms, known quirks
> As a **system administrator**, I want **device model profiles — per-model defaults: protocol, port, baud rate, ae title, field mappings, transforms, known quirks**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Community-contributed device profiles — tenants share configs for devices they've successfully connected
> As a **system administrator**, I want **community-contributed device profiles — tenants share configs for devices they've successfully connected**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Verified badge — MedBrains team marks tested/verified device profiles
> As a **system administrator**, I want **verified badge — medbrains team marks tested/verified device profiles**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Known quirks registry — auto-applied workarounds per device model (e.g., CR vs CRLF, ACK delays)
> As a **system administrator**, I want **known quirks registry — auto-applied workarounds per device model (e.g., cr vs crlf, ack delays)**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Seed data — 20-30 common Indian hospital devices (Roche cobas, Beckman, Sysmex, Mindray, Erba, TransAsia, GE, Philips, Siemens)
> As a **system administrator**, I want **seed data — 20-30 common indian hospital devices (roche cobas, beckman, sysmex, mindray, erba, transasia, ge, philips, siemens)**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

## Discharge

### Discharge TAT — decision-to-actual-discharge time with bottleneck analysis
> As a **system administrator**, I want **discharge tat — decision-to-actual-discharge time with bottleneck analysis**.

`Pending · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

## Disposal

### Expired drug identification and quarantine workflow
> As a **system administrator**, I want **expired drug identification and quarantine workflow**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Drug destruction documentation (witness, method, quantity)
> As a **system administrator**, I want **drug destruction documentation (witness, method, quantity)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Narcotics disposal with mandatory dual-witness sign-off
> As a **system administrator**, I want **narcotics disposal with mandatory dual-witness sign-off**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Batch-level disposal tracking with reason codes
> As a **system administrator**, I want **batch-level disposal tracking with reason codes**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Environmental compliance documentation (biomedical waste category)
> As a **system administrator**, I want **environmental compliance documentation (biomedical waste category)**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

### Disposal approval workflow (pharmacist → manager → compliance)
> As a **system administrator**, I want **disposal approval workflow (pharmacist → manager → compliance)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Integration with inventory — auto-deduct disposed stock
> As a **system administrator**, I want **integration with inventory — auto-deduct disposed stock**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Disposal register report for regulatory audit
> As a **system administrator**, I want **disposal register report for regulatory audit**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

## Duplicates

### Duplicate patient detection (fuzzy matching on name, DOB, phone, Aadhaar)
> As a **system administrator**, I want **duplicate patient detection (fuzzy matching on name, dob, phone, aadhaar)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

## ERP & Standards

### Tally integration
> As a **system administrator**, I want **tally integration**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### SAP integration
> As a **system administrator**, I want **sap integration**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### Odoo integration
> As a **system administrator**, I want **odoo integration**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### Zoho Books integration
> As a **system administrator**, I want **zoho books integration**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### Webhook-based generic integration
> As a **system administrator**, I want **webhook-based generic integration**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### SNOMED CT
> As a **system administrator**, I want **snomed ct**.

`Partial · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

### LOINC (lab codes)
> As a **system administrator**, I want **loinc (lab codes)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### CPT (procedure codes)
> As a **system administrator**, I want **cpt (procedure codes)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

### HL7 FHIR (data exchange) R4
> As a **system administrator**, I want **hl7 fhir (data exchange) r4**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### CDSS (Clinical Decision Support)
> As a **system administrator**, I want **cdss (clinical decision support)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

## Emergency

### ER TAT — door-to-doctor, door-to-disposition time tracking
> As a **system administrator**, I want **er tat — door-to-doctor, door-to-disposition time tracking**.

`Pending · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

## Engagement

### Real-time wait time display per department/doctor on website
> As a **system administrator**, I want **real-time wait time display per department/doctor on website**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

### Chat bot / virtual assistant for FAQs, appointment help, directions
> As a **system administrator**, I want **chat bot / virtual assistant for faqs, appointment help, directions**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Patient lifecycle tracking (prospect → first visit → regular → inactive → re-engaged)
> As a **system administrator**, I want **patient lifecycle tracking (prospect → first visit → regular → inactive → re-engaged)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Birthday/anniversary greetings automation
> As a **system administrator**, I want **birthday/anniversary greetings automation**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

## Engine

### Workflow template builder (admin)
> As a **system administrator**, I want **workflow template builder (admin)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

### Step sequence definition (JSONB)
> As a **system administrator**, I want **step sequence definition (jsonb)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

### Conditional branching (if/else rules)
> As a **system administrator**, I want **conditional branching (if/else rules)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

### Parallel steps
> As a **system administrator**, I want **parallel steps**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

### Approval steps (single/multi-level)
> As a **system administrator**, I want **approval steps (single/multi-level)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

### Auto-trigger workflows (on event)
> As a **system administrator**, I want **auto-trigger workflows (on event)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

### Manual trigger workflows
> As a **system administrator**, I want **manual trigger workflows**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

### SLA/deadline tracking per step
> As a **system administrator**, I want **sla/deadline tracking per step**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

### Escalation on deadline breach
> As a **system administrator**, I want **escalation on deadline breach**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

### Workflow instance tracking (status per patient/order)
> As a **system administrator**, I want **workflow instance tracking (status per patient/order)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

### Form builder (dynamic forms per workflow step)
> As a **system administrator**, I want **form builder (dynamic forms per workflow step)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

### Notification integration (per step)
> As a **system administrator**, I want **notification integration (per step)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

### 120+ pre-built workflow templates (from RFC-002)
> As a **system administrator**, I want **120+ pre-built workflow templates (from rfc-002)**.

`Pending · Platforms: Web · Source: RFC · RFC: RFC-002`

## Export

### Full data export (all patient records, visits, orders in FHIR/CSV/JSON)
> As a **system administrator**, I want **full data export (all patient records, visits, orders in fhir/csv/json)**.

`Pending · Platforms: Web · Source: iElixir+Bahmni · RFC: §Ext`

### Department-wise data export with date range filters
> As a **system administrator**, I want **department-wise data export with date range filters**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

## Follow-up

### Post-discharge follow-up scheduling (auto-book 7-day/30-day follow-up)
> As a **system administrator**, I want **post-discharge follow-up scheduling (auto-book 7-day/30-day follow-up)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Post-discharge phone/WhatsApp call tracking (nurse callback with checklist)
> As a **system administrator**, I want **post-discharge phone/whatsapp call tracking (nurse callback with checklist)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

## General

### Country-specific regulatory engine — auto-detect applicable laws/bodies based on hospital country and state
> As a **system administrator**, I want **country-specific regulatory engine — auto-detect applicable laws/bodies based on hospital country and state**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Multi-script patient name storage — Latin + Devanagari + Arabic + Thai script with transliteration
> As a **system administrator**, I want **multi-script patient name storage — latin + devanagari + arabic + thai script with transliteration**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Country-specific patient ID formats — Aadhaar (India), Emirates ID (UAE), NRIC (Singapore), SSN (US)
> As a **system administrator**, I want **country-specific patient id formats — aadhaar (india), emirates id (uae), nric (singapore), ssn (us)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Multi-calendar support — Gregorian + Hijri + Thai Buddhist + Nepali Bikram Sambat with auto-conversion
> As a **system administrator**, I want **multi-calendar support — gregorian + hijri + thai buddhist + nepali bikram sambat with auto-conversion**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Multi-format date/time/number display — DD/MM/YYYY vs MM/DD/YYYY vs YYYY-MM-DD per locale preference
> As a **system administrator**, I want **multi-format date/time/number display — dd/mm/yyyy vs mm/dd/yyyy vs yyyy-mm-dd per locale preference**.

`P1 · Pending · Platforms: Web, TV · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### RTL (right-to-left) UI support — Arabic/Hebrew interface mirroring for Gulf region deployments
> As a **system administrator**, I want **rtl (right-to-left) ui support — arabic/hebrew interface mirroring for gulf region deployments**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Multi-timezone scheduling — per-campus timezone with cross-timezone appointment coordination
> As a **system administrator**, I want **multi-timezone scheduling — per-campus timezone with cross-timezone appointment coordination**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Multi-measurement auto-conversion — kg↔lb, cm↔in, °C↔°F, mmol/L↔mg/dL per locale with stored metric
> As a **system administrator**, I want **multi-measurement auto-conversion — kg↔lb, cm↔in, °c↔°f, mmol/l↔mg/dl per locale with stored metric**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Country-specific tax engine — GST (India), VAT (UAE/EU), sales tax (US) with configurable rates per service
> As a **system administrator**, I want **country-specific tax engine — gst (india), vat (uae/eu), sales tax (us) with configurable rates per service**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Country-specific drug scheduling — Schedule H/H1/X (India), Schedule 8 (Australia), Class A/B/C (UK)
> As a **system administrator**, I want **country-specific drug scheduling — schedule h/h1/x (india), schedule 8 (australia), class a/b/c (uk)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Country-specific consent templates — legal requirements vary (India=witness required, US=HIPAA notice)
> As a **system administrator**, I want **country-specific consent templates — legal requirements vary (india=witness required, us=hipaa notice)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Country-specific clinical coding — ICD-10-CM (US) vs ICD-10-AM (Australia) vs ICD-10 WHO (India)
> As a **system administrator**, I want **country-specific clinical coding — icd-10-cm (us) vs icd-10-am (australia) vs icd-10 who (india)**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Country-specific billing formats — NABH format (India), DHA/HAAD format (UAE), CMS-1500 (US)
> As a **system administrator**, I want **country-specific billing formats — nabh format (india), dha/haad format (uae), cms-1500 (us)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Country-specific emergency protocols — MLC reporting (India), mandatory reporting laws per jurisdiction
> As a **system administrator**, I want **country-specific emergency protocols — mlc reporting (india), mandatory reporting laws per jurisdiction**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Regional holiday calendar — auto-populate public holidays per country for leave/scheduling modules
> As a **system administrator**, I want **regional holiday calendar — auto-populate public holidays per country for leave/scheduling modules**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Deployment region selector — data residency compliance (data stays in-country per GDPR/DPDP/PDPA)
> As a **system administrator**, I want **deployment region selector — data residency compliance (data stays in-country per gdpr/dpdp/pdpa)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Real-time hospital digital twin — live 3D visualization of bed occupancy, staff positions, equipment status
> As a **system administrator**, I want **real-time hospital digital twin — live 3d visualization of bed occupancy, staff positions, equipment status**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Historical replay — replay any past day's operations to identify root causes of delays or incidents
> As a **system administrator**, I want **historical replay — replay any past day's operations to identify root causes of delays or incidents**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### What-if capacity simulation — model impact of adding beds, closing wards, or changing staffing ratios
> As a **system administrator**, I want **what-if capacity simulation — model impact of adding beds, closing wards, or changing staffing ratios**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Disaster scenario simulation — simulate mass casualty, pandemic surge, power outage on hospital operations
> As a **system administrator**, I want **disaster scenario simulation — simulate mass casualty, pandemic surge, power outage on hospital operations**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Patient flow simulation — model bottleneck impact of changing admission/discharge policies
> As a **system administrator**, I want **patient flow simulation — model bottleneck impact of changing admission/discharge policies**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### OT scheduling simulation — optimize surgical block allocation by simulating different configurations
> As a **system administrator**, I want **ot scheduling simulation — optimize surgical block allocation by simulating different configurations**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Staffing optimization simulator — model shift patterns and nurse-to-patient ratios against patient acuity
> As a **system administrator**, I want **staffing optimization simulator — model shift patterns and nurse-to-patient ratios against patient acuity**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Equipment utilization simulation — predict impact of adding/removing ventilators, monitors, or imaging machines
> As a **system administrator**, I want **equipment utilization simulation — predict impact of adding/removing ventilators, monitors, or imaging machines**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Financial impact modeling — simulate revenue impact of tariff changes, new services, or insurance panel changes
> As a **system administrator**, I want **financial impact modeling — simulate revenue impact of tariff changes, new services, or insurance panel changes**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Simulation report generator — export scenario comparison reports for board/management decision-making
> As a **system administrator**, I want **simulation report generator — export scenario comparison reports for board/management decision-making**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-usp-platform`

### Screen reader optimization — ARIA labels, landmark regions, focus management across all pages
> As a **system administrator**, I want **screen reader optimization — aria labels, landmark regions, focus management across all pages**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

### Keyboard-only navigation — full app usable without mouse via Tab/Enter/Escape
> As a **system administrator**, I want **keyboard-only navigation — full app usable without mouse via tab/enter/escape**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

### User-adjustable font scaling — 100% to 200% text size without layout breakage
> As a **system administrator**, I want **user-adjustable font scaling — 100% to 200% text size without layout breakage**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

### Color-blind safe palettes — alternative color schemes for deuteranopia, protanopia, tritanopia
> As a **system administrator**, I want **color-blind safe palettes — alternative color schemes for deuteranopia, protanopia, tritanopia**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

### Reduced motion mode — disable animations for users with vestibular disorders
> As a **system administrator**, I want **reduced motion mode — disable animations for users with vestibular disorders**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

### Break-glass emergency access — override authorization with emergency code, mandatory reason, auto-audit log
> As a **system administrator**, I want **break-glass emergency access — override authorization with emergency code, mandatory reason, auto-audit log**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

### Patient identity banner — always-visible bar showing active patient (name, UHID, age, allergies) on clinical pages
> As a **system administrator**, I want **patient identity banner — always-visible bar showing active patient (name, uhid, age, allergies) on clinical pages**.

`P1 · Pending · Platforms: Web, Mobile · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

### Similar-name patient alert — visual warning when two patients with similar names are accessed in same session
> As a **system administrator**, I want **similar-name patient alert — visual warning when two patients with similar names are accessed in same session**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

### High-risk action confirmation — double-check step for dangerous doses, critical medication changes, irreversible orders
> As a **system administrator**, I want **high-risk action confirmation — double-check step for dangerous doses, critical medication changes, irreversible orders**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

### Clinical handoff summary — auto-generated end-of-shift summary of patients under care with pending actions
> As a **system administrator**, I want **clinical handoff summary — auto-generated end-of-shift summary of patients under care with pending actions**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

## Government

### ABDM (ABHA, care context, consent) — M1/M2/M3
> As a **system administrator**, I want **abdm (abha, care context, consent) — m1/m2/m3**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### NHCX (National Health Claim Exchange)
> As a **system administrator**, I want **nhcx (national health claim exchange)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### e-Hospital (NIC)
> As a **system administrator**, I want **e-hospital (nic)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### CoWIN (vaccination records)
> As a **system administrator**, I want **cowin (vaccination records)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

## Handoff

### Structured handoff document (I-PASS: Illness, Patient Summary, Action List, Situation, Synthesis)
> As a **system administrator**, I want **structured handoff document (i-pass: illness, patient summary, action list, situation, synthesis)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Automated transition-of-care notification to PCP/referring doctor
> As a **system administrator**, I want **automated transition-of-care notification to pcp/referring doctor**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

### AI handoff summary generation (synthesize shift events into structured handover)
> As a **system administrator**, I want **ai handoff summary generation (synthesize shift events into structured handover)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

## Import

### Bulk patient import from CSV/Excel (demographics, insurance, contacts)
> As a **system administrator**, I want **bulk patient import from csv/excel (demographics, insurance, contacts)**.

`Pending · Platforms: Web · Source: iElixir+Bahmni · RFC: §Ext`

### Historical visit/encounter import (map fields from competitor HMS export)
> As a **system administrator**, I want **historical visit/encounter import (map fields from competitor hms export)**.

`Pending · Platforms: Web · Source: iElixir+Bahmni · RFC: §Ext`

### Drug master import (name, generic, strength, route, frequency from CSV)
> As a **system administrator**, I want **drug master import (name, generic, strength, route, frequency from csv)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

### Lab test master import (test name, sample type, ranges from CSV)
> As a **system administrator**, I want **lab test master import (test name, sample type, ranges from csv)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

## Incident Log Audit

### Anonymous incident reporter identity encryption audit (Rule INC-001)
> As a **system administrator**, I want **anonymous incident reporter identity encryption audit (rule inc-001)**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-31 F`

### Medication error report auto-notification log (Rule INC-003)
> As a **system administrator**, I want **medication error report auto-notification log (rule inc-003)**.

`Pending · Platforms: Web, Mobile · Source: ACMSRC · RFC: CL-31 F`

### Consent form access and modification audit
> As a **system administrator**, I want **consent form access and modification audit**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 F`

### Consent revocation real-time logging
> As a **system administrator**, I want **consent revocation real-time logging**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 F`

### Form printing audit (reprint detection with DUPLICATE watermark)
> As a **system administrator**, I want **form printing audit (reprint detection with duplicate watermark)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 F`

## Integration

### Apple Health / Google Fit data ingestion (steps, heart rate, sleep, activity)
> As a **system administrator**, I want **apple health / google fit data ingestion (steps, heart rate, sleep, activity)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

### Bluetooth BP cuff, glucometer, pulse oximeter, weight scale integration
> As a **system administrator**, I want **bluetooth bp cuff, glucometer, pulse oximeter, weight scale integration**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

### Continuous glucose monitor (CGM) data integration (Dexcom, Libre)
> As a **system administrator**, I want **continuous glucose monitor (cgm) data integration (dexcom, libre)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

## Lab

### Lab TAT tracking — order-to-result time with SLA breach alerts
> As a **system administrator**, I want **lab tat tracking — order-to-result time with sla breach alerts**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

## Medication

### Medication reconciliation at every transition (admit → transfer → discharge)
> As a **system administrator**, I want **medication reconciliation at every transition (admit → transfer → discharge)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

## Message Draft

### AI-drafted replies to patient portal messages (doctor reviews before sending)
> As a **system administrator**, I want **ai-drafted replies to patient portal messages (doctor reviews before sending)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

### AI patient message categorization (urgent vs routine vs administrative)
> As a **system administrator**, I want **ai patient message categorization (urgent vs routine vs administrative)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

## Metadata & Semantic Layer

### Schema introspection — auto-discover PostgreSQL tables, columns, types, foreign keys from information_schema
> As a **system administrator**, I want **schema introspection — auto-discover postgresql tables, columns, types, foreign keys from information_schema**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Metadata catalog — cached registry of all analytics-ready tables with column descriptions, data types, sample values
> As a **system administrator**, I want **metadata catalog — cached registry of all analytics-ready tables with column descriptions, data types, sample values**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Semantic mapping — business-friendly names for columns (admitted_at → Admission Date, tenant_id → hidden)
> As a **system administrator**, I want **semantic mapping — business-friendly names for columns (admitted_at → admission date, tenant_id → hidden)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Pre-built JOIN graph — define relationships between tables (patients→encounters→lab_orders) for auto-join
> As a **system administrator**, I want **pre-built join graph — define relationships between tables (patients→encounters→lab_orders) for auto-join**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Calculated fields — define virtual columns (revenue_per_patient, tat_hours, occupancy_pct) reusable across charts
> As a **system administrator**, I want **calculated fields — define virtual columns (revenue_per_patient, tat_hours, occupancy_pct) reusable across charts**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Materialized views — auto-create/refresh PostgreSQL materialized views for heavy aggregation queries
> As a **system administrator**, I want **materialized views — auto-create/refresh postgresql materialized views for heavy aggregation queries**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Query cache layer — cache analytics query results in Redis/memory with TTL (30s–5min) for repeated dashboard loads
> As a **system administrator**, I want **query cache layer — cache analytics query results in redis/memory with ttl (30s–5min) for repeated dashboard loads**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

### Tenant-scoped metadata — each tenant sees only their allowed datasets, respects RLS
> As a **system administrator**, I want **tenant-scoped metadata — each tenant sees only their allowed datasets, respects rls**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-analytics-builder`

## Monitoring

### Abnormal reading alerts to care team (HR >120, SpO2 <90, BP >180)
> As a **system administrator**, I want **abnormal reading alerts to care team (hr >120, spo2 <90, bp >180)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Patient-generated health data dashboard (trend charts, compliance)
> As a **system administrator**, I want **patient-generated health data dashboard (trend charts, compliance)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### RPM (Remote Patient Monitoring) program enrollment and billing (CPT 99453-99458)
> As a **system administrator**, I want **rpm (remote patient monitoring) program enrollment and billing (cpt 99453-99458)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Wearable data quality filtering (artifact rejection, plausibility checks)
> As a **system administrator**, I want **wearable data quality filtering (artifact rejection, plausibility checks)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

## Notifications

### Automated end-of-day summary (OPD count, IPD census, revenue, pending tasks)
> As a **system administrator**, I want **automated end-of-day summary (opd count, ipd census, revenue, pending tasks)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Department-wise EOD breakdown (lab pending, pharmacy pending, billing pending)
> As a **system administrator**, I want **department-wise eod breakdown (lab pending, pharmacy pending, billing pending)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### WhatsApp/email delivery of EOD digest to management
> As a **system administrator**, I want **whatsapp/email delivery of eod digest to management**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

### Configurable digest schedule (shift-end, 8PM, midnight)
> As a **system administrator**, I want **configurable digest schedule (shift-end, 8pm, midnight)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Critical alert escalation (overdue tasks, pending discharges, low stock)
> As a **system administrator**, I want **critical alert escalation (overdue tasks, pending discharges, low stock)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Week/month trend comparison in digest
> As a **system administrator**, I want **week/month trend comparison in digest**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

## Outreach

### Health campaign management (flu drive, screening camp, wellness program)
> As a **system administrator**, I want **health campaign management (flu drive, screening camp, wellness program)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

### Targeted patient outreach — filter by condition, age, last visit, insurance for campaigns
> As a **system administrator**, I want **targeted patient outreach — filter by condition, age, last visit, insurance for campaigns**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Multi-channel campaign delivery (SMS, WhatsApp, email, push notification, IVR)
> As a **system administrator**, I want **multi-channel campaign delivery (sms, whatsapp, email, push notification, ivr)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

### Campaign response tracking (opened, clicked, booked, no-response)
> As a **system administrator**, I want **campaign response tracking (opened, clicked, booked, no-response)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

## Patterns

### Hour-of-day / day-of-week heat map (when do patients come?)
> As a **system administrator**, I want **hour-of-day / day-of-week heat map (when do patients come?)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

### Referral source analysis (self, doctor referral, insurance, online booking)
> As a **system administrator**, I want **referral source analysis (self, doctor referral, insurance, online booking)**.

`Pending · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

### New vs returning patient ratio tracking
> As a **system administrator**, I want **new vs returning patient ratio tracking**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

## Payment & Comms

### Payment gateway (Razorpay/Stripe)
> As a **system administrator**, I want **payment gateway (razorpay/stripe)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### UPI integration
> As a **system administrator**, I want **upi integration**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

### POS terminal integration
> As a **system administrator**, I want **pos terminal integration**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### SMS gateway integration
> As a **system administrator**, I want **sms gateway integration**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

### WhatsApp Business API
> As a **system administrator**, I want **whatsapp business api**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

### Email (SMTP/SendGrid)
> As a **system administrator**, I want **email (smtp/sendgrid)**.

`Pending · Platforms: Web · Source: RFC · RFC: §3.18`

### Push notification (FCM/APNs)
> As a **system administrator**, I want **push notification (fcm/apns)**.

`Pending · Platforms: Web, Mobile · Source: RFC · RFC: §3.18`

## Pharmacy

### Pharmacy TAT — prescription-to-dispensing time
> As a **system administrator**, I want **pharmacy tat — prescription-to-dispensing time**.

`Pending · Platforms: Web, Mobile · Source: iElixir · RFC: §Ext`

## Plain Language

### AI plain language translator — convert medical terminology to patient-friendly language
> As a **system administrator**, I want **ai plain language translator — convert medical terminology to patient-friendly language**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

## Pre-Visit

### Digital pre-registration (demographics, insurance, consent — before arrival)
> As a **system administrator**, I want **digital pre-registration (demographics, insurance, consent — before arrival)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Pre-visit questionnaire (symptoms, history, allergies — auto-populates chart)
> As a **system administrator**, I want **pre-visit questionnaire (symptoms, history, allergies — auto-populates chart)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

### Agentic AI pre-visit chart preparation (summarize history, flag care gaps, stage orders)
> As a **system administrator**, I want **agentic ai pre-visit chart preparation (summarize history, flag care gaps, stage orders)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### AI-generated patient briefing for doctor (1-page summary before consultation)
> As a **system administrator**, I want **ai-generated patient briefing for doctor (1-page summary before consultation)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

## Predictions

### Patient flow prediction — ED arrivals, admissions, discharges by hour
> As a **system administrator**, I want **patient flow prediction — ed arrivals, admissions, discharges by hour**.

`Pending · Platforms: Web · Source: Epic+iElixir · RFC: §Ext`

### Bed demand forecasting (predict bed shortages 24-48 hours ahead)
> As a **system administrator**, I want **bed demand forecasting (predict bed shortages 24-48 hours ahead)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Readmission risk scoring (30-day readmission probability per patient)
> As a **system administrator**, I want **readmission risk scoring (30-day readmission probability per patient)**.

`Pending · Platforms: Web · Source: Epic+iElixir · RFC: §Ext`

### Patient deterioration early warning (NEWS2/MEWS auto-calculated from vitals)
> As a **system administrator**, I want **patient deterioration early warning (news2/mews auto-calculated from vitals)**.

`Pending · Platforms: Web, Mobile · Source: Epic+iElixir · RFC: §Ext`

## Privacy

### TLS 1.3 (transit encryption)
> As a **system administrator**, I want **tls 1.3 (transit encryption)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

### Database encryption at rest (AES-256)
> As a **system administrator**, I want **database encryption at rest (aes-256)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

### Field-level encryption (Aadhaar, phone, HIV status)
> As a **system administrator**, I want **field-level encryption (aadhaar, phone, hiv status)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

### Per-patient encryption keys (PDK)
> As a **system administrator**, I want **per-patient encryption keys (pdk)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

### Key hierarchy (MK → KEK → PDK → field keys)
> As a **system administrator**, I want **key hierarchy (mk → kek → pdk → field keys)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

### Consent-based encryption (HIV, psychiatry — patient must consent)
> As a **system administrator**, I want **consent-based encryption (hiv, psychiatry — patient must consent)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

### Certificate pinning (mobile app)
> As a **system administrator**, I want **certificate pinning (mobile app)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

### mTLS for ABDM/TPA API calls
> As a **system administrator**, I want **mtls for abdm/tpa api calls**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

### Key rotation (MK annual, KEK quarterly)
> As a **system administrator**, I want **key rotation (mk annual, kek quarterly)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

### DPDPA compliance (right to erasure, consent management)
> As a **system administrator**, I want **dpdpa compliance (right to erasure, consent management)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

### Key management (HSM, KMS, vault)
> As a **system administrator**, I want **key management (hsm, kms, vault)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

### Backup encryption (at rest + during transfer)
> As a **system administrator**, I want **backup encryption (at rest + during transfer)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

### DICOM traffic encryption (TLS for DICOM associations)
> As a **system administrator**, I want **dicom traffic encryption (tls for dicom associations)**.

`Pending · Platforms: Web · Source: RFC+ACMSRC · RFC: §6, CL-33 F`

## Protocol Adapters

### HL7 v2 MLLP adapter — TCP listener/sender with MLLP framing (0x0B/0x1C/0x0D), ACK/NAK generation
> As a **system administrator**, I want **hl7 v2 mllp adapter — tcp listener/sender with mllp framing (0x0b/0x1c/0x0d), ack/nak generation**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### ASTM E1381/E1394 adapter — ENQ/ACK/EOT handshake, frame parsing for older lab analyzers
> As a **system administrator**, I want **astm e1381/e1394 adapter — enq/ack/eot handshake, frame parsing for older lab analyzers**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### DICOM adapter — C-STORE (receive studies), C-FIND (query), Modality Worklist (send orders to scanners)
> As a **system administrator**, I want **dicom adapter — c-store (receive studies), c-find (query), modality worklist (send orders to scanners)**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Serial RS-232 adapter — configurable baud/parity/stop bits for legacy point-of-care devices
> As a **system administrator**, I want **serial rs-232 adapter — configurable baud/parity/stop bits for legacy point-of-care devices**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### REST/JSON adapter — poll or webhook mode for modern IoT devices and cloud APIs
> As a **system administrator**, I want **rest/json adapter — poll or webhook mode for modern iot devices and cloud apis**.

`P1 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### MQTT adapter — subscribe to sensor topics for cold chain monitoring, environment sensors, wearables
> As a **system administrator**, I want **mqtt adapter — subscribe to sensor topics for cold chain monitoring, environment sensors, wearables**.

`P2 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### ProtocolAdapter trait — pluggable interface: connect, disconnect, receive, parse, ack, test_connection
> As a **system administrator**, I want **protocoladapter trait — pluggable interface: connect, disconnect, receive, parse, ack, test_connection**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

### Message parser pipeline — raw bytes → parsed segments → field mapping → data transforms → validation → MedBrains entity
> As a **system administrator**, I want **message parser pipeline — raw bytes → parsed segments → field mapping → data transforms → validation → medbrains entity**.

`P0 · Pending · Platforms: Web · Source: MedBrains · RFC: RFC-MODULE-device-integration`

## Provider Search

### Provider directory with search by specialty, language, insurance, availability
> As a **system administrator**, I want **provider directory with search by specialty, language, insurance, availability**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Provider profile pages (photo, qualifications, ratings, available slots)
> As a **system administrator**, I want **provider profile pages (photo, qualifications, ratings, available slots)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

## Radiology

### Radiology TAT — order-to-report time with priority-based SLAs
> As a **system administrator**, I want **radiology tat — order-to-report time with priority-based slas**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

## Referral

### Community resource directory (food banks, shelters, mental health, transport services)
> As a **system administrator**, I want **community resource directory (food banks, shelters, mental health, transport services)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Closed-loop referral to community orgs (track if patient connected with resource)
> As a **system administrator**, I want **closed-loop referral to community orgs (track if patient connected with resource)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### External referral tracking (referred out — track if patient was seen, report received)
> As a **system administrator**, I want **external referral tracking (referred out — track if patient was seen, report received)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

## Reports

### Monthly data quality scorecard per department (completeness, accuracy, timeliness)
> As a **system administrator**, I want **monthly data quality scorecard per department (completeness, accuracy, timeliness)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

## Reviews

### Google Business review integration — prompt satisfied patients to leave Google review
> As a **system administrator**, I want **google business review integration — prompt satisfied patients to leave google review**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

## Risk

### Patient risk stratification (low/medium/high based on conditions, utilization, social factors)
> As a **system administrator**, I want **patient risk stratification (low/medium/high based on conditions, utilization, social factors)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Chronic disease registry (all diabetics, hypertensives, COPD patients in one view)
> As a **system administrator**, I want **chronic disease registry (all diabetics, hypertensives, copd patients in one view)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

## SIEM

### Automated anomaly detection (unusual access patterns)
> As a **system administrator**, I want **automated anomaly detection (unusual access patterns)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 G`

### SIEM integration (Splunk, ELK, Wazuh)
> As a **system administrator**, I want **siem integration (splunk, elk, wazuh)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 G`

### Log forwarding to centralized log management (syslog, JSON, CEF)
> As a **system administrator**, I want **log forwarding to centralized log management (syslog, json, cef)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 G`

### Alert engine for security events
> As a **system administrator**, I want **alert engine for security events**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 G`

### Periodic security audit reports (monthly/quarterly)
> As a **system administrator**, I want **periodic security audit reports (monthly/quarterly)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 G`

### DPDP Act compliance reporting (data access logs for data subject requests)
> As a **system administrator**, I want **dpdp act compliance reporting (data access logs for data subject requests)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 G`

### Forensic investigation support (reconstruct complete user activity timeline)
> As a **system administrator**, I want **forensic investigation support (reconstruct complete user activity timeline)**.

`Pending · Platforms: Web · Source: ACMSRC · RFC: CL-31 G`

## Scheduling

### Unified online scheduling — OPD, teleconsult, lab, radiology, vaccination
> As a **system administrator**, I want **unified online scheduling — opd, teleconsult, lab, radiology, vaccination**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Appointment booking from Google Maps / Google Business integration
> As a **system administrator**, I want **appointment booking from google maps / google business integration**.

`Pending · Platforms: Web, Mobile · Source: Epic+iElixir · RFC: §Ext`

## Screening

### SDOH screening questionnaire (food insecurity, housing, transportation, safety)
> As a **system administrator**, I want **sdoh screening questionnaire (food insecurity, housing, transportation, safety)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

## Staffing

### Predictive staffing — nurse/doctor demand based on census forecast
> As a **system administrator**, I want **predictive staffing — nurse/doctor demand based on census forecast**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

### OR utilization optimization — suggest schedule changes to reduce idle time
> As a **system administrator**, I want **or utilization optimization — suggest schedule changes to reduce idle time**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

## Symptom Checker

### AI-powered symptom checker (patient enters symptoms → suggested specialty/urgency)
> As a **system administrator**, I want **ai-powered symptom checker (patient enters symptoms → suggested specialty/urgency)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

## Sync

### Auto-sync queued data when connectivity restored (conflict resolution)
> As a **system administrator**, I want **auto-sync queued data when connectivity restored (conflict resolution)**.

`Pending · Platforms: Web · Source: iElixir+Bahmni · RFC: §Ext`

### Sync status dashboard — pending uploads, last sync time, failed syncs
> As a **system administrator**, I want **sync status dashboard — pending uploads, last sync time, failed syncs**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

## Timeliness

### Documentation timeliness — time from event to chart entry per department
> As a **system administrator**, I want **documentation timeliness — time from event to chart entry per department**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

## Validation

### Pre-import data validation (missing fields, format errors, duplicates)
> As a **system administrator**, I want **pre-import data validation (missing fields, format errors, duplicates)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

### Migration reconciliation report (imported vs source counts per entity)
> As a **system administrator**, I want **migration reconciliation report (imported vs source counts per entity)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

### AI model validation framework (accuracy, bias, drift monitoring)
> As a **system administrator**, I want **ai model validation framework (accuracy, bias, drift monitoring)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### HIPAA-compliant AI pipeline (LLM integration with PHI guardrails)
> As a **system administrator**, I want **hipaa-compliant ai pipeline (llm integration with phi guardrails)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### AI feature toggle per department (enable/disable specific AI features)
> As a **system administrator**, I want **ai feature toggle per department (enable/disable specific ai features)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Clinician override tracking (how often AI suggestion is accepted vs rejected)
> As a **system administrator**, I want **clinician override tracking (how often ai suggestion is accepted vs rejected)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

## Visibility

### Patient flow visualization (admission → ward → discharge pipeline with bottlenecks)
> As a **system administrator**, I want **patient flow visualization (admission → ward → discharge pipeline with bottlenecks)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Department load balancing alerts (ED overcrowding, ICU full, OR delays)
> As a **system administrator**, I want **department load balancing alerts (ed overcrowding, icu full, or delays)**.

`Pending · Platforms: Web · Source: Epic · RFC: §Ext`

### Ambulance tracking & incoming patient alerts (pre-arrival notification)
> As a **system administrator**, I want **ambulance tracking & incoming patient alerts (pre-arrival notification)**.

`Pending · Platforms: Web, Mobile · Source: Epic · RFC: §Ext`

### Hospital listing management across Google, JustDial, Practo (single dashboard)
> As a **system administrator**, I want **hospital listing management across google, justdial, practo (single dashboard)**.

`Pending · Platforms: Web · Source: iElixir · RFC: §Ext`

## Visual Query Builder

### Dataset browser — tree view of available datasets/tables with column metadata and preview
> As a **system administrator**, I want **dataset browser — tree view of available datasets/tables with column metadata and preview**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

### Drag-drop dimension/measure — pick columns as dimensions (GROUP BY) or measures (SUM/AVG/COUNT/MIN/MAX)
> As a **system administrator**, I want **drag-drop dimension/measure — pick columns as dimensions (group by) or measures (sum/avg/count/min/max)**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

### Filter builder — visual WHERE clause with AND/OR groups, date ranges, value pickers, relative dates
> As a **system administrator**, I want **filter builder — visual where clause with and/or groups, date ranges, value pickers, relative dates**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

### Time grain selector — automatic date truncation (day/week/month/quarter/year) for time-series queries
> As a **system administrator**, I want **time grain selector — automatic date truncation (day/week/month/quarter/year) for time-series queries**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

### Query result preview — live data preview with pagination while building the query
> As a **system administrator**, I want **query result preview — live data preview with pagination while building the query**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

### SQL editor mode — advanced users write raw SELECT queries (permission-gated, read-only enforcement)
> As a **system administrator**, I want **sql editor mode — advanced users write raw select queries (permission-gated, read-only enforcement)**.

`P2 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

### Save as dataset — save configured query as reusable named dataset for other users/charts
> As a **system administrator**, I want **save as dataset — save configured query as reusable named dataset for other users/charts**.

`P1 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

### Query history — recent queries with re-run capability and performance stats
> As a **system administrator**, I want **query history — recent queries with re-run capability and performance stats**.

`P2 · Pending · Platforms: Web · Source: Superset · RFC: RFC-MODULE-analytics-builder`

## Wizard

### Step-by-step hospital setup wizard (org details → departments → users → config)
> As a **system administrator**, I want **step-by-step hospital setup wizard (org details → departments → users → config)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Import existing data (CSV/Excel for patients, doctors, inventory)
> As a **system administrator**, I want **import existing data (csv/excel for patients, doctors, inventory)**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

### Template selection (clinic vs hospital vs chain — pre-configured modules)
> As a **system administrator**, I want **template selection (clinic vs hospital vs chain — pre-configured modules)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Branding setup (logo, colors, letterhead, receipt format)
> As a **system administrator**, I want **branding setup (logo, colors, letterhead, receipt format)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Integration configuration (ABDM, payment gateway, SMS/WhatsApp)
> As a **system administrator**, I want **integration configuration (abdm, payment gateway, sms/whatsapp)**.

`Pending · Platforms: Web, Mobile · Source: MocDoc · RFC: §Ext`

### Sample data mode (demo patients/visits for training)
> As a **system administrator**, I want **sample data mode (demo patients/visits for training)**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

### Progress tracker with completion percentage
> As a **system administrator**, I want **progress tracker with completion percentage**.

`Pending · Platforms: Web · Source: MocDoc · RFC: §Ext`

