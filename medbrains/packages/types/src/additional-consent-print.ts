// Additional consent print-data (phase 2) types — split from index.ts, barrel-re-exported.

// ── Additional Consent Print Data (Phase 2) ─────────────

export interface DnrConsentPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  admission_date: string;
  bed_number: string | null;
  ward_name: string | null;
  diagnosis: string | null;
  prognosis: string | null;
  consent_date: string;
  consent_time: string;
  dnr_type: string;
  interventions_declined: string[];
  interventions_allowed: string[];
  patient_wishes: string | null;
  family_discussion_notes: string | null;
  treating_doctor: string | null;
  witness_name: string | null;
  language: string;
}

export interface OrganDonationConsentPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  address: string | null;
  consent_date: string;
  consent_type: string;
  organs_consented: string[];
  tissues_consented: string[];
  next_of_kin_name: string | null;
  next_of_kin_relation: string | null;
  next_of_kin_phone: string | null;
  thoa_registration_number: string | null;
  transplant_coordinator: string | null;
  hospital_name: string | null;
  language: string;
}

export interface ResearchConsentPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  consent_date: string;
  study_title: string;
  study_protocol_number: string;
  principal_investigator: string;
  iec_approval_number: string;
  iec_approval_date: string;
  sponsor_name: string | null;
  study_purpose: string;
  procedures_involved: string[];
  risks_benefits: string;
  compensation: string | null;
  confidentiality_statement: string;
  withdrawal_rights: string;
  contact_details: string;
  language: string;
}

export interface AbdmConsentPrintData {
  patient_name: string;
  uhid: string;
  abha_number: string | null;
  abha_address: string | null;
  consent_date: string;
  consent_type: string;
  purposes_consented: string[];
  health_info_types: string[];
  hip_name: string;
  hiu_name: string | null;
  validity_period: string | null;
  language: string;
}

export interface TeachingConsentPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  admission_id: string | null;
  consent_date: string;
  consent_type: string;
  teaching_activity: string;
  student_level: string;
  department: string | null;
  faculty_supervisor: string | null;
  patient_rights_explained: boolean;
  can_withdraw_anytime: boolean;
  language: string;
}
