import { z } from "zod";

export * from "./onboarding.js";
export { buildFormSchema, evaluateCondition } from "./dynamic-form.js";
// primitives.ts is re-exported through guards.ts
export * from "./guards.js";

// Note: Zod schemas below are kept for form validation (buildFormSchema).
// For runtime type guards, use the native guards from ./guards.js

export const healthResponseSchema = z.object({
  status: z.string(),
  postgres: z.string(),
  yottadb: z.string(),
});

export const tenantSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  hospital_type: z.enum([
    "medical_college",
    "multi_specialty",
    "district_hospital",
    "community_health",
    "primary_health",
    "standalone_clinic",
    "eye_hospital",
    "dental_college",
  ]),
  config: z.record(z.unknown()),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const userSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  username: z.string(),
  email: z.string().email(),
  full_name: z.string(),
  role: z.enum([
    "super_admin",
    "hospital_admin",
    "doctor",
    "nurse",
    "receptionist",
    "lab_technician",
    "pharmacist",
    "billing_clerk",
    "housekeeping_staff",
    "facilities_manager",
    "audit_officer",
  ]),
  access_matrix: z.record(z.unknown()),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const patientSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  uhid: z.string(),
  abha_id: z.string().nullable(),
  first_name: z.string(),
  last_name: z.string(),
  date_of_birth: z.string(),
  gender: z.enum(["male", "female", "other", "unknown"]),
  phone: z.string(),
  email: z.string().email().nullable(),
  address: z.record(z.unknown()),
  category: z.enum([
    "general",
    "private",
    "insurance",
    "pmjay",
    "cghs",
    "staff",
    "vip",
    "mlc",
  ]),
  attributes: z.record(z.unknown()),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const departmentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  code: z.string(),
  name: z.string(),
  department_type: z.enum([
    "clinical",
    "pre_clinical",
    "para_clinical",
    "administrative",
    "support",
    "academic",
  ]),
  config: z.record(z.unknown()),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const bedStateSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  location_id: z.string().uuid(),
  status: z.enum([
    "vacant_clean",
    "vacant_dirty",
    "reserved",
    "occupied",
    "occupied_transfer_pending",
    "maintenance",
    "blocked",
  ]),
  patient_id: z.string().uuid().nullable(),
  changed_by: z.string().uuid().nullable(),
  reason: z.string().nullable(),
  changed_at: z.string(),
});

// Encounter
export const encounterSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  encounter_type: z.enum(["opd", "ipd", "emergency", "daycare", "teleconsult"]),
  status: z.enum([
    "registered",
    "triaged",
    "in_consultation",
    "admitted",
    "discharged",
    "cancelled",
    "no_show",
  ]),
  department_id: z.string().uuid().nullable(),
  doctor_id: z.string().uuid().nullable(),
  admission_id: z.string().uuid().nullable(),
  metadata: z.record(z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});

// OPD Queue
export const opdQueueSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  encounter_id: z.string().uuid(),
  token_number: z.number().int(),
  department_id: z.string().uuid(),
  doctor_id: z.string().uuid().nullable(),
  status: z.enum(["waiting", "called", "in_consultation", "completed", "no_show", "cancelled"]),
  priority: z.number().int(),
  called_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
});

// Consultation
export const consultationSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  encounter_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  chief_complaint: z.string().nullable(),
  history: z.string().nullable(),
  examination: z.string().nullable(),
  plan: z.string().nullable(),
  notes: z.record(z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});

// Diagnosis
export const diagnosisSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  encounter_id: z.string().uuid(),
  icd_code: z.string(),
  description: z.string(),
  diagnosis_type: z.string(),
  is_primary: z.boolean(),
  created_at: z.string(),
});

// Prescription
export const prescriptionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  encounter_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  status: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
});

export const prescriptionItemSchema = z.object({
  id: z.string().uuid(),
  prescription_id: z.string().uuid(),
  drug_name: z.string(),
  dosage: z.string(),
  frequency: z.string(),
  duration: z.string(),
  route: z.string(),
  instructions: z.string().nullable(),
  quantity: z.number().int(),
});

// Vital Signs
export const vitalSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  encounter_id: z.string().uuid(),
  recorded_by: z.string().uuid(),
  temperature: z.string().nullable(),
  pulse: z.number().int().nullable(),
  bp_systolic: z.number().int().nullable(),
  bp_diastolic: z.number().int().nullable(),
  respiratory_rate: z.number().int().nullable(),
  spo2: z.number().int().nullable(),
  weight: z.string().nullable(),
  height: z.string().nullable(),
  recorded_at: z.string(),
});

// Lab
export const labTestCatalogSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  department_id: z.string().uuid().nullable(),
  sample_type: z.string(),
  parameters: z.record(z.unknown()),
  base_price: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export const labOrderSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  encounter_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  test_id: z.string().uuid(),
  ordered_by: z.string().uuid(),
  status: z.enum(["ordered", "sample_collected", "processing", "completed", "verified", "cancelled"]),
  priority: z.enum(["routine", "urgent", "stat"]),
  notes: z.string().nullable(),
  collected_at: z.string().nullable(),
  collected_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const labResultSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  order_id: z.string().uuid(),
  parameter_name: z.string(),
  value: z.string(),
  unit: z.string().nullable(),
  reference_range: z.string().nullable(),
  flag: z.enum(["normal", "low", "high", "critical_low", "critical_high"]).nullable(),
  entered_by: z.string().uuid(),
  verified_by: z.string().uuid().nullable(),
  verified_at: z.string().nullable(),
  created_at: z.string(),
});

// Billing
export const chargeMasterSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  service_code: z.string(),
  description: z.string(),
  source: z.enum(["opd", "ipd", "lab", "pharmacy", "procedure", "other"]),
  department_id: z.string().uuid().nullable(),
  base_amount: z.string(),
  tax_percent: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export const invoiceSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  invoice_number: z.string(),
  patient_id: z.string().uuid(),
  encounter_id: z.string().uuid().nullable(),
  status: z.enum(["draft", "issued", "partially_paid", "paid", "cancelled"]),
  total_amount: z.string(),
  tax_amount: z.string(),
  discount_amount: z.string(),
  paid_amount: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const invoiceItemSchema = z.object({
  id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  charge_master_id: z.string().uuid().nullable(),
  description: z.string(),
  quantity: z.number().int(),
  unit_price: z.string(),
  tax_amount: z.string(),
  discount_amount: z.string(),
  total: z.string(),
});

export const paymentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  amount: z.string(),
  mode: z.enum(["cash", "card", "upi", "bank_transfer", "cheque", "insurance"]),
  reference_number: z.string().nullable(),
  received_by: z.string().uuid(),
  created_at: z.string(),
});

// IPD
export const admissionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  encounter_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  bed_id: z.string().uuid().nullable(),
  admitting_doctor_id: z.string().uuid(),
  status: z.enum(["admitted", "transferred", "discharged", "deceased", "lama", "dama", "absconded"]),
  admitted_at: z.string(),
  discharge_type: z.enum(["normal", "lama", "dama", "absconded", "referred", "deceased"]).nullable(),
  discharge_summary: z.string().nullable(),
  discharged_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const nursingTaskSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  admission_id: z.string().uuid(),
  assigned_to: z.string().uuid().nullable(),
  task_type: z.string(),
  description: z.string(),
  scheduled_at: z.string(),
  completed_at: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
});

// Audit
export const auditEntrySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string().uuid().nullable(),
  old_values: z.record(z.unknown()).nullable(),
  new_values: z.record(z.unknown()).nullable(),
  ip_address: z.string().nullable(),
  hash: z.string(),
  created_at: z.string(),
});

// Master Config
export const masterConfigSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  module: z.string(),
  config_key: z.string(),
  config_value: z.record(z.unknown()),
  updated_at: z.string(),
});
