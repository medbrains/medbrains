// Admin form management types — split from index.ts, barrel-re-exported.
import type { FieldDataType, FieldValidation, FormStatus, RequirementLevel } from "./common";
import type { FieldCondition } from "./form-master";

// ── Admin Form Management ────────────────────────────────

export interface FieldMasterFull {
  id: string;
  code: string;
  name: string;
  description: string | null;
  data_type: FieldDataType;
  default_value: string | null;
  placeholder: string | null;
  validation: FieldValidation | null;
  ui_component: string | null;
  ui_width: string | null;
  fhir_path: string | null;
  db_table: string | null;
  db_column: string | null;
  condition: FieldCondition | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const SYSTEM_FIELD_TIMESTAMP = "1970-01-01T00:00:00.000Z";

function systemField(
  module: string,
  code: string,
  name: string,
  dataType: FieldDataType,
  description: string,
): FieldMasterFull {
  return {
    id: `system:${module}.${code}`,
    code,
    name,
    description,
    data_type: dataType,
    default_value: null,
    placeholder: null,
    validation: null,
    ui_component: null,
    ui_width: null,
    fhir_path: null,
    db_table: module,
    db_column: code.split(".").at(-1) ?? code,
    condition: null,
    is_system: true,
    is_active: true,
    created_at: SYSTEM_FIELD_TIMESTAMP,
    updated_at: SYSTEM_FIELD_TIMESTAMP,
  };
}

export const FIELD_ACCESS_FIELDS = [
  systemField("patients", "uhid", "Patient UHID", "text", "Hospital patient identifier"),
  systemField("patients", "first_name", "Patient first name", "text", "Patient identity field"),
  systemField("patients", "middle_name", "Patient middle name", "text", "Patient identity field"),
  systemField("patients", "last_name", "Patient last name", "text", "Patient identity field"),
  systemField(
    "patients",
    "full_name_local",
    "Patient local-script name",
    "text",
    "Patient identity field in local language or script",
  ),
  systemField("patients", "phone", "Patient phone", "phone", "Patient contact field"),
  systemField(
    "patients",
    "phone_secondary",
    "Patient alternate phone",
    "phone",
    "Patient alternate contact field",
  ),
  systemField("patients", "email", "Patient email", "email", "Patient contact field"),
  systemField("patients", "date_of_birth", "Patient date of birth", "date", "Patient age field"),
  systemField("patients", "address", "Patient address", "textarea", "Patient address field"),
  systemField("patients", "abha_id", "ABHA identifier", "text", "ABDM health identity field"),
  systemField(
    "patients",
    "mlc_number",
    "Patient MLC number",
    "text",
    "Medico-legal patient identifier",
  ),
  systemField(
    "patients",
    "identifiers.id_number",
    "Patient external identifier number",
    "text",
    "Government and external patient identifier values",
  ),
  systemField(
    "opd",
    "diagnosis",
    "OPD diagnosis text",
    "textarea",
    "Clinical diagnosis/impression text",
  ),
  systemField(
    "opd",
    "soap_note",
    "OPD SOAP note",
    "textarea",
    "SOAP, HPI, history, examination, assessment, and treatment-plan clinical notes",
  ),
  systemField(
    "ipd",
    "admissions.provisional_diagnosis",
    "IPD provisional diagnosis",
    "textarea",
    "Admission diagnosis shown in IPD workspace and admission slip",
  ),
  systemField(
    "ipd",
    "discharge_summary.final_diagnosis",
    "IPD final diagnosis",
    "textarea",
    "Final diagnosis shown in discharge summary workflow",
  ),
  systemField(
    "ipd",
    "attenders.name",
    "IPD attender name",
    "text",
    "Attender identity linked to an admission",
  ),
  systemField(
    "ipd",
    "attenders.relationship",
    "IPD attender relationship",
    "text",
    "Attender relationship to patient",
  ),
  systemField(
    "ipd",
    "attenders.phone",
    "IPD attender phone",
    "phone",
    "Attender phone or mobile number",
  ),
  systemField("ipd", "attenders.address", "IPD attender address", "textarea", "Attender address"),
  systemField(
    "ipd",
    "attenders.id_proof_number",
    "IPD attender ID proof",
    "text",
    "Attender identity proof number",
  ),
  systemField(
    "emergency",
    "mlc.fir_number",
    "MLC FIR number",
    "text",
    "Medico-legal FIR identifier",
  ),
  systemField(
    "emergency",
    "mlc.police_station",
    "MLC police station",
    "text",
    "Police station for medico-legal case",
  ),
  systemField(
    "emergency",
    "mlc.informant_name",
    "MLC informant name",
    "text",
    "Medico-legal informant identity",
  ),
  systemField(
    "emergency",
    "mlc.informant_relation",
    "MLC informant relation",
    "text",
    "Medico-legal informant relationship to patient or incident",
  ),
  systemField(
    "emergency",
    "mlc.informant_contact",
    "MLC informant contact",
    "phone",
    "Medico-legal informant contact",
  ),
  systemField(
    "emergency",
    "mlc.history_of_incident",
    "MLC incident history",
    "textarea",
    "Medico-legal incident narrative",
  ),
  systemField(
    "emergency",
    "mlc.examination_findings",
    "MLC examination findings",
    "textarea",
    "Medico-legal examination details",
  ),
  systemField(
    "emergency",
    "mlc.medical_opinion",
    "MLC medical opinion",
    "textarea",
    "Medico-legal clinical opinion",
  ),
  systemField(
    "emergency",
    "mlc.cause_of_death",
    "MLC cause of death",
    "textarea",
    "Sensitive medico-legal death field",
  ),
  systemField(
    "emergency",
    "mlc.pocso_report",
    "POCSO report content",
    "textarea",
    "Highly sensitive POCSO report text",
  ),
  systemField(
    "camp",
    "registrations.person_name",
    "Camp outreach name",
    "text",
    "Unlinked outreach participant name",
  ),
  systemField(
    "camp",
    "registrations.phone",
    "Camp outreach phone",
    "phone",
    "Unlinked outreach participant phone",
  ),
  systemField(
    "camp",
    "registrations.id_proof_number",
    "Camp outreach ID proof",
    "text",
    "Unlinked outreach participant ID proof",
  ),
  systemField("camp", "camps.name", "Camp name", "text", "Outreach camp display name"),
  systemField("camp", "camps.location", "Camp location", "text", "Outreach camp venue or site"),
  systemField(
    "camp",
    "camps.schedule",
    "Camp schedule",
    "json",
    "Camp date, timing, status, and operational planning details",
  ),
  systemField(
    "pharmacy",
    "catalog.base_price",
    "Pharmacy catalog base price",
    "decimal",
    "Medicine catalog price",
  ),
  systemField(
    "pharmacy",
    "pricing.unit_price",
    "Pharmacy unit price",
    "decimal",
    "Dispense/order unit price",
  ),
  systemField(
    "pharmacy",
    "batches.batch_number",
    "Pharmacy batch number",
    "text",
    "Drug batch or lot number",
  ),
  systemField(
    "pharmacy",
    "batches.purchase_rate",
    "Pharmacy purchase rate",
    "decimal",
    "Batch purchase price",
  ),
  systemField(
    "pharmacy",
    "batches.selling_rate",
    "Pharmacy selling rate",
    "decimal",
    "Batch selling price",
  ),
  systemField(
    "pharmacy",
    "batches.source",
    "Pharmacy batch source",
    "text",
    "Batch procurement/source details",
  ),
  systemField(
    "pharmacy",
    "ndps.balance_after",
    "NDPS balance",
    "decimal",
    "Controlled substance balance",
  ),
  systemField("pharmacy", "ndps.user_ids", "NDPS users", "text", "NDPS action user identifiers"),
  systemField(
    "pharmacy",
    "ndps.witnessed_by",
    "NDPS witness",
    "text",
    "Controlled substance witness identity",
  ),
  systemField(
    "pharmacy",
    "analytics.value",
    "Pharmacy analytics values",
    "decimal",
    "Financial or stock-value analytics",
  ),
  systemField(
    "pharmacy",
    "pos.patient_name",
    "Pharmacy POS walk-in name",
    "text",
    "Walk-in customer name",
  ),
  systemField(
    "pharmacy",
    "pos.patient_phone",
    "Pharmacy POS walk-in phone",
    "phone",
    "Walk-in customer phone",
  ),
  systemField(
    "pharmacy",
    "drug_name",
    "Pharmacy drug name",
    "text",
    "Drug names withheld from public token-board displays and masked where configured",
  ),
  systemField(
    "pharmacy",
    "prescription_notes",
    "Pharmacy prescription notes",
    "textarea",
    "Prescription comments and dispense notes withheld from public displays",
  ),
  systemField(
    "indent",
    "requisitions.indent_number",
    "Indent number",
    "text",
    "Department store requisition identifier",
  ),
  systemField(
    "indent",
    "requisitions.department_id",
    "Indent department",
    "text",
    "Department requesting or approving store items",
  ),
  systemField(
    "indent",
    "requisitions.status",
    "Indent status",
    "text",
    "Indent requisition lifecycle state",
  ),
  systemField(
    "indent",
    "requisitions.total_amount",
    "Indent total amount",
    "decimal",
    "Estimated requisition value used for store controls",
  ),
  systemField(
    "indent",
    "items.quantity_requested",
    "Indent requested quantity",
    "number",
    "Store item quantity requested by department",
  ),
  systemField(
    "indent",
    "items.quantity_approved",
    "Indent approved quantity",
    "number",
    "Store item quantity approved for issue",
  ),
  systemField(
    "indent",
    "stock_movements.quantity",
    "Store movement quantity",
    "number",
    "Stock movement quantity captured during store receipt or issue",
  ),
  systemField(
    "lab",
    "test_name",
    "Lab test name",
    "text",
    "Investigation names withheld from public sample-collection token boards",
  ),
  systemField(
    "lab",
    "results",
    "Lab report results",
    "json",
    "Verified lab result values, units, ranges, flags, and signer details for printable reports",
  ),
  systemField(
    "lab",
    "critical_flag",
    "Lab critical flag",
    "text",
    "Critical or abnormal result marker shown on lab report printouts",
  ),
  systemField(
    "radiology",
    "body_part",
    "Radiology body part",
    "text",
    "Imaging body-part details withheld from public modality token boards",
  ),
  systemField(
    "radiology",
    "indication",
    "Radiology clinical indication",
    "textarea",
    "Clinical indication withheld from public modality token boards",
  ),
  systemField(
    "radiology",
    "preparation_instructions",
    "Radiology preparation instructions",
    "textarea",
    "Preparation instructions withheld from public modality token boards",
  ),
  systemField(
    "radiology",
    "report",
    "Radiology report",
    "textarea",
    "Verified radiology findings, impression, and radiologist signature for printable reports",
  ),
  systemField(
    "mrd",
    "case_sheets.packet_number",
    "MRD case-sheet packet number",
    "text",
    "MRD packet identifier used for OPD/IPD case-sheet print control and filing",
  ),
  systemField(
    "mrd",
    "case_sheets.source_snapshot",
    "MRD case-sheet source snapshot",
    "json",
    "Clinical source snapshot assembled into MRD printable case-sheet packets",
  ),
  systemField(
    "mrd",
    "case_sheets.reprint_reason",
    "MRD case-sheet reprint reason",
    "textarea",
    "Audit reason captured for duplicate case-sheet printing",
  ),
  systemField(
    "mrd",
    "storage_locations.code",
    "MRD storage location code",
    "text",
    "MRD rack, shelf, bin, or compactor code used for filing",
  ),
  systemField(
    "billing",
    "amount",
    "Billing amounts",
    "decimal",
    "Invoice, payment, refund, tax, credit, and concession amounts",
  ),
  systemField(
    "billing",
    "corporate.contact_email",
    "Corporate contact email",
    "email",
    "Corporate/TPA contact email",
  ),
  systemField(
    "billing",
    "corporate.contact_phone",
    "Corporate contact phone",
    "phone",
    "Corporate/TPA contact phone",
  ),
  systemField(
    "insurance",
    "verification.member_id",
    "Insurance member ID",
    "text",
    "Insurance policy/member identifier",
  ),
  systemField(
    "insurance",
    "prior_auth.auth_number",
    "Prior-auth number",
    "text",
    "Insurance prior-authorization number",
  ),
  systemField(
    "insurance",
    "prior_auth.denial_reason",
    "Prior-auth denial reason",
    "textarea",
    "Payer denial or rejection rationale",
  ),
  systemField(
    "settings",
    "configuration.values",
    "Configuration values",
    "json",
    "Operational tenant, module, feature-flag, and device configuration values",
  ),
  systemField(
    "settings",
    "master_data.status",
    "Master-data status",
    "json",
    "Module master-data readiness, counts, and governance status",
  ),
  systemField(
    "settings",
    "print_templates.version",
    "Print template version",
    "text",
    "Configured print template identifiers, versions, copy routes, and printer profiles",
  ),
] satisfies FieldMasterFull[];

export interface FieldRegulatoryLinkRow {
  id: string;
  regulatory_body_id: string;
  body_code: string;
  body_name: string;
  requirement_level: RequirementLevel;
  clause_reference: string | null;
  clause_code: string | null;
  description: string | null;
}

export interface FieldDetailResponse {
  field: FieldMasterFull;
  regulatory_links: FieldRegulatoryLinkRow[];
}

export interface FormFieldWithMaster {
  ff_id: string;
  field_id: string;
  field_code: string;
  field_name: string;
  data_type: FieldDataType;
  sort_order: number;
  label_override: string | null;
  is_quick_mode: boolean;
  icon: string | null;
  icon_position: string | null;
}

export interface SectionWithFields {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  is_collapsible: boolean;
  is_default_open: boolean;
  icon: string | null;
  color: string | null;
  fields: FormFieldWithMaster[];
}

export interface ModuleFormLinkRow {
  module_code: string;
  form_id: string;
  context: string;
  form_code: string;
  form_name: string;
}

export interface FormDetailResponse {
  id: string;
  code: string;
  name: string;
  version: number;
  status: FormStatus;
  config: Record<string, unknown> | null;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
  sections: SectionWithFields[];
  module_links: ModuleFormLinkRow[];
}
