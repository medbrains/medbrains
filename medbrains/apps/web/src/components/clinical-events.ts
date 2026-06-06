import {
  CLINICAL_EVENT_REQUIRED_PAYLOAD_KEYS,
  type ClinicalEventName,
  type ClinicalEventSourceModule,
} from "@medbrains/types";

export interface ClinicalEventTrace {
  id: string;
  rawTrigger: string;
  eventName: ClinicalEventName | null;
  sourceModule: ClinicalEventSourceModule;
  contextCode: string;
  occurredAt: string;
  patientId: string | null;
  admissionId: string | null;
  encounterId: string | null;
  sourceRecordId: string | null;
  missingPayloadKeys: readonly string[];
  payload: Record<string, unknown>;
}

interface BuildClinicalEventTraceInput {
  contextCode: string;
  moduleCode: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  rawTrigger: string;
}

const TRIGGER_ALIASES: Record<string, ClinicalEventName> = {
  "appointment.checked_in_to_opd": "opd.encounter.created",
  "camp.registration_created": "camp.registration.created",
  "camp.screening_completed": "camp.screening.completed",
  "consultation.saved": "opd.consultation.saved",
  "consultation.started": "opd.consultation.started",
  "discharge.completed": "ipd.discharge.completed",
  "encounter.completed": "opd.encounter.completed",
  "emergency.visit_created": "emergency.visit.created",
  "er.visit.created": "emergency.visit.created",
  "followup.scheduled": "opd.followup.scheduled",
  "invoice.created": "billing.invoice.created",
  "invoice.issued": "billing.invoice.finalized",
  "lab.completed": "lab.result.posted",
  "lab.order_created": "order.created",
  "lab.ordered": "order.created",
  "lab.results_verified": "lab.result.verified",
  "mlc.case.created": "mlc.created",
  "mlc.police_intimation.created": "emergency.mlc_police_intimation.created",
  "mrd.case_sheet.sent": "mrd.case_sheet.generated",
  "order.dispensed": "pharmacy.order.dispensed",
  "patient.called": "opd.queue.called",
  "payment.recorded": "billing.payment.received",
  "pharmacy.order.created": "order.created",
  "prescription.updated_before_pharmacy_approval": "opd.prescription.updated",
  "prescription.created": "order.created",
  "procedure.ordered": "order.created",
  "radiology.order.created": "order.created",
  "radiology.order.completed": "radiology.order.completed",
  "radiology.report.verified": "radiology.report.verified",
  "stock.movement": "pharmacy.stock.movement.created",
  "transfer.completed": "bed.transferred",
  "vitals.recorded": "opd.vitals.recorded",
};

const SOURCE_MODULES: Record<string, ClinicalEventSourceModule> = {
  billing: "billing",
  bme: "bme",
  camp: "camp",
  emergency: "emergency",
  housekeeping: "housekeeping",
  indent: "integration",
  ipd: "ipd",
  lab: "lab",
  mrd: "mrd",
  opd: "opd",
  order_basket: "order_basket",
  patients: "patients",
  pharmacy: "pharmacy",
  quality: "quality",
  radiology: "radiology",
};

function isClinicalEventName(value: string): value is ClinicalEventName {
  return value in CLINICAL_EVENT_REQUIRED_PAYLOAD_KEYS;
}

export function normalizeClinicalEventName(rawTrigger: string): ClinicalEventName | null {
  if (isClinicalEventName(rawTrigger)) {
    return rawTrigger;
  }
  return TRIGGER_ALIASES[rawTrigger] ?? null;
}

function stringValue(payload: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function sourceModule(moduleCode: string): ClinicalEventSourceModule {
  return SOURCE_MODULES[moduleCode] ?? "integration";
}

function missingPayloadKeys(
  eventName: ClinicalEventName | null,
  payload: Record<string, unknown>,
): readonly string[] {
  if (!eventName) {
    return [];
  }
  return CLINICAL_EVENT_REQUIRED_PAYLOAD_KEYS[eventName].filter((key) => payload[key] == null);
}

export function buildClinicalEventTrace({
  contextCode,
  moduleCode,
  occurredAt,
  payload,
  rawTrigger,
}: BuildClinicalEventTraceInput): ClinicalEventTrace {
  const eventName = normalizeClinicalEventName(rawTrigger);
  const sourceRecordId = stringValue(payload, [
    "source_record_id",
    "summary_id",
    "search_id",
    "report_id",
    "certificate_id",
    "consent_id",
    "intimation_id",
    "mlc_case_id",
    "code_activation_id",
    "code_blue_id",
    "consultation_id",
    "vital_id",
    "entry_id",
    "payment_id",
    "invoice_id",
    "packet_id",
    "batch_id",
    "order_id",
    "appointment_id",
    "queue_entry_id",
    "registration_id",
    "camp_registration_id",
    "screening_id",
    "camp_id",
    "prescription_id",
    "transfer_id",
    "visit_id",
    "encounter_id",
    "admission_id",
    "patient_id",
  ]);

  return {
    id: `${occurredAt}:${moduleCode}:${contextCode}:${rawTrigger}`,
    rawTrigger,
    eventName,
    sourceModule: sourceModule(moduleCode),
    contextCode,
    occurredAt,
    patientId: stringValue(payload, ["patient_id", "patientId"]),
    admissionId: stringValue(payload, ["admission_id", "admissionId"]),
    encounterId: stringValue(payload, ["encounter_id", "encounterId"]),
    sourceRecordId,
    missingPayloadKeys: missingPayloadKeys(eventName, payload),
    payload,
  };
}
