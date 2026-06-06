import type { ClinicalEventName } from "@medbrains/types";
import { CLINICAL_EVENT_REQUIRED_PAYLOAD_KEYS } from "@medbrains/types";

export type ReportEventCoverageReadiness = "capture_needed" | "event_backed";

export type ReportEventCoverageGap =
  | "capture-needed"
  | "missing-event-registry"
  | "missing-payload-evidence";

export interface ReportEventSourceDefinition {
  family: string;
  id: string;
  indicatorTargets: readonly string[];
  label: string;
  readiness: ReportEventCoverageReadiness;
  reportTargets: readonly string[];
  requiredPayloadKeys: readonly string[];
  sourceEvents: readonly ClinicalEventName[];
  standardRefs: readonly string[];
}

export interface ReportEventCoverageRow extends ReportEventSourceDefinition {
  availablePayloadKeys: readonly string[];
  gaps: readonly ReportEventCoverageGap[];
  missingEvents: readonly string[];
  missingPayloadKeys: readonly string[];
}

export interface ReportEventCoverageSummary {
  captureNeeded: number;
  complete: number;
  eventBacked: number;
  gaps: number;
  indicatorTargets: number;
  reportTargets: number;
  total: number;
}

export const REPORT_EVENT_COVERAGE_GAP_LABELS: Record<ReportEventCoverageGap, string> = {
  "capture-needed": "capture needed",
  "missing-event-registry": "event registry missing",
  "missing-payload-evidence": "payload evidence missing",
};

export const REPORT_EVENT_SOURCE_DEFINITIONS: readonly ReportEventSourceDefinition[] = [
  {
    family: "patient_flow",
    id: "patient-registration-opd-flow",
    indicatorTargets: ["access.flow", "opd.wait_time"],
    label: "Registration and OPD flow",
    readiness: "event_backed",
    reportTargets: [
      "enterprise-kpi-command-board",
      "opd-registration-arrivals",
      "opd-queue-wait-heatmap",
      "opd-consultant-slot-utilization",
    ],
    requiredPayloadKeys: ["patient_id", "encounter_id", "queue_entry_id"],
    sourceEvents: [
      "patient.created",
      "opd.encounter.created",
      "opd.queue.called",
      "opd.consultation.started",
      "opd.encounter.completed",
    ],
    standardRefs: ["NABH AAC", "IPSG patient identification"],
  },
  {
    family: "patient_flow",
    id: "ipd-census-discharge-flow",
    indicatorTargets: ["ipd.occupancy", "ipd.discharge_tat", "ipd.bed_turnaround"],
    label: "IPD census, bed movement and discharge",
    readiness: "event_backed",
    reportTargets: [
      "ipd-census-bed-occupancy",
      "ipd-alos-case-mix",
      "ipd-bed-turnaround-delay",
      "ipd-discharge-delay-readmission",
    ],
    requiredPayloadKeys: ["patient_id", "admission_id", "bed_id", "summary_id"],
    sourceEvents: [
      "ipd.admission.created",
      "bed.assigned",
      "bed.transferred",
      "ipd.discharge.initiated",
      "ipd.discharge.completed",
      "ipd.discharge.finalized",
    ],
    standardRefs: ["NABH COP discharge process", "IPSG patient identification"],
  },
  {
    family: "patient_flow",
    id: "emergency-mlc-flow",
    indicatorTargets: ["emergency.triage", "mlc.reporting"],
    label: "Emergency and medico-legal flow",
    readiness: "event_backed",
    reportTargets: ["safety-compliance-red-flags", "quality-incident-sentinel-trend"],
    requiredPayloadKeys: ["patient_id", "visit_id", "mlc_case_id"],
    sourceEvents: [
      "emergency.visit.created",
      "mlc.created",
      "emergency.mlc_police_intimation.created",
    ],
    standardRefs: ["NABH AAC", "MLC SOP", "CrPC medico-legal reporting"],
  },
  {
    family: "outreach",
    id: "camp-outreach-flow",
    indicatorTargets: ["camp.turnout", "camp.referral_conversion"],
    label: "Camp outreach registration and screening",
    readiness: "event_backed",
    reportTargets: [
      "camp-coverage-turnout",
      "camp-screening-referral-conversion",
      "camp-disease-followup-map",
    ],
    requiredPayloadKeys: ["camp_id", "patient_id", "registration_id", "screening_id"],
    sourceEvents: ["camp.started", "camp.registration.created", "camp.screening.completed"],
    standardRefs: ["NABH AAC", "Continuity of care for outreach services"],
  },
  {
    family: "diagnostics",
    id: "diagnostic-order-result-flow",
    indicatorTargets: ["lab.tat", "radiology.tat", "critical_results"],
    label: "Orders, lab results and radiology reports",
    readiness: "event_backed",
    reportTargets: [
      "lab-end-to-end-tat",
      "lab-critical-value-notification",
      "radiology-modality-utilization",
      "radiology-order-report-tat-backlog",
      "radiology-quality-critical-findings",
    ],
    requiredPayloadKeys: ["patient_id", "order_id", "report_id"],
    sourceEvents: [
      "order.created",
      "lab.result.verified",
      "lab.order.completed",
      "radiology.order.completed",
      "radiology.report.verified",
    ],
    standardRefs: ["NABL traceability", "DICOM workflow", "NABH AOP"],
  },
  {
    family: "pharmacy",
    id: "pharmacy-fulfillment-regulatory-flow",
    indicatorTargets: ["pharmacy.tat", "pharmacy.ndps_compliance", "inventory.stock_movement"],
    label: "Pharmacy fulfillment, stock and NDPS movement",
    readiness: "event_backed",
    reportTargets: [
      "pharmacy-fulfillment-turnaround",
      "pharmacy-stockout-expiry-days-on-hand",
      "pharmacy-ndps-high-risk-compliance",
      "pharmacy-safety-returns-margin-leakage",
    ],
    requiredPayloadKeys: ["patient_id", "order_id", "entry_id", "catalog_item_id"],
    sourceEvents: [
      "order.created",
      "pharmacy.order.dispensed",
      "pharmacy.stock.movement.created",
      "pharmacy.ndps.movement.created",
    ],
    standardRefs: ["NABH MOM", "Drugs and Cosmetics Act", "NDPS Act"],
  },
  {
    family: "finance",
    id: "billing-revenue-flow",
    indicatorTargets: ["billing.collection", "billing.dnfb", "finance.revenue"],
    label: "Billing invoice, finalization and payment",
    readiness: "event_backed",
    reportTargets: [
      "revenue-collections-leakage",
      "billing-gross-net-payer-mix",
      "billing-collections-settlement",
      "billing-ar-dnfb-unpaid-discharge",
    ],
    requiredPayloadKeys: ["patient_id", "invoice_id", "payment_id", "total_amount"],
    sourceEvents: [
      "billing.invoice.created",
      "billing.invoice.finalized",
      "billing.payment.received",
    ],
    standardRefs: ["NABH PRE financial counselling", "GST healthcare billing controls"],
  },
  {
    family: "quality",
    id: "nabh-safety-evidence-flow",
    indicatorTargets: [
      "quality.incidents",
      "code_blue.response",
      "blood.transfusion_reaction",
      "bme.downtime",
      "bmw.disposal",
    ],
    label: "NABH safety, emergency response and facility evidence",
    readiness: "event_backed",
    reportTargets: ["nabh-evidence-matrix", "safety-compliance-red-flags"],
    requiredPayloadKeys: [
      "incident_id",
      "code_blue_id",
      "reaction_id",
      "downtime_id",
      "disposal_id",
    ],
    sourceEvents: [
      "quality.incident.reported",
      "emergency.code_blue.activated",
      "emergency.code_blue.completed",
      "blood.transfusion_reaction.reported",
      "bme.equipment_downtime.recorded",
      "housekeeping.bmw_disposal.recorded",
    ],
    standardRefs: ["NABH PSQ", "NABH FMS", "Biomedical Waste Management Rules 2016"],
  },
] as const;

function registeredEventNames() {
  return new Set(Object.keys(CLINICAL_EVENT_REQUIRED_PAYLOAD_KEYS));
}

function payloadKeysForEvents(events: readonly ClinicalEventName[]) {
  return [
    ...new Set(events.flatMap((eventName) => [...CLINICAL_EVENT_REQUIRED_PAYLOAD_KEYS[eventName]])),
  ].sort();
}

export function buildReportEventCoverage(
  definitions: readonly ReportEventSourceDefinition[] = REPORT_EVENT_SOURCE_DEFINITIONS,
): ReportEventCoverageRow[] {
  const events = registeredEventNames();

  return definitions.map((definition) => {
    const availablePayloadKeys = payloadKeysForEvents(definition.sourceEvents);
    const availablePayloadKeySet = new Set(availablePayloadKeys);
    const missingEvents = definition.sourceEvents.filter((eventName) => !events.has(eventName));
    const missingPayloadKeys = definition.requiredPayloadKeys.filter(
      (key) => !availablePayloadKeySet.has(key),
    );
    const gaps: ReportEventCoverageGap[] = [];

    if (definition.readiness === "capture_needed") gaps.push("capture-needed");
    if (missingEvents.length > 0) gaps.push("missing-event-registry");
    if (missingPayloadKeys.length > 0) gaps.push("missing-payload-evidence");

    return {
      ...definition,
      availablePayloadKeys,
      gaps,
      missingEvents,
      missingPayloadKeys,
    };
  });
}

export function summarizeReportEventCoverage(
  rows: readonly ReportEventCoverageRow[],
): ReportEventCoverageSummary {
  return {
    captureNeeded: rows.filter((row) => row.readiness === "capture_needed").length,
    complete: rows.filter((row) => row.gaps.length === 0).length,
    eventBacked: rows.filter((row) => row.readiness === "event_backed").length,
    gaps: rows.filter((row) => row.gaps.length > 0).length,
    indicatorTargets: new Set(rows.flatMap((row) => [...row.indicatorTargets])).size,
    reportTargets: new Set(rows.flatMap((row) => [...row.reportTargets])).size,
    total: rows.length,
  };
}
