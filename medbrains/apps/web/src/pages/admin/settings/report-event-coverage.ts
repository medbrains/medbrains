import type { ClinicalEventName, ClinicalJourneyActionId } from "@medbrains/types";
import {
  CLINICAL_EVENT_REQUIRED_PAYLOAD_KEYS,
  CORE_PATIENT_JOURNEY_ACTIONS,
} from "@medbrains/types";

export type ReportEventCoverageReadiness = "capture_needed" | "event_backed";

export type ReportEventCoverageGap =
  | "capture-needed"
  | "missing-journey-action"
  | "missing-journey-event"
  | "missing-event-registry"
  | "missing-payload-evidence";

export interface ReportEventSourceDefinition {
  family: string;
  id: string;
  indicatorTargets: readonly string[];
  journeyActionIds: readonly ClinicalJourneyActionId[];
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
  journeyActionEvents: readonly ClinicalEventName[];
  journeyActionLabels: readonly string[];
  missingJourneyActionEvents: readonly ClinicalEventName[];
  missingJourneyActionIds: readonly string[];
  missingEvents: readonly string[];
  missingPayloadKeys: readonly string[];
}

export interface ReportEventCoverageSummary {
  captureNeeded: number;
  complete: number;
  eventBacked: number;
  gaps: number;
  indicatorTargets: number;
  journeyActionLinks: number;
  reportTargets: number;
  total: number;
}

export const REPORT_EVENT_COVERAGE_GAP_LABELS: Record<ReportEventCoverageGap, string> = {
  "capture-needed": "capture needed",
  "missing-journey-action": "journey action missing",
  "missing-journey-event": "journey event missing",
  "missing-event-registry": "event registry missing",
  "missing-payload-evidence": "payload evidence missing",
};

export const REPORT_EVENT_SOURCE_DEFINITIONS: readonly ReportEventSourceDefinition[] = [
  {
    family: "patient_flow",
    id: "patient-registration-opd-flow",
    indicatorTargets: ["access.flow", "opd.wait_time"],
    journeyActionIds: ["opd.open_visit", "patient.edit", "patient.share", "patient.print_card"],
    label: "Registration and OPD flow",
    readiness: "event_backed",
    reportTargets: [
      "enterprise-kpi-command-board",
      "opd-registration-arrivals",
      "opd-queue-wait-heatmap",
      "opd-consultant-slot-utilization",
    ],
    requiredPayloadKeys: [
      "patient_id",
      "search_id",
      "encounter_id",
      "queue_entry_id",
      "consultation_id",
      "appointment_id",
      "prescription_id",
      "certificate_id",
      "consent_id",
    ],
    sourceEvents: [
      "patient.created",
      "patient.updated",
      "patient.search.completed",
      "patient.access_shared",
      "patient.card_printed",
      "opd.encounter.created",
      "opd.queue.called",
      "opd.consultation.started",
      "opd.vitals.recorded",
      "opd.consultation.saved",
      "opd.encounter.completed",
      "opd.followup.scheduled",
      "opd.prescription.updated",
      "opd.certificate.created",
      "opd.consent.signed",
    ],
    standardRefs: ["NABH AAC", "IPSG patient identification"],
  },
  {
    family: "patient_flow",
    id: "ipd-census-discharge-flow",
    indicatorTargets: ["ipd.occupancy", "ipd.discharge_tat", "ipd.bed_turnaround"],
    journeyActionIds: ["ipd.admit", "ipd.open_admission", "mrd.open_case_sheet"],
    label: "IPD census, bed movement and discharge",
    readiness: "event_backed",
    reportTargets: [
      "ipd-census-bed-occupancy",
      "ipd-alos-case-mix",
      "ipd-bed-turnaround-delay",
      "ipd-discharge-delay-readmission",
    ],
    requiredPayloadKeys: [
      "patient_id",
      "admission_id",
      "bed_id",
      "summary_id",
      "packet_id",
      "packet_type",
    ],
    sourceEvents: [
      "ipd.admission.created",
      "bed.assigned",
      "bed.transferred",
      "ipd.discharge.initiated",
      "ipd.discharge.completed",
      "ipd.discharge.finalized",
      "mrd.case_sheet.generated",
      "mrd.case_sheet.printed",
    ],
    standardRefs: ["NABH COP discharge process", "IPSG patient identification"],
  },
  {
    family: "patient_flow",
    id: "emergency-mlc-flow",
    indicatorTargets: ["emergency.triage", "mlc.reporting"],
    journeyActionIds: ["emergency.open_visit", "emergency.open_mlc"],
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
    journeyActionIds: ["camp.open_context"],
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
    journeyActionIds: ["orders.lab", "orders.radiology"],
    label: "Orders, lab results and radiology reports",
    readiness: "event_backed",
    reportTargets: [
      "lab-end-to-end-tat",
      "lab-critical-value-notification",
      "radiology-modality-utilization",
      "radiology-order-report-tat-backlog",
      "radiology-quality-critical-findings",
    ],
    requiredPayloadKeys: ["patient_id", "order_id", "report_id", "reason"],
    sourceEvents: [
      "order.created",
      "order.cancelled",
      "lab.sample_collected",
      "lab.result.posted",
      "lab.result.verified",
      "lab.order.completed",
      "radiology.order.completed",
      "radiology.report.created",
      "radiology.report.verified",
    ],
    standardRefs: ["NABL traceability", "DICOM workflow", "NABH AOP"],
  },
  {
    family: "pharmacy",
    id: "pharmacy-fulfillment-regulatory-flow",
    indicatorTargets: ["pharmacy.tat", "pharmacy.ndps_compliance", "inventory.stock_movement"],
    journeyActionIds: [
      "orders.medication",
      "pharmacy.dispense_order",
      "pharmacy.open_patient_queue",
    ],
    label: "Pharmacy fulfillment, stock and NDPS movement",
    readiness: "event_backed",
    reportTargets: [
      "pharmacy-fulfillment-turnaround",
      "pharmacy-stockout-expiry-days-on-hand",
      "pharmacy-ndps-high-risk-compliance",
      "pharmacy-safety-returns-margin-leakage",
    ],
    requiredPayloadKeys: [
      "patient_id",
      "order_id",
      "reason",
      "requisition_id",
      "department_id",
      "entry_id",
      "catalog_item_id",
    ],
    sourceEvents: [
      "order.created",
      "order.cancelled",
      "indent.requisition.submitted",
      "indent.requisition.approved",
      "indent.requisition.issued",
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
    journeyActionIds: [
      "billing.open_ledger",
      "billing.prepare_discharge_bill",
      "billing.collect_payment",
    ],
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
    journeyActionIds: [],
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

function journeyActionById() {
  return new Map(CORE_PATIENT_JOURNEY_ACTIONS.map((action) => [action.id, action]));
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
  const actionsById = journeyActionById();

  return definitions.map((definition) => {
    const availablePayloadKeys = payloadKeysForEvents(definition.sourceEvents);
    const availablePayloadKeySet = new Set(availablePayloadKeys);
    const sourceEventSet = new Set(definition.sourceEvents);
    const journeyActions = definition.journeyActionIds
      .map((actionId) => actionsById.get(actionId))
      .filter((action) => action !== undefined);
    const journeyActionLabels = journeyActions.map((action) => action.label);
    const journeyActionEvents = [
      ...new Set(
        journeyActions.flatMap((action) => (action.emitsEvent ? [action.emitsEvent] : [])),
      ),
    ];
    const missingJourneyActionIds = definition.journeyActionIds.filter(
      (actionId) => !actionsById.has(actionId),
    );
    const missingJourneyActionEvents = journeyActionEvents.filter(
      (eventName) => !sourceEventSet.has(eventName),
    );
    const missingEvents = definition.sourceEvents.filter((eventName) => !events.has(eventName));
    const missingPayloadKeys = definition.requiredPayloadKeys.filter(
      (key) => !availablePayloadKeySet.has(key),
    );
    const gaps: ReportEventCoverageGap[] = [];

    if (definition.readiness === "capture_needed") gaps.push("capture-needed");
    if (missingJourneyActionIds.length > 0) gaps.push("missing-journey-action");
    if (missingJourneyActionEvents.length > 0) gaps.push("missing-journey-event");
    if (missingEvents.length > 0) gaps.push("missing-event-registry");
    if (missingPayloadKeys.length > 0) gaps.push("missing-payload-evidence");

    return {
      ...definition,
      availablePayloadKeys,
      gaps,
      journeyActionEvents,
      journeyActionLabels,
      missingJourneyActionEvents,
      missingJourneyActionIds,
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
    journeyActionLinks: new Set(rows.flatMap((row) => [...row.journeyActionIds])).size,
    reportTargets: new Set(rows.flatMap((row) => [...row.reportTargets])).size,
    total: rows.length,
  };
}
