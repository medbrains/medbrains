// Patient registration, identity, allergy, consent and MPI types — split from index.ts, barrel-re-exported.

// ── Patient Registration ─────────────────────────────────

export type Gender = "male" | "female" | "other" | "unknown";
export type PatientCategory =
  | "general"
  | "private"
  | "insurance"
  | "pmjay"
  | "cghs"
  | "staff"
  | "vip"
  | "mlc"
  | "esi"
  | "corporate"
  | "free"
  | "charity"
  | "research_subject"
  | "staff_dependent";

export type MaritalStatus =
  | "single"
  | "married"
  | "divorced"
  | "widowed"
  | "separated"
  | "domestic_partner"
  | "unknown";
export type RegistrationType =
  | "new"
  | "revisit"
  | "transfer_in"
  | "referral"
  | "emergency"
  | "camp"
  | "telemedicine"
  | "pre_registration";
export type RegistrationSource =
  | "walk_in"
  | "phone"
  | "online_portal"
  | "mobile_app"
  | "kiosk"
  | "referral"
  | "ambulance"
  | "camp"
  | "telemedicine";
export type AddressType = "current" | "permanent" | "correspondence" | "workplace" | "temporary";
export type IdentifierType =
  | "aadhaar"
  | "pan"
  | "voter_id"
  | "driving_license"
  | "passport"
  | "ration_card"
  | "ssn"
  | "nhs_number"
  | "medicare_number"
  | "national_id"
  | "birth_certificate"
  | "employee_id"
  | "disability_certificate"
  | "abha"
  | "abha_address"
  | "emirates_id"
  | "iqama"
  | "uhid_external";
export type BloodGroup =
  | "a_positive"
  | "a_negative"
  | "b_positive"
  | "b_negative"
  | "ab_positive"
  | "ab_negative"
  | "o_positive"
  | "o_negative"
  | "unknown";
export type AllergyType =
  | "drug"
  | "food"
  | "environmental"
  | "latex"
  | "contrast_dye"
  | "biological"
  | "other";
export type AllergySeverity = "mild" | "moderate" | "severe" | "life_threatening";
export type ConsentType =
  | "general_treatment"
  | "data_sharing"
  | "abdm_linking"
  | "research_participation"
  | "sms_communication"
  | "email_communication"
  | "photography"
  | "advance_directive"
  | "organ_donation"
  | "hie_participation";
export type ConsentStatus = "granted" | "denied" | "withdrawn" | "pending";
export type ConsentCaptureMode =
  | "paper_signed"
  | "digital_signature"
  | "biometric"
  | "otp_verified"
  | "verbal_recorded";
export type FinancialClass =
  | "self_pay"
  | "insurance"
  | "government_scheme"
  | "corporate"
  | "charity"
  | "research";

// Expanded Patient interface matching the ~55-field Rust struct
export interface Patient {
  id: string;
  tenant_id: string;
  uhid: string;
  abha_id: string | null;
  prefix: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  full_name_local: string | null;
  father_name: string | null;
  mother_name: string | null;
  spouse_name: string | null;
  guardian_name: string | null;
  guardian_relation: string | null;
  date_of_birth: string | null;
  is_dob_estimated: boolean;
  gender: Gender;
  gender_identity: string | null;
  marital_status: MaritalStatus | null;
  religion: string | null;
  nationality_id: string | null;
  preferred_language: string | null;
  birth_place: string | null;
  blood_group: BloodGroup | null;
  blood_group_verified: boolean;
  no_known_allergies: boolean | null;
  occupation: string | null;
  education_level: string | null;
  phone: string;
  phone_secondary: string | null;
  email: string | null;
  preferred_contact_method: string | null;
  address: Record<string, unknown> | null;
  category: PatientCategory;
  registration_type: RegistrationType;
  registration_source: RegistrationSource | null;
  registered_by: string | null;
  registered_at_facility: string | null;
  financial_class: FinancialClass;
  is_medico_legal: boolean;
  mlc_number: string | null;
  is_unknown_patient: boolean;
  temporary_name: string | null;
  is_vip: boolean;
  is_deceased: boolean;
  deceased_date: string | null;
  photo_url: string | null;
  photo_captured_at: string | null;
  data_quality_score: number | null;
  last_visit_date: string | null;
  total_visits: number;
  is_merged: boolean;
  merged_into_patient_id: string | null;
  source_system: string | null;
  legacy_id: string | null;
  attributes: Record<string, unknown>;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  outstanding_balance?: string;
  pending_invoice_count?: number;
}

// Sub-resource interfaces
export interface PatientIdentifier {
  id: string;
  tenant_id: string;
  patient_id: string;
  id_type: IdentifierType;
  id_number: string;
  id_number_hash: string | null;
  issuing_authority: string | null;
  issuing_country_id: string | null;
  valid_from: string | null;
  valid_until: string | null;
  is_verified: boolean;
  verified_at: string | null;
  verification_mode: string | null;
  document_url: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientAddress {
  id: string;
  tenant_id: string;
  patient_id: string;
  address_type: AddressType;
  address_line1: string;
  address_line2: string | null;
  village_town: string | null;
  city: string;
  district_id: string | null;
  state_id: string | null;
  country_id: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  is_primary: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientContact {
  id: string;
  tenant_id: string;
  patient_id: string;
  contact_name: string;
  relation: string;
  phone: string;
  phone_alt: string | null;
  email: string | null;
  address: Record<string, unknown> | null;
  is_emergency_contact: boolean;
  is_next_of_kin: boolean;
  is_legal_guardian: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

// Patient Context — denormalized blob for cross-module form auto-population,
// alert banners, and discharge gates. GET /api/patients/{id}/context.
// Plan section 1.
export interface PatientContextLastVitals {
  recorded_at: string;
  temperature: string | null;
  pulse: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  weight_kg: string | null;
  height_cm: string | null;
  bmi: string | null;
}

export interface PatientContextAllergy {
  substance: string;
  allergy_type: string;
  severity: string;
  reaction: string | null;
}

export interface PatientContextNextOfKin {
  name: string;
  phone: string | null;
  relation: string | null;
}

export interface PatientContextInsurance {
  provider_name: string;
  policy_number: string | null;
  valid_till: string | null;
}

export interface PatientContextPendingConsent {
  consent_type: string;
  status: string;
}

export interface PatientContext {
  patient_id: string;
  uhid: string;
  full_name: string;
  age_years: number | null;
  gender: string | null;
  // Allergies
  no_known_allergies: boolean;
  drug_allergies: string[];
  known_allergies: PatientContextAllergy[];
  // Vitals
  last_vitals: PatientContextLastVitals | null;
  // Safety flags
  is_medico_legal: boolean;
  mlc_number: string | null;
  is_vip: boolean;
  is_unknown_patient: boolean;
  is_deceased: boolean;
  // Consents
  pending_consents: PatientContextPendingConsent[];
  // Financial
  outstanding_balance: string;
  // Form-default demographics
  preferred_language: string | null;
  preferred_room_class: string | null;
  dietary_preference: string | null;
  religious_observances: string | null;
  primary_physician: string | null;
  attendant_passes_count: number | null;
  // Contacts
  next_of_kin: PatientContextNextOfKin | null;
  // Insurance
  primary_insurance: PatientContextInsurance | null;
  secondary_insurance: PatientContextInsurance | null;
}

export interface PatientInsurance {
  id: string;
  tenant_id: string;
  patient_id: string;
  insurance_provider: string;
  policy_number: string;
  group_number: string | null;
  member_id: string | null;
  plan_name: string | null;
  policy_holder_name: string | null;
  policy_holder_relation: string | null;
  valid_from: string;
  valid_until: string;
  sum_insured: number | null;
  tpa_name: string | null;
  tpa_id: string | null;
  coverage_type: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** A remembered allergen (category + item) from the tenant's grown catalog. */
export interface AllergenCatalogEntry {
  allergy_type: string;
  name: string;
}

export interface PatientAllergy {
  id: string;
  tenant_id: string;
  patient_id: string;
  allergy_type: AllergyType;
  allergen_name: string;
  allergen_code: string | null;
  reaction: string | null;
  severity: AllergySeverity | null;
  onset_date: string | null;
  reported_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAllergyResponse {
  allergy: PatientAllergy;
  active_medication_conflicts: string[];
}

export interface PatientConsent {
  id: string;
  tenant_id: string;
  patient_id: string;
  consent_type: ConsentType;
  consent_status: ConsentStatus;
  consent_date: string;
  consent_version: string | null;
  consented_by: string;
  consented_by_relation: string | null;
  witness_name: string | null;
  capture_mode: ConsentCaptureMode;
  document_url: string | null;
  valid_until: string | null;
  notes: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientDocument {
  id: string;
  tenant_id: string;
  patient_id: string;
  document_type: string;
  document_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface PatientAccessLogRow {
  id: string;
  tenant_id: string;
  patient_id: string;
  accessed_by: string;
  access_type: string;
  accessed_at: string;
  notes: string | null;
}

export interface PatientFamilyLink {
  id: string;
  tenant_id: string;
  patient_id: string;
  related_patient_id: string;
  relationship: string;
  is_primary_contact: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyLinkRow {
  id: string;
  patient_id: string;
  related_patient_id: string;
  relationship: string;
  is_primary_contact: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  related_uhid: string | null;
  related_name: string | null;
  related_phone: string | null;
  related_gender: string | null;
}

export interface CreateFamilyLinkRequest {
  related_patient_id: string;
  relationship: string;
  is_primary_contact?: boolean;
  notes?: string;
}

export interface PatientMergeHistory {
  id: string;
  tenant_id: string;
  surviving_patient_id: string;
  merged_patient_id: string;
  merged_by: string;
  merge_reason: string;
  merge_data: Record<string, unknown>;
  unmerged_at: string | null;
  unmerged_by: string | null;
  created_at: string;
}

export interface MergePatientRequest {
  surviving_patient_id: string;
  merged_patient_id: string;
  merge_reason: string;
}

export interface CreateDocumentRequest {
  document_type: string;
  document_name: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  notes?: string;
}

export interface MasterItem {
  id: string;
  tenant_id: string | null;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface CreateMasterItemRequest {
  code: string;
  name: string;
  sort_order?: number;
}

export interface UpdateMasterItemRequest {
  code?: string;
  name?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface InsuranceProvider {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  provider_type: string;
  contact_phone: string | null;
  contact_email: string | null;
  website: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateInsuranceProviderRequest {
  code: string;
  name: string;
  provider_type: string;
  contact_phone?: string;
  contact_email?: string;
  website?: string;
}

export interface UpdateInsuranceProviderRequest {
  code?: string;
  name?: string;
  provider_type?: string;
  contact_phone?: string | null;
  contact_email?: string | null;
  website?: string | null;
  is_active?: boolean;
}

// Keep existing PatientListResponse, update requests:
export interface PatientListResponse {
  patients: Patient[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreatePatientRequest {
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  gender: Gender;
  phone: string;
  prefix?: string;
  middle_name?: string;
  suffix?: string;
  father_name?: string;
  guardian_name?: string;
  guardian_relation?: string;
  is_dob_estimated?: boolean;
  marital_status?: MaritalStatus;
  religion?: string;
  nationality_id?: string;
  preferred_language?: string;
  blood_group?: BloodGroup;
  occupation?: string;
  phone_secondary?: string;
  email?: string | null;
  address?: Record<string, unknown> | null;
  category?: PatientCategory;
  registration_type?: RegistrationType;
  registration_source?: RegistrationSource;
  financial_class?: FinancialClass;
  abha_number?: string;
  abha_address?: string;
  aadhaar_number?: string;
  referred_by_name?: string;
  referred_by_phone?: string;
  referred_by_facility?: string;
  department_id?: string;
  department_name?: string;
  consultant_id?: string;
  consultant_name?: string;
  clinical_unit?: string;
  camp_id?: string;
  camp_name?: string;
  initial_diagnosis_text?: string;
  icd10_code?: string;
  icd11_code?: string;
  icd11_display?: string;
  icd11_source_url?: string;
  icd11_source_version?: string;
  icd11_provider_mode?: string;
  is_medico_legal?: boolean;
  mlc_number?: string;
  is_vip?: boolean;
  is_unknown_patient?: boolean;
  attributes?: Record<string, unknown>;
}

export interface UpdatePatientRequest {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string | null;
  gender?: Gender;
  phone?: string;
  prefix?: string | null;
  middle_name?: string | null;
  suffix?: string | null;
  father_name?: string | null;
  guardian_name?: string | null;
  guardian_relation?: string | null;
  is_dob_estimated?: boolean;
  marital_status?: MaritalStatus | null;
  religion?: string | null;
  nationality_id?: string | null;
  preferred_language?: string | null;
  blood_group?: BloodGroup | null;
  occupation?: string | null;
  phone_secondary?: string | null;
  email?: string | null;
  address?: Record<string, unknown> | null;
  category?: PatientCategory;
  registration_type?: RegistrationType;
  registration_source?: RegistrationSource | null;
  financial_class?: FinancialClass;
  is_medico_legal?: boolean;
  mlc_number?: string | null;
  is_vip?: boolean;
  is_unknown_patient?: boolean;
  is_active?: boolean;
  attributes?: Record<string, unknown>;
}

// Create/update requests for sub-resources
export interface CreatePatientIdentifierRequest {
  id_type: IdentifierType;
  id_number: string;
  issuing_authority?: string;
  issuing_country_id?: string;
  valid_from?: string;
  valid_until?: string;
  is_verified?: boolean;
  document_url?: string;
  is_primary?: boolean;
}

export interface CreatePatientAddressRequest {
  address_type: AddressType;
  address_line1: string;
  address_line2?: string;
  village_town?: string;
  city: string;
  district_id?: string;
  state_id?: string;
  country_id: string;
  postal_code: string;
  is_primary?: boolean;
}

export interface CreatePatientContactRequest {
  contact_name: string;
  relation: string;
  phone: string;
  phone_alt?: string;
  email?: string;
  is_emergency_contact?: boolean;
  is_next_of_kin?: boolean;
  is_legal_guardian?: boolean;
  priority?: number;
}

export interface CreatePatientAllergyRequest {
  allergy_type: AllergyType;
  allergen_name: string;
  allergen_code?: string;
  reaction?: string;
  severity?: AllergySeverity;
  onset_date?: string;
  reported_by?: string;
}

export interface CreatePatientConsentRequest {
  consent_type: ConsentType;
  consent_status: ConsentStatus;
  consented_by: string;
  consented_by_relation?: string;
  witness_name?: string;
  capture_mode: ConsentCaptureMode;
  consent_version?: string;
  document_url?: string;
  valid_until?: string;
  notes?: string;
}

export interface MpiMatchRequest {
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  phone?: string;
  identifier_hash?: string;
}

export interface MpiMatchResult {
  id: string;
  uhid: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  phone: string;
  gender: Gender;
  score: number;
}
