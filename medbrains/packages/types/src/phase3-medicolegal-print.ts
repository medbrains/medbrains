// Phase-3 medico-legal print-data types — split from index.ts, barrel-re-exported.
import type { PrintSignatureData } from "./emergency-drug-kits";

// ── Phase 3: Medico-Legal Print Data ──────────────────────────

export interface AmaFormPrintData {
  patient_name: string;
  uhid: string;
  age_display: string;
  gender: string;
  address: string | null;
  phone: string | null;
  admission_number: string | null;
  admission_date: string | null;
  ward_name: string | null;
  bed_number: string | null;
  diagnosis: string | null;
  treatment_given: string | null;
  reason_for_lama: string | null;
  risks_explained: string[];
  patient_statement: string | null;
  patient_signature_obtained: boolean;
  witness_name: string | null;
  witness_signature_obtained: boolean;
  relative_name: string | null;
  relative_relationship: string | null;
  relative_signature_obtained: boolean;
  doctor_name: string | null;
  doctor_signature_obtained: boolean;
  discharge_date: string | null;
  discharge_time: string | null;
  medications_provided: string[];
  followup_instructions: string | null;
  emergency_contact_given: boolean;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface InjuryEntry {
  injury_number: number;
  injury_type: string;
  location: string;
  size_cm: string | null;
  description: string;
  probable_age: string | null;
  probable_weapon: string | null;
}

export interface MlcRegisterPrintData {
  mlc_number: string;
  registration_date: string;
  registration_time: string;
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  address: string | null;
  brought_by: string | null;
  police_station: string | null;
  police_officer_name: string | null;
  police_officer_rank: string | null;
  police_dd_number: string | null;
  nature_of_case: string;
  alleged_history: string;
  date_time_of_incident: string | null;
  place_of_incident: string | null;
  weapon_used: string | null;
  condition_on_arrival: string;
  injuries_noted: InjuryEntry[];
  treatment_given: string;
  samples_collected: string[];
  samples_handed_to: string | null;
  opinion: string | null;
  patient_condition_at_discharge: string | null;
  examining_doctor: string;
  examined_at: string;
}

export interface MlcPoliceIntimationPrintData {
  intimation_number: string;
  mlc_number: string;
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  police_station: string;
  officer_name: string | null;
  officer_designation: string | null;
  officer_contact: string | null;
  sent_at: string;
  sent_via: string | null;
  receipt_confirmed: boolean;
  receipt_confirmed_at: string | null;
  receipt_number: string | null;
  notes: string | null;
  sent_by: string | null;
  generated_at: string;
}

export interface WoundEntry {
  wound_number: number;
  wound_type: string;
  body_region: string;
  exact_location: string;
  size_length_cm: number | null;
  size_width_cm: number | null;
  size_depth_cm: number | null;
  shape: string | null;
  margins: string | null;
  floor: string | null;
  surrounding_area: string | null;
  direction: string | null;
  weapon_likely: string | null;
  age_of_wound: string | null;
  simple_or_grievous: string;
  healing_duration_days: number | null;
}

export interface WoundCertificatePrintData {
  certificate_number: string;
  certificate_date: string;
  patient_name: string;
  age_display: string;
  gender: string;
  address: string | null;
  brought_by: string | null;
  police_requisition_number: string | null;
  police_station: string | null;
  examination_date: string;
  examination_time: string | null;
  history_given: string | null;
  general_condition: string | null;
  consciousness_level: string | null;
  wounds: WoundEntry[];
  total_wounds: number;
  simple_wounds: number;
  grievous_wounds: number;
  dangerous_to_life: boolean;
  disability_likely: boolean;
  disability_type: string | null;
  opinion: string | null;
  weapon_opinion: string | null;
  time_since_injury: string | null;
  xray_findings: string | null;
  treatment_advised: string | null;
  examining_doctor: string | null;
  doctor_registration_number: string | null;
  doctor_designation: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface EpiphysealFusion {
  bone_name: string;
  epiphysis: string;
  fusion_status: string;
  estimated_age_range: string | null;
}

export interface SecondaryCharacters {
  facial_hair: string | null;
  pubic_hair: string | null;
  axillary_hair: string | null;
  breast_development: string | null;
  voice_change: boolean | null;
  adams_apple: boolean | null;
}

export interface AgeEstimationPrintData {
  certificate_number: string;
  certificate_date: string;
  patient_name: string;
  gender: string;
  brought_by: string | null;
  purpose_of_examination: string | null;
  police_requisition_number: string | null;
  police_station: string | null;
  examination_date: string;
  general_appearance: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  dental_examination: string | null;
  teeth_erupted: string | null;
  dental_age_estimate: string | null;
  secondary_sex_characters: SecondaryCharacters | null;
  epiphyseal_status: EpiphysealFusion[];
  radiological_findings: string | null;
  ossification_age_estimate: string | null;
  opinion_age_range_lower: number | null;
  opinion_age_range_upper: number | null;
  opinion_narrative: string | null;
  examining_doctor: string | null;
  doctor_registration_number: string | null;
  doctor_designation: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface DeathDeclarationPrintData {
  declaration_number: string;
  patient_name: string;
  uhid: string | null;
  age_display: string;
  gender: string;
  address: string | null;
  admission_number: string | null;
  admission_date: string | null;
  ward_name: string | null;
  bed_number: string | null;
  date_of_death: string;
  time_of_death: string;
  place_of_death: string | null;
  cause_of_death_immediate: string | null;
  cause_of_death_antecedent: string | null;
  cause_of_death_underlying: string | null;
  other_conditions: string[];
  manner_of_death: string;
  autopsy_requested: boolean;
  autopsy_reason: string | null;
  mlc_case: boolean;
  mlc_number: string | null;
  death_summary: string | null;
  certified_by: string | null;
  doctor_registration_number: string | null;
  certification_time: string | null;
  relative_informed: boolean;
  relative_name: string | null;
  relative_relationship: string | null;
  body_handover_to: string | null;
  body_handover_time: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface PoliceVisitEntry {
  visit_date: string;
  officer_name: string;
  officer_rank: string;
  purpose: string;
  statement_recorded: boolean;
}

export interface SamplePreservedEntry {
  sample_type: string;
  quantity: string;
  preservation_method: string;
  collected_date: string;
  handed_to: string | null;
  handed_date: string | null;
}

export interface MlcDateEntry {
  event_date: string;
  event_description: string;
}

export interface MlcDocumentationPrintData {
  mlc_number: string;
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  address: string | null;
  admission_date: string | null;
  discharge_date: string | null;
  final_diagnosis: string;
  treatment_summary: string;
  operative_procedures: string[];
  investigation_summary: string;
  clinical_findings_at_discharge: string;
  complications: string | null;
  prognosis: string;
  permanent_disability: string | null;
  disability_percentage: string | null;
  police_station: string | null;
  fir_number: string | null;
  court_case_number: string | null;
  police_visits: PoliceVisitEntry[];
  samples_preserved: SamplePreservedEntry[];
  certificates_issued: string[];
  important_dates: MlcDateEntry[];
  prepared_by: string;
  verified_by: string;
  prepared_at: string;
  signatures: PrintSignatureData[];
}
