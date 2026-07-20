// Reports domain briefs (static data) — split from reports.tsx (pure move).

export type ReportDomain =
  | "executive"
  | "opd"
  | "ipd"
  | "lab"
  | "radiology"
  | "pharmacy"
  | "finance"
  | "camp"
  | "quality"
  | "community"
  | "body"
  | "security"
  | "predictive"
  | "nmc";

export interface ReportDomainBrief {
  label: string;
  audience: string;
  managementUse: string;
  leadingSignals: string;
  prediction: string;
  redFlag: string;
  goodSignal: string;
}

export const REPORT_DOMAIN_BRIEFS: Record<ReportDomain, ReportDomainBrief> = {
  executive: {
    label: "Executive command",
    audience: "CEO, medical superintendent, COO, and hospital administrator",
    managementUse: "see the daily operating pressure before department meetings start",
    leadingSignals:
      "capacity pressure, collections movement, service delays, and unresolved safety events",
    prediction:
      "anticipate the next operational choke point by combining queue velocity, bed pressure, cash lag, and safety exceptions",
    redFlag:
      "multiple departments breaching together means this is a hospital-level escalation, not a local dashboard issue",
    goodSignal:
      "the same board links capacity, money, safety, and delay signals before managers act",
  },
  opd: {
    label: "OPD management",
    audience: "OPD manager, reception lead, consultants, and duty administrator",
    managementUse:
      "balance front-desk load, consultant slots, walk-ins, no-shows, and repeat visits",
    leadingSignals:
      "arrival pattern, queue age, consultant utilization, and revisit or no-show cohorts",
    prediction:
      "anticipate clinic crowding and appointment leakage from arrival velocity, slot utilization, and prior no-show behavior",
    redFlag:
      "high wait time with idle consultant slots usually indicates registration, token, or routing failure",
    goodSignal:
      "registration, queue, consultation, and follow-up data can be drilled into the same operating flow",
  },
  ipd: {
    label: "IPD management",
    audience: "nursing superintendent, ward in-charge, bed manager, and treating units",
    managementUse:
      "control bed availability, discharge friction, long stay, transfers, and ward throughput",
    leadingSignals:
      "occupancy, bed class pressure, discharge barriers, housekeeping lag, and readmission watch",
    prediction:
      "anticipate next-shift bed shortage from active census, expected discharges, blocked beds, and admission pipeline",
    redFlag:
      "high occupancy with delayed discharge and slow bed turnaround requires immediate bed-management review",
    goodSignal:
      "bed, admission, discharge, and ward drilldowns are explicit before any occupancy chart becomes live",
  },
  lab: {
    label: "Lab operations",
    audience: "lab director, pathologist, lab manager, quality officer, and clinical units",
    managementUse:
      "reduce diagnostic delay, critical-value miss, sample rejection, QC failure, and outsourcing dependence",
    leadingSignals:
      "sample age, validation age, critical alert acknowledgement, rejection reasons, and analyzer section load",
    prediction:
      "anticipate TAT breach from pending queue age, priority mix, analyzer load, collection backlog, and verification delay",
    redFlag:
      "critical values without acknowledgement are clinical-risk events and need escalation, not just a report note",
    goodSignal:
      "the report separates collection, processing, validation, and notification so action ownership is clear",
  },
  radiology: {
    label: "Radiology operations",
    audience: "radiology head, modality supervisor, reporting radiologist, and operations lead",
    managementUse:
      "control modality load, RIS/PACS backlog, reporting delay, dose safety, and critical finding communication",
    leadingSignals:
      "order age, scan completion, report verification, modality queue, repeat scans, and critical-finding acknowledgement",
    prediction:
      "anticipate imaging backlog from modality utilization, aged orders, reporting queue, machine downtime, and priority mix",
    redFlag:
      "critical findings without documented communication are patient-safety and medicolegal exceptions",
    goodSignal:
      "DICOM/RIS/reporting sources are separated so workflow delay and storage delay are not mixed",
  },
  pharmacy: {
    label: "Pharmacy management",
    audience: "pharmacy manager, clinical pharmacist, purchase lead, and finance controller",
    managementUse:
      "control fulfillment, stock risk, expiry loss, controlled drugs, ADRs, returns, and margin leakage",
    leadingSignals:
      "partial fills, stock days, batch age, reorder pressure, NDPS balance, return volume, and ADR trend",
    prediction:
      "anticipate stockout or expiry loss from consumption velocity, batch age, reorder level, and vendor lead time",
    redFlag: "controlled-drug issue, return, and witness events must balance by shift and register",
    goodSignal:
      "the report links medication safety, inventory, and money leakage rather than treating pharmacy as sales only",
  },
  finance: {
    label: "Finance control",
    audience: "CFO, finance controller, billing lead, cashier lead, and hospital administrator",
    managementUse:
      "track gross-to-net revenue, collections, settlement variance, A/R, DNFB, refunds, denials, and concessions",
    leadingSignals:
      "collection lag, unpaid discharge, payer aging, concession growth, refund reason, denial reason, and settlement variance",
    prediction:
      "anticipate day-close cash gap and revenue leakage from billing mix, concessions, refunds, payer lag, and unbilled services",
    redFlag:
      "revenue growth with worsening collections or DNFB means cash is not converting, even if billing looks healthy",
    goodSignal:
      "finance reports declare payer, department, cashier, counter, and approval drilldowns for accountability",
  },
  camp: {
    label: "Camp and outreach",
    audience: "camp coordinator, outreach lead, medical officer, and hospital operations team",
    managementUse:
      "measure field turnout, screening yield, referral conversion, offline sync health, supplies, and field incidents",
    leadingSignals:
      "village turnout, positive screens, referral arrival, sync lag, device failures, and supply consumption",
    prediction:
      "anticipate referral leakage and locality clusters by comparing positive screens with hospital arrival and follow-up windows",
    redFlag:
      "downloaded camp packets with stale sync or expired data must not drive clinical decisions",
    goodSignal:
      "camp reports connect field work back to hospital conversion, follow-up, and data safety",
  },
  quality: {
    label: "NABH and quality",
    audience: "quality head, committee chairs, medical superintendent, and department owners",
    managementUse:
      "track indicator evidence, incidents, sentinel events, CAPA aging, audit closure, feedback, and complaints",
    leadingSignals:
      "indicator breach, overdue CAPA, repeated incident type, complaint aging, committee delay, and evidence gap",
    prediction:
      "anticipate accreditation risk from unresolved evidence gaps, repeat incidents, overdue CAPA, and weak owner closure",
    redFlag: "repeat incidents without CAPA closure indicate system failure, not isolated variance",
    goodSignal:
      "NABH evidence, quality events, audit actions, and patient voice sit in the same management loop",
  },
  community: {
    label: "Community intelligence",
    audience: "hospital strategy team, outreach lead, public-health lead, and service-line heads",
    managementUse:
      "understand catchment, disease burden, referral flow, follow-up loss, and underserved geography",
    leadingSignals:
      "village/pincode origin, disease density, referral source, travel burden, service penetration, and follow-up completion",
    prediction:
      "anticipate disease clusters or access gaps by comparing locality signal density with moving baseline and camp coverage",
    redFlag:
      "small-cell locality reports can identify patients and must be suppressed unless permitted",
    goodSignal: "geo reports are designed around catchment decisions, not decorative maps",
  },
  body: {
    label: "Clinical body maps",
    audience:
      "specialty clinicians, nursing quality teams, wound-care teams, and clinical auditors",
    managementUse:
      "spot anatomical burden, wound progression, dental needs, pain movement, and specialty-region patterns",
    leadingSignals:
      "body region, laterality, severity, stage, follow-up change, and treatment burden",
    prediction:
      "anticipate deterioration or follow-up need from persistent region severity, stage progression, and missed reassessment",
    redFlag:
      "clinical body-map output is patient-identifiable and must remain under governed clinical access",
    goodSignal: "anatomy-aware reports can show clinical burden that normal tables hide",
  },
  security: {
    label: "Security and data quality",
    audience: "CISO, data protection lead, MRD lead, quality officer, and administrator",
    managementUse:
      "monitor identity quality, ABHA linkage, duplicates, unsigned records, amendments, exports, and access anomalies",
    leadingSignals:
      "missing identifiers, duplicate confidence, unsigned age, amendment frequency, after-hours access, and break-glass usage",
    prediction:
      "anticipate investigation workload from abnormal access clusters, old unsigned records, and duplicate identity risk",
    redFlag:
      "privileged export or after-hours cross-location access needs immediate review and audit context",
    goodSignal:
      "trust reports combine data completeness, legal signature state, and access behavior",
  },
  predictive: {
    label: "Predictive workbench",
    audience: "operations leadership, quality team, finance, pharmacy, and department owners",
    managementUse:
      "convert historical HMS signals into reviewed forecasts, anomaly bands, and action queues",
    leadingSignals: "trend, seasonality, baseline variance, confidence, drift, and owner backlog",
    prediction:
      "produce a review-required forecast with confidence band and explanation, never an automatic decision",
    redFlag:
      "prediction without source freshness, model version, confidence, and reviewer status should be hidden",
    goodSignal:
      "forecast reports are separated from live descriptive reports so governance is explicit",
  },
  nmc: {
    label: "NMC teaching overlay",
    audience: "dean, medical superintendent, academic coordinator, MRD head, and department heads",
    managementUse:
      "track teaching-hospital evidence for specialty occupancy, OPD attendance, clinical material, procedures, and MRD readiness",
    leadingSignals:
      "specialty census, OPD volume, faculty unit, procedure breadth, record completeness, and audit availability",
    prediction:
      "anticipate inspection gaps where clinical material, occupancy, or records fall below the expected teaching threshold",
    redFlag:
      "NMC evidence must match validated hospital records, not manual spreadsheet-only counts",
    goodSignal:
      "clinical activity and MRD availability are linked before teaching evidence is shown",
  },
};
