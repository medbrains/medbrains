/**
 * Business/Domain Type Guards & Assertions
 *
 * Runtime type checking for domain entities.
 * Builds on primitive guards from ./primitives.ts
 * Reuses types from @medbrains/types - single source of truth.
 *
 * Patterns:
 * - `is<Type>(value)` - Type guard, returns boolean, narrows type
 * - `assert<Type>(value)` - Throws if invalid, returns typed value
 */

import type {
  Patient,
  User,
  Tenant,
  DepartmentRow,
  Encounter,
  Consultation,
  Diagnosis,
  Vital,
  LabOrder,
  Invoice,
  Admission,
  OpdQueue,
} from "@medbrains/types";

// Import primitives - foundation for all guards
import {
  isObject,
  isString,
  isBoolean,
  isInteger,
  isUUID,
  isNonEmptyString,
  isISODate,
  isArray,
  TypeAssertionError,
  createAssert,
  hasKeys,
  optStr,
  optInt,
  optUUID,
  optObj,
  optEnum,
  isOneOf,
} from "./primitives.js";

// Re-export primitives for consumers
export * from "./primitives.js";

// Alias
const createAssertion = createAssert;

// ══════════════════════════════════════════════════════════════════════════════
// PATIENT
// ══════════════════════════════════════════════════════════════════════════════

const PATIENT_GENDERS = ["male", "female", "other", "unknown"] as const;
const PATIENT_CATEGORIES = ["general", "private", "insurance", "pmjay", "cghs", "staff", "vip", "mlc"] as const;

const isGender = isOneOf(PATIENT_GENDERS);
const isCategory = isOneOf(PATIENT_CATEGORIES);

export function isPatient(v: unknown): v is Patient {
  if (!hasKeys(v, ["id", "tenant_id", "uhid", "first_name", "last_name", "date_of_birth", "gender", "phone", "address", "category", "attributes", "is_active", "created_at", "updated_at"])) return false;
  if (!isUUID(v.id)) return false;
  if (!isUUID(v.tenant_id)) return false;
  if (!isNonEmptyString(v.uhid)) return false;
  if (!optStr(v, "abha_id")) return false;
  if (!isNonEmptyString(v.first_name)) return false;
  if (!isNonEmptyString(v.last_name)) return false;
  if (!isISODate(v.date_of_birth)) return false;
  if (!isGender(v.gender)) return false;
  if (!isString(v.phone)) return false;
  if (!optStr(v, "email")) return false;
  if (!isObject(v.address)) return false;
  if (!isCategory(v.category)) return false;
  if (!isObject(v.attributes)) return false;
  if (!isBoolean(v.is_active)) return false;
  if (!isString(v.created_at)) return false;
  if (!isString(v.updated_at)) return false;
  return true;
}

export interface PatientCreate {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: "male" | "female" | "other" | "unknown";
  phone: string;
  email?: string | null;
  abha_id?: string | null;
  address?: Record<string, unknown>;
  category?: "general" | "private" | "insurance" | "pmjay" | "cghs" | "staff" | "vip" | "mlc";
  attributes?: Record<string, unknown>;
}

export function isPatientCreate(v: unknown): v is PatientCreate {
  if (!hasKeys(v, ["first_name", "last_name", "date_of_birth", "gender", "phone"])) return false;
  if (!isNonEmptyString(v.first_name)) return false;
  if (!isNonEmptyString(v.last_name)) return false;
  if (!isISODate(v.date_of_birth)) return false;
  if (!isGender(v.gender)) return false;
  if (!isString(v.phone)) return false;
  if (!optStr(v, "email")) return false;
  if (!optStr(v, "abha_id")) return false;
  if (!optObj(v, "address")) return false;
  if (!optEnum(v, "category", PATIENT_CATEGORIES)) return false;
  if (!optObj(v, "attributes")) return false;
  return true;
}

export type PatientUpdate = Partial<PatientCreate>;

export function isPatientUpdate(v: unknown): v is PatientUpdate {
  if (!isObject(v)) return false;
  if (!optStr(v, "first_name")) return false;
  if (!optStr(v, "last_name")) return false;
  if (!optStr(v, "date_of_birth")) return false;
  if (!optEnum(v, "gender", PATIENT_GENDERS)) return false;
  if (!optStr(v, "phone")) return false;
  if (!optStr(v, "email")) return false;
  if (!optStr(v, "abha_id")) return false;
  if (!optObj(v, "address")) return false;
  if (!optEnum(v, "category", PATIENT_CATEGORIES)) return false;
  if (!optObj(v, "attributes")) return false;
  return true;
}

export const assertPatient = createAssertion(isPatient, "Patient");
export const assertPatientCreate = createAssertion(isPatientCreate, "PatientCreate");
export const assertPatientUpdate = createAssertion(isPatientUpdate, "PatientUpdate");

export function isPatientArray(v: unknown): v is Patient[] {
  if (!isArray(v)) return false;
  return v.every((item) => isPatient(item));
}
export const assertPatientArray = createAssertion(isPatientArray, "Patient[]");

// ══════════════════════════════════════════════════════════════════════════════
// USER
// ══════════════════════════════════════════════════════════════════════════════

const USER_ROLES = [
  "super_admin", "hospital_admin", "doctor", "nurse", "receptionist",
  "lab_technician", "pharmacist", "billing_clerk", "housekeeping_staff",
  "facilities_manager", "audit_officer",
] as const;

const isRole = isOneOf(USER_ROLES);

export function isUser(v: unknown): v is User {
  if (!hasKeys(v, ["id", "tenant_id", "username", "email", "full_name", "role", "access_matrix", "is_active", "created_at", "updated_at"])) return false;
  if (!isUUID(v.id)) return false;
  if (!isUUID(v.tenant_id)) return false;
  if (!isNonEmptyString(v.username)) return false;
  if (!isString(v.email)) return false;
  if (!isNonEmptyString(v.full_name)) return false;
  if (!isRole(v.role)) return false;
  if (!isObject(v.access_matrix)) return false;
  if (!isBoolean(v.is_active)) return false;
  if (!isString(v.created_at)) return false;
  if (!isString(v.updated_at)) return false;
  return true;
}

export interface UserCreate {
  username: string;
  email: string;
  full_name: string;
  role: string;
  password: string;
  access_matrix?: Record<string, unknown>;
}

export function isUserCreate(v: unknown): v is UserCreate {
  if (!hasKeys(v, ["username", "email", "full_name", "role", "password"])) return false;
  if (!isNonEmptyString(v.username)) return false;
  if (!isString(v.email)) return false;
  if (!isNonEmptyString(v.full_name)) return false;
  if (!isRole(v.role)) return false;
  if (!isNonEmptyString(v.password)) return false;
  if (!optObj(v, "access_matrix")) return false;
  return true;
}

export type UserUpdate = Partial<Omit<UserCreate, "password">> & { password?: string };

export function isUserUpdate(v: unknown): v is UserUpdate {
  if (!isObject(v)) return false;
  if (!optStr(v, "username")) return false;
  if (!optStr(v, "email")) return false;
  if (!optStr(v, "full_name")) return false;
  if (!optEnum(v, "role", USER_ROLES)) return false;
  if (!optStr(v, "password")) return false;
  if (!optObj(v, "access_matrix")) return false;
  return true;
}

export const assertUser = createAssertion(isUser, "User");
export const assertUserCreate = createAssertion(isUserCreate, "UserCreate");
export const assertUserUpdate = createAssertion(isUserUpdate, "UserUpdate");

export function isUserArray(v: unknown): v is User[] {
  if (!isArray(v)) return false;
  return v.every((item) => isUser(item));
}
export const assertUserArray = createAssertion(isUserArray, "User[]");

// ══════════════════════════════════════════════════════════════════════════════
// TENANT
// ══════════════════════════════════════════════════════════════════════════════

const HOSPITAL_TYPES = [
  "medical_college", "multi_specialty", "district_hospital", "community_health",
  "primary_health", "standalone_clinic", "eye_hospital", "dental_college",
] as const;

const isHospitalType = isOneOf(HOSPITAL_TYPES);

export function isTenant(v: unknown): v is Tenant {
  if (!hasKeys(v, ["id", "code", "name", "hospital_type", "config", "is_active", "created_at", "updated_at"])) return false;
  if (!isUUID(v.id)) return false;
  if (!isNonEmptyString(v.code)) return false;
  if (!isNonEmptyString(v.name)) return false;
  if (!isHospitalType(v.hospital_type)) return false;
  if (!isObject(v.config)) return false;
  if (!isBoolean(v.is_active)) return false;
  if (!isString(v.created_at)) return false;
  if (!isString(v.updated_at)) return false;
  return true;
}

export const assertTenant = createAssertion(isTenant, "Tenant");

// ══════════════════════════════════════════════════════════════════════════════
// DEPARTMENT
// ══════════════════════════════════════════════════════════════════════════════

const DEPT_TYPES = ["clinical", "pre_clinical", "para_clinical", "administrative", "support", "academic"] as const;
const isDeptType = isOneOf(DEPT_TYPES);

export function isDepartment(v: unknown): v is DepartmentRow {
  if (!hasKeys(v, ["id", "tenant_id", "code", "name", "department_type", "config", "is_active", "created_at", "updated_at"])) return false;
  if (!isUUID(v.id)) return false;
  if (!isUUID(v.tenant_id)) return false;
  if (!optUUID(v, "parent_id")) return false;
  if (!isNonEmptyString(v.code)) return false;
  if (!isNonEmptyString(v.name)) return false;
  if (!isDeptType(v.department_type)) return false;
  if (!isObject(v.config)) return false;
  if (!isBoolean(v.is_active)) return false;
  if (!isString(v.created_at)) return false;
  if (!isString(v.updated_at)) return false;
  return true;
}

export interface DepartmentCreate {
  code: string;
  name: string;
  department_type: string;
  parent_id?: string | null;
  config?: Record<string, unknown>;
}

export function isDepartmentCreate(v: unknown): v is DepartmentCreate {
  if (!hasKeys(v, ["code", "name", "department_type"])) return false;
  if (!isNonEmptyString(v.code)) return false;
  if (!isNonEmptyString(v.name)) return false;
  if (!isDeptType(v.department_type)) return false;
  if (!optUUID(v, "parent_id")) return false;
  if (!optObj(v, "config")) return false;
  return true;
}

export const assertDepartment = createAssertion(isDepartment, "Department");
export const assertDepartmentCreate = createAssertion(isDepartmentCreate, "DepartmentCreate");

// ══════════════════════════════════════════════════════════════════════════════
// ENCOUNTER
// ══════════════════════════════════════════════════════════════════════════════

const ENCOUNTER_TYPES = ["opd", "ipd", "emergency", "daycare", "teleconsult"] as const;
const ENCOUNTER_STATUSES = ["registered", "triaged", "in_consultation", "admitted", "discharged", "cancelled", "no_show"] as const;

const isEncounterType = isOneOf(ENCOUNTER_TYPES);
const isEncounterStatus = isOneOf(ENCOUNTER_STATUSES);

export function isEncounter(v: unknown): v is Encounter {
  if (!hasKeys(v, ["id", "tenant_id", "patient_id", "encounter_type", "status", "created_at", "updated_at"])) return false;
  if (!isUUID(v.id)) return false;
  if (!isUUID(v.tenant_id)) return false;
  if (!isUUID(v.patient_id)) return false;
  if (!isEncounterType(v.encounter_type)) return false;
  if (!isEncounterStatus(v.status)) return false;
  if (!optUUID(v, "department_id")) return false;
  if (!optUUID(v, "doctor_id")) return false;
  if (!optUUID(v, "admission_id")) return false;
  if (!optObj(v, "metadata")) return false;
  if (!isString(v.created_at)) return false;
  if (!isString(v.updated_at)) return false;
  return true;
}

export interface EncounterCreate {
  patient_id: string;
  encounter_type: "opd" | "ipd" | "emergency" | "daycare" | "teleconsult";
  department_id?: string | null;
  doctor_id?: string | null;
  metadata?: Record<string, unknown>;
}

export function isEncounterCreate(v: unknown): v is EncounterCreate {
  if (!hasKeys(v, ["patient_id", "encounter_type"])) return false;
  if (!isUUID(v.patient_id)) return false;
  if (!isEncounterType(v.encounter_type)) return false;
  if (!optUUID(v, "department_id")) return false;
  if (!optUUID(v, "doctor_id")) return false;
  if (!optObj(v, "metadata")) return false;
  return true;
}

export const assertEncounter = createAssertion(isEncounter, "Encounter");
export const assertEncounterCreate = createAssertion(isEncounterCreate, "EncounterCreate");

export function isEncounterArray(v: unknown): v is Encounter[] {
  if (!isArray(v)) return false;
  return v.every((item) => isEncounter(item));
}
export const assertEncounterArray = createAssertion(isEncounterArray, "Encounter[]");

// ══════════════════════════════════════════════════════════════════════════════
// CONSULTATION
// ══════════════════════════════════════════════════════════════════════════════

export function isConsultation(v: unknown): v is Consultation {
  if (!hasKeys(v, ["id", "tenant_id", "encounter_id", "doctor_id", "created_at", "updated_at"])) return false;
  if (!isUUID(v.id)) return false;
  if (!isUUID(v.tenant_id)) return false;
  if (!isUUID(v.encounter_id)) return false;
  if (!isUUID(v.doctor_id)) return false;
  if (!optStr(v, "chief_complaint")) return false;
  if (!optStr(v, "history")) return false;
  if (!optStr(v, "examination")) return false;
  if (!optStr(v, "plan")) return false;
  if (!optObj(v, "notes")) return false;
  if (!isString(v.created_at)) return false;
  if (!isString(v.updated_at)) return false;
  return true;
}

export interface ConsultationCreate {
  encounter_id: string;
  doctor_id: string;
  chief_complaint?: string | null;
  history?: string | null;
  examination?: string | null;
  plan?: string | null;
  notes?: Record<string, unknown>;
}

export function isConsultationCreate(v: unknown): v is ConsultationCreate {
  if (!hasKeys(v, ["encounter_id", "doctor_id"])) return false;
  if (!isUUID(v.encounter_id)) return false;
  if (!isUUID(v.doctor_id)) return false;
  if (!optStr(v, "chief_complaint")) return false;
  if (!optStr(v, "history")) return false;
  if (!optStr(v, "examination")) return false;
  if (!optStr(v, "plan")) return false;
  if (!optObj(v, "notes")) return false;
  return true;
}

export const assertConsultation = createAssertion(isConsultation, "Consultation");
export const assertConsultationCreate = createAssertion(isConsultationCreate, "ConsultationCreate");

// ══════════════════════════════════════════════════════════════════════════════
// DIAGNOSIS
// ══════════════════════════════════════════════════════════════════════════════

export function isDiagnosis(v: unknown): v is Diagnosis {
  if (!hasKeys(v, ["id", "tenant_id", "encounter_id", "icd_code", "description", "is_primary", "created_at"])) return false;
  if (!isUUID(v.id)) return false;
  if (!isUUID(v.tenant_id)) return false;
  if (!isUUID(v.encounter_id)) return false;
  if (!isString(v.icd_code)) return false;
  if (!isString(v.description)) return false;
  if (!optStr(v, "diagnosis_type")) return false;
  if (!isBoolean(v.is_primary)) return false;
  if (!isString(v.created_at)) return false;
  return true;
}

export interface DiagnosisCreate {
  encounter_id: string;
  icd_code: string;
  description: string;
  diagnosis_type?: string;
  is_primary?: boolean;
}

export function isDiagnosisCreate(v: unknown): v is DiagnosisCreate {
  if (!hasKeys(v, ["encounter_id", "icd_code", "description"])) return false;
  if (!isUUID(v.encounter_id)) return false;
  if (!isString(v.icd_code)) return false;
  if (!isString(v.description)) return false;
  if (!optStr(v, "diagnosis_type")) return false;
  if (v.is_primary !== undefined && !isBoolean(v.is_primary)) return false;
  return true;
}

export const assertDiagnosis = createAssertion(isDiagnosis, "Diagnosis");
export const assertDiagnosisCreate = createAssertion(isDiagnosisCreate, "DiagnosisCreate");

// ══════════════════════════════════════════════════════════════════════════════
// VITAL
// ══════════════════════════════════════════════════════════════════════════════

export function isVital(v: unknown): v is Vital {
  if (!hasKeys(v, ["id", "tenant_id", "encounter_id", "recorded_by", "recorded_at"])) return false;
  if (!isUUID(v.id)) return false;
  if (!isUUID(v.tenant_id)) return false;
  if (!isUUID(v.encounter_id)) return false;
  if (!isUUID(v.recorded_by)) return false;
  if (!optStr(v, "temperature")) return false;
  if (!optInt(v, "pulse")) return false;
  if (!optInt(v, "bp_systolic")) return false;
  if (!optInt(v, "bp_diastolic")) return false;
  if (!optInt(v, "respiratory_rate")) return false;
  if (!optInt(v, "spo2")) return false;
  if (!optStr(v, "weight")) return false;
  if (!optStr(v, "height")) return false;
  if (!isString(v.recorded_at)) return false;
  return true;
}

export interface VitalCreate {
  encounter_id: string;
  recorded_by: string;
  temperature?: string | null;
  pulse?: number | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  respiratory_rate?: number | null;
  spo2?: number | null;
  weight?: string | null;
  height?: string | null;
}

export function isVitalCreate(v: unknown): v is VitalCreate {
  if (!hasKeys(v, ["encounter_id", "recorded_by"])) return false;
  if (!isUUID(v.encounter_id)) return false;
  if (!isUUID(v.recorded_by)) return false;
  if (!optStr(v, "temperature")) return false;
  if (!optInt(v, "pulse")) return false;
  if (!optInt(v, "bp_systolic")) return false;
  if (!optInt(v, "bp_diastolic")) return false;
  if (!optInt(v, "respiratory_rate")) return false;
  if (!optInt(v, "spo2")) return false;
  if (!optStr(v, "weight")) return false;
  if (!optStr(v, "height")) return false;
  return true;
}

export const assertVital = createAssertion(isVital, "Vital");
export const assertVitalCreate = createAssertion(isVitalCreate, "VitalCreate");

// ══════════════════════════════════════════════════════════════════════════════
// LAB ORDER
// ══════════════════════════════════════════════════════════════════════════════

const LAB_STATUSES = ["ordered", "sample_collected", "processing", "completed", "verified", "cancelled"] as const;
const LAB_PRIORITIES = ["routine", "urgent", "stat"] as const;

const isLabStatus = isOneOf(LAB_STATUSES);
const isLabPriority = isOneOf(LAB_PRIORITIES);

export function isLabOrder(v: unknown): v is LabOrder {
  if (!hasKeys(v, ["id", "tenant_id", "encounter_id", "patient_id", "test_id", "ordered_by", "status", "priority", "created_at", "updated_at"])) return false;
  if (!isUUID(v.id)) return false;
  if (!isUUID(v.tenant_id)) return false;
  if (!isUUID(v.encounter_id)) return false;
  if (!isUUID(v.patient_id)) return false;
  if (!isUUID(v.test_id)) return false;
  if (!isUUID(v.ordered_by)) return false;
  if (!isLabStatus(v.status)) return false;
  if (!isLabPriority(v.priority)) return false;
  if (!optStr(v, "notes")) return false;
  if (!optStr(v, "collected_at")) return false;
  if (!optUUID(v, "collected_by")) return false;
  if (!isString(v.created_at)) return false;
  if (!isString(v.updated_at)) return false;
  return true;
}

export interface LabOrderCreate {
  encounter_id: string;
  patient_id: string;
  test_id: string;
  ordered_by: string;
  priority?: "routine" | "urgent" | "stat";
  notes?: string | null;
}

export function isLabOrderCreate(v: unknown): v is LabOrderCreate {
  if (!hasKeys(v, ["encounter_id", "patient_id", "test_id", "ordered_by"])) return false;
  if (!isUUID(v.encounter_id)) return false;
  if (!isUUID(v.patient_id)) return false;
  if (!isUUID(v.test_id)) return false;
  if (!isUUID(v.ordered_by)) return false;
  if (!optEnum(v, "priority", LAB_PRIORITIES)) return false;
  if (!optStr(v, "notes")) return false;
  return true;
}

export const assertLabOrder = createAssertion(isLabOrder, "LabOrder");
export const assertLabOrderCreate = createAssertion(isLabOrderCreate, "LabOrderCreate");

export function isLabOrderArray(v: unknown): v is LabOrder[] {
  if (!isArray(v)) return false;
  return v.every((item) => isLabOrder(item));
}
export const assertLabOrderArray = createAssertion(isLabOrderArray, "LabOrder[]");

// ══════════════════════════════════════════════════════════════════════════════
// INVOICE
// ══════════════════════════════════════════════════════════════════════════════

const INVOICE_STATUSES = ["draft", "issued", "partially_paid", "paid", "cancelled"] as const;
const isInvoiceStatus = isOneOf(INVOICE_STATUSES);

export function isInvoice(v: unknown): v is Invoice {
  if (!hasKeys(v, ["id", "tenant_id", "invoice_number", "patient_id", "status", "total_amount", "created_at", "updated_at"])) return false;
  if (!isUUID(v.id)) return false;
  if (!isUUID(v.tenant_id)) return false;
  if (!isNonEmptyString(v.invoice_number)) return false;
  if (!isUUID(v.patient_id)) return false;
  if (!optUUID(v, "encounter_id")) return false;
  if (!isInvoiceStatus(v.status)) return false;
  if (!isString(v.total_amount)) return false;
  if (!optStr(v, "tax_amount")) return false;
  if (!optStr(v, "discount_amount")) return false;
  if (!optStr(v, "paid_amount")) return false;
  if (!optStr(v, "notes")) return false;
  if (!isString(v.created_at)) return false;
  if (!isString(v.updated_at)) return false;
  return true;
}

export interface InvoiceCreate {
  patient_id: string;
  encounter_id?: string | null;
  status?: "draft" | "issued" | "partially_paid" | "paid" | "cancelled";
  total_amount: string;
  tax_amount?: string;
  discount_amount?: string;
  paid_amount?: string;
  notes?: string | null;
}

export function isInvoiceCreate(v: unknown): v is InvoiceCreate {
  if (!hasKeys(v, ["patient_id", "total_amount"])) return false;
  if (!isUUID(v.patient_id)) return false;
  if (!optUUID(v, "encounter_id")) return false;
  if (!optEnum(v, "status", INVOICE_STATUSES)) return false;
  if (!isString(v.total_amount)) return false;
  if (!optStr(v, "tax_amount")) return false;
  if (!optStr(v, "discount_amount")) return false;
  if (!optStr(v, "paid_amount")) return false;
  if (!optStr(v, "notes")) return false;
  return true;
}

export const assertInvoice = createAssertion(isInvoice, "Invoice");
export const assertInvoiceCreate = createAssertion(isInvoiceCreate, "InvoiceCreate");

export function isInvoiceArray(v: unknown): v is Invoice[] {
  if (!isArray(v)) return false;
  return v.every((item) => isInvoice(item));
}
export const assertInvoiceArray = createAssertion(isInvoiceArray, "Invoice[]");

// ══════════════════════════════════════════════════════════════════════════════
// ADMISSION
// ══════════════════════════════════════════════════════════════════════════════

const ADMISSION_STATUSES = ["admitted", "transferred", "discharged", "deceased", "lama", "dama", "absconded"] as const;
const DISCHARGE_TYPES = ["normal", "lama", "dama", "absconded", "referred", "deceased"] as const;

const isAdmissionStatus = isOneOf(ADMISSION_STATUSES);

export function isAdmission(v: unknown): v is Admission {
  if (!hasKeys(v, ["id", "tenant_id", "encounter_id", "patient_id", "admitting_doctor_id", "status", "admitted_at", "created_at", "updated_at"])) return false;
  if (!isUUID(v.id)) return false;
  if (!isUUID(v.tenant_id)) return false;
  if (!isUUID(v.encounter_id)) return false;
  if (!isUUID(v.patient_id)) return false;
  if (!optUUID(v, "bed_id")) return false;
  if (!isUUID(v.admitting_doctor_id)) return false;
  if (!isAdmissionStatus(v.status)) return false;
  if (!isString(v.admitted_at)) return false;
  if (!optEnum(v, "discharge_type", DISCHARGE_TYPES)) return false;
  if (!optStr(v, "discharge_summary")) return false;
  if (!optStr(v, "discharged_at")) return false;
  if (!isString(v.created_at)) return false;
  if (!isString(v.updated_at)) return false;
  return true;
}

export interface AdmissionCreate {
  encounter_id: string;
  patient_id: string;
  bed_id?: string | null;
  admitting_doctor_id: string;
}

export function isAdmissionCreate(v: unknown): v is AdmissionCreate {
  if (!hasKeys(v, ["encounter_id", "patient_id", "admitting_doctor_id"])) return false;
  if (!isUUID(v.encounter_id)) return false;
  if (!isUUID(v.patient_id)) return false;
  if (!optUUID(v, "bed_id")) return false;
  if (!isUUID(v.admitting_doctor_id)) return false;
  return true;
}

export const assertAdmission = createAssertion(isAdmission, "Admission");
export const assertAdmissionCreate = createAssertion(isAdmissionCreate, "AdmissionCreate");

export function isAdmissionArray(v: unknown): v is Admission[] {
  if (!isArray(v)) return false;
  return v.every((item) => isAdmission(item));
}
export const assertAdmissionArray = createAssertion(isAdmissionArray, "Admission[]");

// ══════════════════════════════════════════════════════════════════════════════
// OPD QUEUE
// ══════════════════════════════════════════════════════════════════════════════

const QUEUE_STATUSES = ["waiting", "called", "in_consultation", "completed", "no_show", "cancelled"] as const;
const isQueueStatus = isOneOf(QUEUE_STATUSES);

export function isOpdQueue(v: unknown): v is OpdQueue {
  if (!hasKeys(v, ["id", "tenant_id", "encounter_id", "token_number", "department_id", "status", "priority", "created_at"])) return false;
  if (!isUUID(v.id)) return false;
  if (!isUUID(v.tenant_id)) return false;
  if (!isUUID(v.encounter_id)) return false;
  if (!isInteger(v.token_number)) return false;
  if (!isUUID(v.department_id)) return false;
  if (!optUUID(v, "doctor_id")) return false;
  if (!isQueueStatus(v.status)) return false;
  if (!isInteger(v.priority)) return false;
  if (!optStr(v, "called_at")) return false;
  if (!optStr(v, "completed_at")) return false;
  if (!isString(v.created_at)) return false;
  return true;
}

export const assertOpdQueue = createAssertion(isOpdQueue, "OpdQueueItem");

// ══════════════════════════════════════════════════════════════════════════════
// API RESPONSE VALIDATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Validates an API response and throws if invalid.
 */
export function validateApiResponse<T>(
  data: unknown,
  guard: (value: unknown) => value is T,
  endpoint: string,
): T {
  if (!guard(data)) {
    throw new TypeAssertionError(`valid response from ${endpoint}`, data, endpoint);
  }
  return data;
}

/**
 * Validates an array API response.
 */
export function validateApiArrayResponse<T>(
  data: unknown,
  itemGuard: (value: unknown) => value is T,
  endpoint: string,
): T[] {
  if (!Array.isArray(data)) {
    throw new TypeAssertionError(`array from ${endpoint}`, data, endpoint);
  }
  return data.map((item, index) => {
    if (!itemGuard(item)) {
      throw new TypeAssertionError(`valid item at index ${index}`, item, endpoint);
    }
    return item;
  });
}
