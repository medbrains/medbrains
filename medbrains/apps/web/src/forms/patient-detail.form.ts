import type {
  PatientAllergySeverityFormValue,
  PatientAllergyTypeFormValue,
  PatientDetailAllergyFormInput,
  PatientDetailDocumentFormInput,
  PatientDetailFamilyLinkFormInput,
  PatientDocumentTypeFormValue,
  PatientFamilyRelationshipFormValue,
  PatientMergeFormInput,
} from "@medbrains/schemas";
import { optionalTextFromFormValue } from "@medbrains/schemas";
import type {
  CreateDocumentRequest,
  CreateFamilyLinkRequest,
  CreatePatientAllergyRequest,
  MergePatientRequest,
} from "@medbrains/types";

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

export const PATIENT_ALLERGY_TYPE_OPTIONS: Array<SelectOption<PatientAllergyTypeFormValue>> = [
  { value: "drug", label: "Drug" },
  { value: "food", label: "Food" },
  { value: "environmental", label: "Environmental" },
  { value: "latex", label: "Latex" },
  { value: "contrast_dye", label: "Contrast Dye" },
  { value: "biological", label: "Biological" },
  { value: "other", label: "Other" },
];

export const PATIENT_ALLERGY_SEVERITY_OPTIONS: Array<
  SelectOption<PatientAllergySeverityFormValue>
> = [
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
  { value: "life_threatening", label: "Life Threatening" },
];

export const PATIENT_RELATIONSHIP_OPTIONS: Array<SelectOption<PatientFamilyRelationshipFormValue>> =
  [
    { value: "father", label: "Father" },
    { value: "mother", label: "Mother" },
    { value: "spouse", label: "Spouse" },
    { value: "child", label: "Child" },
    { value: "sibling", label: "Sibling" },
    { value: "guardian", label: "Guardian" },
    { value: "other", label: "Other" },
  ];

export const PATIENT_DOCUMENT_TYPE_OPTIONS: Array<SelectOption<PatientDocumentTypeFormValue>> = [
  { value: "id_proof", label: "ID Proof" },
  { value: "consent_form", label: "Consent Form" },
  { value: "referral_letter", label: "Referral Letter" },
  { value: "photo", label: "Photo" },
  { value: "report", label: "Report" },
  { value: "prescription", label: "Prescription" },
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "insurance_card", label: "Insurance Card" },
  { value: "other", label: "Other" },
];

export const DEFAULT_PATIENT_ALLERGY_FORM_VALUES: PatientDetailAllergyFormInput = {
  allergy_type: "drug",
  allergen_name: "",
  severity: null,
  reaction: "",
};

export const DEFAULT_PATIENT_FAMILY_LINK_FORM_VALUES: PatientDetailFamilyLinkFormInput = {
  related_patient_id: "",
  relationship: "spouse",
};

export const DEFAULT_PATIENT_DOCUMENT_FORM_VALUES: PatientDetailDocumentFormInput = {
  document_type: "id_proof",
  document_name: "",
  file_url: "",
  notes: "",
};

export const DEFAULT_PATIENT_MERGE_FORM_VALUES: PatientMergeFormInput = {
  merged_patient_id: "",
  merge_reason: "",
};

export function toCreatePatientAllergyRequest(
  values: PatientDetailAllergyFormInput,
): CreatePatientAllergyRequest {
  return {
    allergy_type: values.allergy_type,
    allergen_name: values.allergen_name.trim(),
    severity: values.severity ?? undefined,
    reaction: optionalTextFromFormValue(values.reaction),
  };
}

export function toCreateFamilyLinkRequest(
  values: PatientDetailFamilyLinkFormInput,
): CreateFamilyLinkRequest {
  return {
    related_patient_id: values.related_patient_id,
    relationship: values.relationship,
  };
}

export function toCreatePatientDocumentRequest(
  values: PatientDetailDocumentFormInput,
): CreateDocumentRequest {
  return {
    document_type: values.document_type,
    document_name: values.document_name.trim(),
    file_url: values.file_url.trim(),
    notes: optionalTextFromFormValue(values.notes),
  };
}

export function toMergePatientRequest(
  survivingPatientId: string,
  values: PatientMergeFormInput,
): MergePatientRequest {
  return {
    surviving_patient_id: survivingPatientId,
    merged_patient_id: values.merged_patient_id,
    merge_reason: values.merge_reason.trim(),
  };
}
