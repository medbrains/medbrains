// Schema registry types — split from index.ts, barrel-re-exported.

// ── Schema Registry ─────────────────────────────────────

export interface SchemaField {
  path: string;
  type: string;
  label: string;
  description?: string;
}

export interface ModuleEntitySchema {
  id: string;
  module_code: string;
  entity_code: string;
  entity_label: string;
  fields: SchemaField[];
}

export interface EventSchema {
  id: string;
  event_type: string;
  module_code: string;
  label: string;
  description?: string;
  payload_schema: SchemaField[];
  entity_code?: string;
}

export type ClinicalEventName =
  | "patient.created"
  | "patient.updated"
  | "patient.merged"
  | "patient.access_shared"
  | "patient.card_printed"
  | "patient.search.completed"
  | "visit.created"
  | "emergency.visit.created"
  | "mlc.created"
  | "emergency.mlc_police_intimation.created"
  | "opd.encounter.created"
  | "opd.queue.called"
  | "opd.consultation.started"
  | "opd.vitals.recorded"
  | "opd.consultation.saved"
  | "opd.encounter.completed"
  | "opd.followup.scheduled"
  | "opd.prescription.updated"
  | "opd.certificate.created"
  | "opd.consent.signed"
  | "camp.started"
  | "camp.registration.created"
  | "camp.screening.completed"
  | "order.created"
  | "order.cancelled"
  | "lab.sample_collected"
  | "lab.result.posted"
  | "lab.result.verified"
  | "lab.order.completed"
  | "radiology.report.created"
  | "radiology.report.verified"
  | "radiology.order.completed"
  | "billing.invoice.created"
  | "billing.invoice.finalized"
  | "billing.payment.received"
  | "pharmacy.order.dispensed"
  | "pharmacy.prescription.reviewed"
  | "pharmacy.stock.movement.created"
  | "pharmacy.ndps.movement.created"
  | "indent.requisition.submitted"
  | "indent.requisition.approved"
  | "indent.requisition.issued"
  | "ipd.admission.created"
  | "bed.assigned"
  | "bed.transferred"
  | "ipd.discharge.initiated"
  | "ipd.discharge.completed"
  | "ipd.discharge.finalized"
  | "mrd.case_sheet.generated"
  | "mrd.case_sheet.printed"
  | "quality.incident.reported"
  | "emergency.code_blue.activated"
  | "emergency.code_blue.completed"
  | "blood.transfusion_reaction.reported"
  | "bme.equipment_downtime.recorded"
  | "housekeeping.bmw_disposal.recorded";

export type ClinicalEventSourceModule =
  | "patients"
  | "opd"
  | "order_basket"
  | "lab"
  | "radiology"
  | "billing"
  | "pharmacy"
  | "indent"
  | "ipd"
  | "camp"
  | "quality"
  | "emergency"
  | "blood_bank"
  | "bme"
  | "housekeeping"
  | "mrd"
  | "integration";

export interface ClinicalEventEnvelope {
  tenant_id: string;
  event_name: ClinicalEventName;
  source_module: ClinicalEventSourceModule;
  source_record_id: string;
  actor_id: string;
  occurred_at: string;
  patient_id?: string | null;
  admission_id?: string | null;
  encounter_id?: string | null;
  department_id?: string | null;
  payload: Record<string, unknown>;
}

export const CLINICAL_EVENT_REQUIRED_PAYLOAD_KEYS: Record<ClinicalEventName, readonly string[]> = {
  "patient.created": ["patient_id"],
  "patient.updated": ["patient_id"],
  "patient.merged": ["surviving_patient_id", "merged_patient_id"],
  "patient.access_shared": ["patient_id"],
  "patient.card_printed": ["patient_id"],
  "patient.search.completed": ["search_id"],
  "visit.created": ["visit_id", "patient_id"],
  "emergency.visit.created": ["visit_id", "patient_id"],
  "mlc.created": ["mlc_case_id", "patient_id"],
  "emergency.mlc_police_intimation.created": ["intimation_id", "mlc_case_id", "patient_id"],
  "opd.encounter.created": ["encounter_id", "patient_id"],
  "opd.queue.called": ["queue_entry_id", "encounter_id", "patient_id"],
  "opd.consultation.started": ["queue_entry_id", "encounter_id", "patient_id"],
  "opd.vitals.recorded": ["encounter_id", "patient_id"],
  "opd.consultation.saved": ["consultation_id", "encounter_id", "patient_id"],
  "opd.encounter.completed": ["encounter_id", "patient_id"],
  "opd.followup.scheduled": ["appointment_id", "patient_id"],
  "opd.prescription.updated": ["prescription_id", "encounter_id", "patient_id"],
  "opd.certificate.created": ["certificate_id", "patient_id"],
  "opd.consent.signed": ["consent_id", "patient_id"],
  "camp.started": ["camp_id"],
  "camp.registration.created": ["registration_id", "camp_id", "patient_id"],
  "camp.screening.completed": ["screening_id", "camp_id", "patient_id"],
  "order.created": ["order_id", "order_type", "patient_id"],
  "order.cancelled": ["order_id", "order_type", "reason"],
  "lab.sample_collected": ["order_id", "patient_id"],
  "lab.result.posted": ["order_id", "patient_id"],
  "lab.result.verified": ["order_id", "patient_id"],
  "lab.order.completed": ["order_id", "patient_id"],
  "radiology.report.created": ["report_id", "order_id", "patient_id"],
  "radiology.report.verified": ["report_id", "order_id", "patient_id"],
  "radiology.order.completed": ["order_id", "patient_id"],
  "billing.invoice.created": ["invoice_id", "patient_id", "total_amount"],
  "billing.invoice.finalized": ["invoice_id", "patient_id"],
  "billing.payment.received": ["payment_id", "invoice_id", "patient_id"],
  "pharmacy.order.dispensed": ["order_id", "patient_id", "items"],
  "pharmacy.prescription.reviewed": [
    "rx_queue_id",
    "prescription_id",
    "patient_id",
    "review_status",
    "pharmacy_order_id",
    "billing_invoice_id",
  ],
  "pharmacy.stock.movement.created": ["transaction_type", "quantity"],
  "pharmacy.ndps.movement.created": ["entry_id", "catalog_item_id", "action"],
  "indent.requisition.submitted": [
    "requisition_id",
    "department_id",
    "indent_type",
    "requested_by",
    "status",
  ],
  "indent.requisition.approved": [
    "requisition_id",
    "department_id",
    "indent_type",
    "approved_by",
    "status",
  ],
  "indent.requisition.issued": [
    "requisition_id",
    "department_id",
    "indent_type",
    "issued_by",
    "status",
  ],
  "ipd.admission.created": ["admission_id", "patient_id"],
  "bed.assigned": ["bed_id", "admission_id", "patient_id"],
  "bed.transferred": ["transfer_id", "admission_id", "from_bed_id", "to_bed_id"],
  "ipd.discharge.initiated": ["admission_id", "patient_id"],
  "ipd.discharge.completed": ["admission_id", "patient_id"],
  "ipd.discharge.finalized": ["summary_id", "admission_id", "patient_id"],
  "mrd.case_sheet.generated": ["packet_id", "packet_type", "patient_id"],
  "mrd.case_sheet.printed": ["packet_id", "patient_id"],
  "quality.incident.reported": ["incident_id"],
  "emergency.code_blue.activated": ["code_blue_id"],
  "emergency.code_blue.completed": ["code_blue_id"],
  "blood.transfusion_reaction.reported": ["reaction_id", "transfusion_id", "patient_id"],
  "bme.equipment_downtime.recorded": ["downtime_id", "equipment_id"],
  "housekeeping.bmw_disposal.recorded": ["disposal_id"],
};

export interface ModuleSummary {
  module_code: string;
  label: string;
}
