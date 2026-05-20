# RFC-MODULE-reports-center

## Status

In progress.

## Scope

Reports Center is the governed reporting, dashboarding, export, sharing, scheduling, and predictive-analysis workbench for MedBrains. It is not a generic BI iframe. It must respect HMS permissions, patient privacy, NABH evidence needs, audit trails, and clinical safety rules.

## Primary References

- Apache ECharts Features: https://echarts.apache.org/en/feature.html
- Apache ECharts Cheat Sheet: https://echarts.apache.org/en/cheat-sheet.html
- Apache ECharts Examples index: https://echarts.apache.org/examples/en/index.html
- NABH Hospital Accreditation Standard, 6th Edition, January 2025: https://portal.nabh.co/images/Standards/NABH%20Hospital%20Accreditation%20Standard%206th%20Edition%20January%202025.pdf
- NABH Digital Health Standards for Hospitals, 2nd Edition, September 2025: https://portal.nabh.co/Announcement/Draft%20NABH%20DHS%202nd%20Edition.pdf
- WHO EWARS: https://www.who.int/emergencies/surveillance/early-warning-alert-and-response-system-ewars/
- WHO Ethics and Governance of AI for Health: https://www.who.int/publications/i/item/9789240029200
- ICMR Ethical Guidelines for AI in Biomedical Research and Healthcare: https://www.icmr.gov.in/ethical-guidelines-for-application-of-Artificial-Intelligence-in-Biomedical-Research-and-Healthcare
- TRIPOD+AI clinical prediction model reporting guidance: https://pubmed.ncbi.nlm.nih.gov/38626948/

## Product Principles

1. Every report is a permissioned artifact, not just a chart.
2. Every export, scheduled send, image export, secure share, and external-user view must be audit logged.
3. Patient-identifiable reports stay native to MedBrains. External BI tools may use de-identified warehouse/read-replica data only.
4. Predictive reports are decision support. They must show model version, confidence, source data quality, drift status, and human-review state.
5. NABH evidence should be dynamically calculated from source modules where possible. No startup seed should be used as accreditation evidence.
6. The default report surface should show charts first. Details, AI summaries, red flags, appreciation flags, action items, and scheduling controls open from the chart's three-dot menu.

## ECharts Capability Matrix

| ECharts type/component | Use in MedBrains | Example report |
|---|---|---|
| Line / Area | Trends, TAT, vitals, revenue, forecast | OPD footfall trend, lab TAT trend |
| Bar / Stacked Bar | Counts, utilization, collections, workload | Department revenue, bed occupancy |
| Pie / Donut | Mix distribution | payer mix, visit type mix |
| Scatter / EffectScatter | outliers and geospatial bubbles | district risk bubbles, high-cost outliers |
| Heatmap | time x department, pincode x syndrome | OPD queue heatmap, disease signal heatmap |
| Calendar | daily compliance, infection signals, appointment leakage | no-show calendar, ADR calendar, hand hygiene compliance |
| Map / Geo / Lines | district, pincode, referral, ambulance, camp coverage | outbreak map, referral-source map, camp reach map |
| SVG map / Custom | body-region and hospital-layout maps | organ map, hospital traffic map |
| Sankey | flow between stages/modules | patient flow from OPD to lab/pharmacy/IPD |
| Graph / Tree | relationships and pathways | referral network, disease-procedure-drug links |
| Treemap / Sunburst | hierarchy composition | revenue by department/service, inventory classes |
| Funnel | drop-off analysis | appointment -> consult -> lab -> pharmacy -> follow-up |
| Radar | scorecards | department risk radar, clinical outlier radar |
| Gauge | target compliance | NABH indicator compliance, SLA performance |
| Boxplot / Candlestick | distribution and variation | TAT variability, bed wait-time distribution |
| Parallel Coordinates | multi-variable risk review | LOS, age, cost, diagnosis, readmission risk |
| ThemeRiver | stream changes over time | syndrome mix over season |
| PictorialBar | board/committee visuals | bed pressure, stock pressure |
| Timeline | period playback | outbreak evolution, monthly NABH progress |
| DataZoom / Brush / VisualMap | exploration controls | filter large time series and heatmaps |
| Dataset / TypedArray | large data efficiency | high-volume simulator/patient-flow reports |

## Module Report Map

| Module | Core reports | Advanced charts | NABH / audit evidence |
|---|---|---|---|
| OPD | footfall, queue wait, no-show, token misses, consultation TAT | calendar heatmap, leakage funnel, forecast line | access, continuity, waiting-time improvement |
| Patient / EMR | data completeness, duplicate risk, ABHA/Aadhaar coverage, diagnosis coding coverage | radar, parallel coordinates, graph | patient identification, documentation quality |
| IPD | census, occupancy, ALOS, transfer, discharge TAT | occupancy forecast, ward heatmap, patient-flow Sankey | continuity, discharge planning, bed management |
| Lab | sample TAT, critical alerts, QC, outsourced lab pending | TAT boxplot, QC control line, workload heatmap | critical value reporting, report delivery |
| Radiology / DICOM | modality load, report TAT, unsigned reports, study volume | modality heatmap, traffic map, body-region map | report verification, patient safety, PACS audit |
| Pharmacy | dispensing TAT, returns, NDPS register, stock-outs, expiry | ABC/VED treemap, antibiotic pressure radar | medication safety, controlled-drug accountability |
| Billing / Finance | collection, refunds, credit notes, day close, aging, GST | refund anomaly line, revenue treemap | transparent finance, reconciliation audit |
| Quality / NABH | indicators, incidents, CAPA, committee action closure | target-band line, compliance gauge, red/yellow/green matrix | NABH evidence and continuous improvement |
| Infection Control | HAI, MDRO, antimicrobial consumption, outbreak line-list | disease heatmap, EWARS-style alert map, ThemeRiver | surveillance, infection prevention |
| Facilities / BME | uptime, downtime, PM compliance, fire drills, BMW disposal | equipment-risk radar, downtime calendar | facility safety, equipment uptime |
| Camp | camp coverage, patient segment download, sync status, referrals | village map, camp conversion funnel, offline packet health | rural/outreach continuity and audit |
| Scheduling | slot utilization, no-show, cancellation, overbooking accuracy | forecast, calendar heatmap, anomaly flags | access efficiency |
| Research | cohorts, outcomes, disease trends | survival-like trend, cohort Sankey, de-identified maps | IEC/ethics-controlled analytics |

## Predictive Analysis Rules

Predictive reports are allowed only when they follow these controls:

- Clearly label as forecast, risk score, or alert candidate.
- Show model version, generated time, input window, confidence/uncertainty, and feature/source summary.
- Store model output as an auditable event with user action taken or ignored.
- Never auto-diagnose, auto-prescribe, auto-discharge, or auto-deny care.
- Require human review for clinical alerts, outbreak alerts, high-risk pharmacy alerts, and financial fraud flags.
- Monitor drift: data volume drift, feature drift, label drift, calibration, false-positive/false-negative feedback.
- Support rollback to a previous model version.
- Allow patient-identifiable prediction only inside MedBrains permission boundaries.

## Advanced Intelligence Reports

| Report | Sources | Chart | Detection / prediction |
|---|---|---|---|
| Pandemic / outbreak detector | OPD symptoms, lab positives, pharmacy demand, pincode, camp data | heatmap + map + ThemeRiver | syndrome cluster, seasonal rise, threshold breach |
| Anticipated capacity forecast | appointment, queue, admission, discharge, beds | forecast line + target band | next 7 days OPD, bed, lab load |
| District risk map | patient address, pincode, camp, referral | geo/map scatter + lines | high-risk area and referral inflow |
| Care leakage funnel | scheduling, OPD, orders, billing, pharmacy, follow-up | funnel | drop-off stage detection |
| Patient-flow network | event stream across modules | Sankey / graph | bottleneck and unnecessary movement |
| Clinical outlier radar | quality, ICD, lab, IPD, infection, pharmacy | radar + boxplot | department/service outlier |
| Organ/body-region map | ICD/SNOMED/procedure/radiology data | SVG custom map | clinical burden by body region |
| Hospital traffic map | queue, location, task, porter/ambulance | SVG map + lines | congestion and transfer delay |

## Actionability Matrix V1

Every report must answer: who owns it, what decision it changes, what red flag triggers action, and what artifact is sent or stored.

| Report | Owner | Source data | Chart | Red flag | Action item | Delivery |
|---|---|---|---|---|---|---|
| Hospital dashboard | Hospital admin / COO | analytics rollups, OPD, IPD, billing, lab, pharmacy | stacked bar + trend | volume up but revenue/quality down | open management huddle task | daily dashboard + monthly MIS |
| Command center | Operations head | live queues, alerts, jobs, integrations | gauge + timeline | critical queue/backlog not acknowledged | escalate to duty manager | live only + shift summary |
| Monthly MIS pack | CEO office | finance, quality, operations, HR | multi-chart PDF | missing source section | assign module owner | scheduled PDF/XLSX |
| OPD and bed flow | OPD manager / nursing superintendent | OPD queue, encounters, bed state | line + heatmap | OPD wait or bed pressure above threshold | add counter/doctor/bed discharge review | daily report |
| No-show and slot utilization | Front office head | appointments, waitlist, reminders | calendar heatmap + bar | no-show cluster by slot/doctor | reminder escalation and waitlist fill | weekly department email |
| IPD census and ALOS | IPD coordinator | admissions, transfers, discharge | stacked bar + forecast | ALOS outlier or discharge delay | case-management review | ward dashboard + morning huddle |
| Lab TAT and critical values | Lab manager | samples, results, critical alerts | boxplot + SLA band | critical alert acknowledgement delay | call escalation + RCA | daily lab TAT report |
| Radiology TAT and modality load | Radiology manager | orders, studies, reports, signoffs | modality heatmap | unsigned report backlog | assign reporting radiologist | daily dashboard |
| Outsourced lab reconciliation | Lab finance / QA | outsourced orders, vendor bills | aging bar | pending external result or margin mismatch | vendor follow-up | daily Excel |
| Billing MIS | Finance controller | invoices, receipts, GST, write-offs | revenue trend + treemap | reconciliation mismatch | day-close exception review | day-close pack |
| Refund and credit-note register | Finance controller | refunds, advances, credit notes | anomaly line + table | refund spike or repeat approver | approval audit | daily PDF/XLSX |
| Pharmacy finance | Pharmacy in-charge / cashier | POS, returns, cash drawer, supplier payments | trend + variance | cash mismatch or high returns | cashier audit | shift close pack |
| Biomedical uptime and MTBF | BME head | assets, work orders, downtime | uptime gauge + calendar | downtime above threshold | service call / PM catch-up | NABH evidence |
| Facility utilities | Facilities head | energy, water, BMW, fire drill | utility trend + compliance calendar | missed drill/test/disposal | compliance task | monthly facilities pack |
| Queue performance | OPD/front office | queue token events | station heatmap | counter bottleneck | staff redeployment | hourly dashboard |
| NABH quality indicators | Quality manager | source-module indicators | KPI matrix + target bands | indicator below target or missing source | CAPA or data-capture owner | monthly committee pack |
| Infection control surveillance | Infection control nurse / microbiology | HAI, MDRO, antibiotics, cultures | heatmap + trend | cluster or antimicrobial spike | outbreak investigation | daily alert + monthly report |
| Audit and break-glass report | CISO / MS | audit_log, access sessions | timeline + table | unreviewed emergency access | supervisor review | monthly audit pack |
| Disease signal heatmap | Infection control / public health | OPD symptoms, lab positives, pincode, pharmacy | heatmap + map | syndrome cluster | clinical review and line-list | alert queue |
| Anticipated capacity forecast | Command center | historical flow, active queues, seasonality | forecast line + uncertainty band | predicted demand exceeds capacity | pre-position staff/resources | hourly forecast |
| District risk map | Camp coordinator / infection control | camp, address, referral, disease data | map scatter + flow lines | rising risk in pincode | camp/referral planning | secure share to leadership |
| Clinical organ map | Medical superintendent / specialty HOD | ICD, procedures, radiology, implants | SVG organ map | body-region burden spike | specialty review | clinical dashboard |
| Hospital traffic map | Operations head | locations, tasks, queue moves | SVG traffic map + lines | movement congestion or transfer delay | porter/task escalation | command center |
| Care leakage funnel | COO / front office / finance | appointment, consult, orders, billing, follow-up | funnel | high drop-off stage | workflow improvement task | weekly report |
| Patient flow network | COO / quality | encounter event stream | Sankey / graph | avoidable patient movement | layout/process correction | monthly operations pack |
| Clinical outlier radar | Quality manager / MS | clinical indicators, pharmacy, infection | radar + boxplot | service outlier | peer review/RCA | quality committee |
| Pandemic / outbreak detector | Infection control / MS | syndrome, lab, pharmacy, geography | heatmap + ThemeRiver + map | alert threshold breach | outbreak investigation | alert + committee note |
| Utilization review | UR / case management | LOS, denials, barriers, discharge | LOS comparison + bar | avoidable bed days | case manager intervention | daily UR dashboard |
| Research cohort builder | MRD / IEC | de-identified EMR extracts | cohort flow + filters | identifiable data requested | IEC approval gate | controlled export |

## UX Contract

- Left sidebar selects report family.
- A global search bar searches every report/chart across every family by title, module, source, output, status, and permission.
- Status chips filter all charts by live, building, or planned.
- The Reports Center must not collapse each family into a single summary chart. Each family renders its own chart grid, and global search renders matching charts grouped by family.
- Main panel shows all chart tiles for the selected family. Large sections are acceptable; charts should remain actionable rather than summarized away.
- NABH is rendered as an indicator matrix with category filters, live/pending state, target, trend, denominator, and evidence note. It must not be hidden behind a coverage percentage.
- Each chart card has a three-dot menu.
- Menu actions: view details, CSV, Excel, PDF, chart image, secure share, schedule report, email now, source module.
- View details opens a modal with:
  - definition and formula
  - data sources
  - permission
  - filters
  - AI summary
  - red flags
  - appreciation flags
  - action items
  - schedule/share/export options
- Scheduled Reports is a separate section and each chart can also be scheduled directly.

## Data Model To Build

```sql
report_definitions(
  id, code, title, module, family, permission_code,
  chart_type, query_key, formula_json, filters_json,
  pii_level, nabh_standard_ref, is_active
)

report_schedules(
  id, report_definition_id, tenant_id, owner_user_id,
  cadence_type, cron_expr, timezone, recipients_json,
  formats_json, secure_link_ttl_hours, last_run_at, next_run_at, is_active
)

report_runs(
  id, schedule_id, report_definition_id, tenant_id,
  status, started_at, completed_at, row_count, artifact_refs_json,
  error, triggered_by_user_id
)

report_shares(
  id, report_run_id, tenant_id, token_hash, audience_json,
  expires_at, revoked_at, created_by_user_id
)

report_export_audit(
  id, report_definition_id, report_run_id, tenant_id,
  user_id, action, format, patient_identifiable,
  recipient_summary, created_at
)
```

## Build Sequence

1. Complete the native Reports Center chart grid and details modal.
2. Create `report_definitions` and register existing report APIs.
3. Create scheduled report tables and backend scheduler job.
4. Add export pipeline for CSV, Excel, PDF, chart image.
5. Add secure share links with expiry, watermark, and audit.
6. Add NABH evidence mapping per indicator.
7. Add predictive report registry with model governance fields.
8. Add detector workbench for outbreak/capacity/leakage signals.
