// Blood bank & OT form types — split from index.ts, barrel-re-exported.

// ── Blood Bank & OT Forms ─────────────────────────────────────────────────────

export interface OtSurgeryEntry {
  serial_no: number;
  patient_name: string;
  uhid: string;
  age_gender: string;
  ip_number: string | null;
  diagnosis: string;
  procedure: string;
  surgery_type: string;
  surgeon: string;
  assistant_surgeon: string | null;
  anesthesiologist: string;
  anesthesia_type: string;
  scrub_nurse: string | null;
  circulating_nurse: string | null;
  scheduled_time: string;
  actual_start: string | null;
  actual_end: string | null;
  duration_minutes: number | null;
  outcome: string | null;
  complications: string | null;
}

export interface OtRegisterPrintData {
  register_date: string;
  ot_name: string;
  ot_number: string;
  surgeries: OtSurgeryEntry[];
  total_surgeries: number;
  total_elective: number;
  total_emergency: number;
  printed_by: string;
  hospital_name: string;
}

export interface DonorMedicalHistory {
  recent_illness: boolean;
  recent_surgery: boolean;
  recent_transfusion: boolean;
  chronic_disease: boolean;
  on_medication: boolean;
  pregnant_or_lactating: boolean;
  high_risk_behavior: boolean;
  tattoo_recent: boolean;
  details: string | null;
}

export interface DonorPhysicalExam {
  weight_kg: number;
  blood_pressure: string;
  pulse: number;
  temperature: number;
  hemoglobin: number;
  fit_to_donate: boolean;
  deferral_reason: string | null;
}

export interface BloodDonorFormPrintData {
  registration_number: string;
  registration_date: string;
  donor_name: string;
  age: number;
  gender: string;
  blood_group: string;
  rh_factor: string;
  father_husband_name: string | null;
  address: string;
  phone: string;
  email: string | null;
  id_proof_type: string;
  id_proof_number: string;
  occupation: string | null;
  donation_type: string;
  previous_donations: number;
  last_donation_date: string | null;
  medical_history: DonorMedicalHistory;
  physical_exam: DonorPhysicalExam;
  consent_given: boolean;
  consent_date: string | null;
  medical_officer: string | null;
  hospital_name: string;
}

export interface CrossMatchRequisitionPrintData {
  requisition_number: string;
  requisition_date: string;
  urgency: string;
  patient_name: string;
  uhid: string;
  age_gender: string;
  ip_number: string | null;
  ward_bed: string;
  blood_group: string;
  rh_factor: string;
  diagnosis: string;
  indication_for_transfusion: string;
  units_required: number;
  component_type: string;
  previous_transfusions: number;
  transfusion_reactions_history: boolean;
  reaction_details: string | null;
  sample_collected_by: string;
  sample_collected_at: string;
  requesting_doctor: string;
  doctor_signature_date: string;
  hospital_name: string;
}
