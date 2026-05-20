import type {
  IpdAdmissionFormInput,
  IpdAdmissionSourceFormValue,
  IpdAttenderFormInput,
  IpdClinicalAssessmentFormInput,
  IpdClinicalAssessmentTypeFormValue,
  IpdNursingTaskFormInput,
  IpdNursingTaskTypeFormValue,
  IpdProgressNoteFormInput,
  IpdProgressNoteTypeFormValue,
} from "@medbrains/schemas";
import { ipdNursingTaskTypeValues, optionalNumberFromFormValue } from "@medbrains/schemas";
import type {
  CreateAdmissionRequest,
  CreateAssessmentRequest,
  CreateAttenderRequest,
  CreateProgressNoteRequest,
} from "@medbrains/types";

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

export const IPD_ADMISSION_SOURCE_OPTIONS: Array<SelectOption<IpdAdmissionSourceFormValue>> = [
  { value: "er", label: "Emergency" },
  { value: "opd", label: "OPD" },
  { value: "direct", label: "Direct" },
  { value: "referral", label: "Referral" },
  { value: "transfer_in", label: "Transfer In" },
];

export const IPD_ASSESSMENT_TYPE_OPTIONS: Array<SelectOption<IpdClinicalAssessmentTypeFormValue>> =
  [
    { value: "morse_fall_scale", label: "Morse Fall Scale" },
    { value: "braden_scale", label: "Braden Scale" },
    { value: "gcs", label: "GCS" },
    { value: "pain_vas", label: "Pain (VAS)" },
    { value: "pain_nrs", label: "Pain (NRS)" },
    { value: "news2", label: "NEWS2" },
    { value: "mews", label: "MEWS" },
  ];

export const IPD_RISK_LEVEL_OPTIONS = ["low", "moderate", "high", "critical"];

export const IPD_BRADEN_INJURY_STAGE_OPTIONS = [
  "stage_1",
  "stage_2",
  "stage_3",
  "stage_4",
  "unstageable",
  "deep_tissue",
];

export const IPD_BRADEN_INJURY_ACQUIRED_OPTIONS = [
  { value: "present_on_admission", label: "Present on admission" },
  { value: "hospital_acquired", label: "Hospital acquired" },
];

export const IPD_ID_PROOF_TYPE_OPTIONS = [
  { value: "aadhar", label: "Aadhaar Card" },
  { value: "pan", label: "PAN Card" },
  { value: "passport", label: "Passport" },
  { value: "voter_id", label: "Voter ID" },
  { value: "driving_license", label: "Driving License" },
  { value: "ration_card", label: "Ration Card" },
  { value: "employee_id", label: "Employee ID" },
  { value: "other", label: "Other" },
];

const nursingTaskTypeLabels: Record<IpdNursingTaskTypeFormValue, string> = {
  medication: "Medication Administration",
  vitals: "Vitals Monitoring",
  wound_care: "Wound Care/Dressing",
  catheter_care: "Catheter Care",
  hygiene: "Patient Hygiene",
  feeding: "Feeding/Nutrition",
  mobilization: "Mobilization/PT",
  specimen: "Specimen Collection",
  documentation: "Documentation",
  discharge_prep: "Discharge Preparation",
  other: "Other",
};

export const nursingTaskTypeOptions = ipdNursingTaskTypeValues.map((value) => ({
  value,
  label: nursingTaskTypeLabels[value],
}));

export const DEFAULT_IPD_ADMISSION_VALUES: IpdAdmissionFormInput = {
  patient_id: "",
  department_id: "",
  doctor_id: "",
  bed_id: "",
  ward_id: "",
  admission_source: null,
  referral_from: "",
  referral_doctor: "",
  referral_notes: "",
  admission_weight_kg: "",
  admission_height_cm: "",
  expected_discharge_date: "",
  notes: "",
};

export const DEFAULT_IPD_NURSING_TASK_VALUES: IpdNursingTaskFormInput = {
  task_type: "vitals",
  description: "",
  assigned_to: "",
  notes: "",
};

export const DEFAULT_IPD_CLINICAL_ASSESSMENT_VALUES: IpdClinicalAssessmentFormInput = {
  assessment_type: "morse_fall_scale",
  score_value: "",
  risk_level: "",
  sensory_perception: 4,
  moisture: 4,
  activity: 4,
  mobility: 4,
  nutrition: 4,
  friction_shear: 3,
  injury_present: false,
  injury_stage: "",
  injury_location: "",
  injury_acquired: "",
  repositioning_plan: "",
  nutritional_plan: "",
  skin_care_plan: "",
  notes: "",
};

export const DEFAULT_IPD_ATTENDER_VALUES: IpdAttenderFormInput = {
  name: "",
  relationship: "",
  phone: "",
  alt_phone: "",
  address: "",
  id_proof_type: "",
  id_proof_number: "",
  is_primary: false,
};

const progressNoteTypeLabels: Record<IpdProgressNoteTypeFormValue, string> = {
  doctor_round: "Doctor Round",
  nursing_note: "Nursing Note",
  specialist_opinion: "Specialist Opinion",
  dietitian_note: "Dietitian Note",
  physiotherapy_note: "Physiotherapy",
  social_worker_note: "Social Worker",
  discharge_note: "Discharge Note",
};

const progressNoteTypeValues: IpdProgressNoteTypeFormValue[] = [
  "doctor_round",
  "nursing_note",
  "specialist_opinion",
  "dietitian_note",
  "physiotherapy_note",
  "social_worker_note",
  "discharge_note",
];

export const progressNoteTypeOptions = progressNoteTypeValues.map((value) => ({
  value,
  label: progressNoteTypeLabels[value],
}));

export const DEFAULT_IPD_PROGRESS_NOTE_VALUES: IpdProgressNoteFormInput = {
  note_type: "doctor_round",
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
};

export function ipdOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeIpdAdmissionSource(
  value: string | null,
): IpdAdmissionSourceFormValue | null {
  return IPD_ADMISSION_SOURCE_OPTIONS.find((option) => option.value === value)?.value ?? null;
}

export function normalizeIpdAssessmentType(
  value: string | null,
): IpdClinicalAssessmentTypeFormValue {
  return (
    IPD_ASSESSMENT_TYPE_OPTIONS.find((option) => option.value === value)?.value ??
    "morse_fall_scale"
  );
}

export function calculateBradenTotal(values: IpdClinicalAssessmentFormInput): number {
  return (
    values.sensory_perception +
    values.moisture +
    values.activity +
    values.mobility +
    values.nutrition +
    values.friction_shear
  );
}

export function bradenRiskLevel(total: number): string {
  if (total <= 9) {
    return "severe";
  }
  if (total <= 12) {
    return "high";
  }
  if (total <= 14) {
    return "moderate";
  }
  if (total <= 18) {
    return "mild";
  }
  return "no risk";
}

export function toCreateAdmissionRequest(values: IpdAdmissionFormInput): CreateAdmissionRequest {
  return {
    patient_id: values.patient_id.trim(),
    department_id: values.department_id.trim(),
    doctor_id: ipdOptionalText(values.doctor_id),
    bed_id: ipdOptionalText(values.bed_id),
    notes: ipdOptionalText(values.notes),
    admission_source: values.admission_source ?? undefined,
    referral_from: ipdOptionalText(values.referral_from),
    referral_doctor: ipdOptionalText(values.referral_doctor),
    referral_notes: ipdOptionalText(values.referral_notes),
    admission_weight_kg: optionalNumberFromFormValue(values.admission_weight_kg),
    admission_height_cm: optionalNumberFromFormValue(values.admission_height_cm),
    expected_discharge_date: ipdOptionalText(values.expected_discharge_date),
    ward_id: ipdOptionalText(values.ward_id),
  };
}

export function toCreateAssessmentRequest(
  values: IpdClinicalAssessmentFormInput,
): CreateAssessmentRequest {
  const isBraden = values.assessment_type === "braden_scale";
  const bradenTotal = calculateBradenTotal(values);

  return {
    assessment_type: values.assessment_type,
    score_value: isBraden ? bradenTotal : optionalNumberFromFormValue(values.score_value),
    risk_level: isBraden ? bradenRiskLevel(bradenTotal) : ipdOptionalText(values.risk_level),
    score_details: isBraden
      ? {
          sensory_perception: values.sensory_perception,
          moisture: values.moisture,
          activity: values.activity,
          mobility: values.mobility,
          nutrition: values.nutrition,
          friction_shear: values.friction_shear,
          injury_present: values.injury_present,
          injury_stage: ipdOptionalText(values.injury_stage),
          injury_location: ipdOptionalText(values.injury_location),
          injury_acquired: ipdOptionalText(values.injury_acquired),
          repositioning_plan: ipdOptionalText(values.repositioning_plan),
          nutritional_plan: ipdOptionalText(values.nutritional_plan),
          skin_care_plan: ipdOptionalText(values.skin_care_plan),
          notes: ipdOptionalText(values.notes),
        }
      : undefined,
  };
}

export function toCreateAttenderRequest(values: IpdAttenderFormInput): CreateAttenderRequest {
  return {
    name: values.name.trim(),
    relationship: values.relationship.trim(),
    phone: ipdOptionalText(values.phone),
    alt_phone: ipdOptionalText(values.alt_phone),
    address: ipdOptionalText(values.address),
    id_proof_type: ipdOptionalText(values.id_proof_type),
    id_proof_number: ipdOptionalText(values.id_proof_number),
    is_primary: values.is_primary || undefined,
  };
}

export function toCreateProgressNoteRequest(
  values: IpdProgressNoteFormInput,
): CreateProgressNoteRequest {
  return {
    note_type: values.note_type,
    note_date: new Date().toISOString().split("T")[0],
    subjective: ipdOptionalText(values.subjective),
    objective: ipdOptionalText(values.objective),
    assessment: ipdOptionalText(values.assessment),
    plan: ipdOptionalText(values.plan),
  };
}
