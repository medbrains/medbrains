import type {
  OpdFeedbackFormInput,
  OpdLabOrderFormInput,
  OpdLabOrderPriorityFormValue,
  OpdProcedureConsentFormInput,
  OpdProcedureConsentTypeFormValue,
  OpdProcedureOrderFormInput,
  OpdProcedureOrderPriorityFormValue,
  OpdQueueVisitFormInput,
  OpdRatingFormValue,
  OpdReminderFormInput,
  OpdReminderPriorityFormValue,
  OpdReminderTypeFormValue,
  OpdVisitTypeFormValue,
  StartOpdVisitFormInput,
} from "@medbrains/schemas";
import { optionalTextFromFormValue } from "@medbrains/schemas";
import type {
  CreateConsentRequest,
  CreateEncounterRequest,
  CreateFeedbackRequest,
  CreateLabOrderRequest,
  CreateProcedureOrderRequest,
  CreateReminderRequest,
} from "@medbrains/types";

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

export const OPD_LAB_PRIORITY_OPTIONS: Array<SelectOption<OpdLabOrderPriorityFormValue>> = [
  { value: "routine", label: "Routine" },
  { value: "urgent", label: "Urgent" },
  { value: "stat", label: "STAT" },
];

export const OPD_PROCEDURE_PRIORITY_OPTIONS: Array<
  SelectOption<OpdProcedureOrderPriorityFormValue>
> = [
  { value: "routine", label: "Routine" },
  { value: "urgent", label: "Urgent" },
  { value: "stat", label: "STAT" },
];

export const OPD_REMINDER_TYPE_OPTIONS: Array<SelectOption<OpdReminderTypeFormValue>> = [
  { value: "follow_up", label: "Follow-up" },
  { value: "lab_review", label: "Lab Review" },
  { value: "medication_review", label: "Medication Review" },
  { value: "vaccination", label: "Vaccination" },
  { value: "screening", label: "Screening" },
  { value: "custom", label: "Custom" },
];

export const OPD_REMINDER_PRIORITY_OPTIONS: Array<SelectOption<OpdReminderPriorityFormValue>> = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export const OPD_RATING_OPTIONS: Array<SelectOption<OpdRatingFormValue>> = [
  { value: "1", label: "1 - Poor" },
  { value: "2", label: "2 - Fair" },
  { value: "3", label: "3 - Good" },
  { value: "4", label: "4 - Very Good" },
  { value: "5", label: "5 - Excellent" },
];

export const OPD_CONSENT_TYPE_OPTIONS: Array<SelectOption<OpdProcedureConsentTypeFormValue>> = [
  { value: "procedure", label: "Procedure" },
  { value: "anesthesia", label: "Anesthesia" },
  { value: "blood_transfusion", label: "Blood Transfusion" },
  { value: "surgery", label: "Surgery" },
  { value: "investigation", label: "Investigation" },
  { value: "general", label: "General" },
];

export const OPD_VISIT_TYPE_OPTIONS: Array<SelectOption<OpdVisitTypeFormValue>> = [
  { value: "walk_in", label: "Walk-in" },
  { value: "booked", label: "Booked appointment" },
  { value: "follow_up", label: "Follow-up" },
  { value: "referral", label: "Referral" },
  { value: "emergency", label: "Emergency walk-in" },
];

export const DEFAULT_OPD_QUEUE_VISIT_FORM_VALUES: OpdQueueVisitFormInput = {
  patient_id: "",
  department_id: null,
  doctor_id: null,
  visit_type: "walk_in",
  notes: "",
};

export const DEFAULT_START_OPD_VISIT_FORM_VALUES: StartOpdVisitFormInput = {
  department_id: null,
  doctor_id: null,
  visit_type: "walk_in",
  notes: "",
};

export const DEFAULT_OPD_LAB_ORDER_FORM_VALUES: OpdLabOrderFormInput = {
  test_id: null,
  priority: "routine",
  notes: "",
};

export const DEFAULT_OPD_PROCEDURE_ORDER_FORM_VALUES: OpdProcedureOrderFormInput = {
  procedure_id: null,
  priority: "routine",
  notes: "",
};

export const DEFAULT_OPD_REMINDER_FORM_VALUES: OpdReminderFormInput = {
  reminder_type: "follow_up",
  reminder_date: "",
  title: "",
  description: "",
  priority: "normal",
};

export const DEFAULT_OPD_FEEDBACK_FORM_VALUES: OpdFeedbackFormInput = {
  rating: null,
  wait_time_rating: null,
  staff_rating: null,
  cleanliness_rating: null,
  overall_experience: "",
  suggestions: "",
};

export const DEFAULT_OPD_CONSENT_FORM_VALUES: OpdProcedureConsentFormInput = {
  procedure_name: "",
  consent_type: "procedure",
  risks_explained: "",
  alternatives_explained: "",
  benefits_explained: "",
  consented_by_name: "",
  consented_by_relation: "",
  witness_name: "",
};

function selectedValue(value: string | null): string {
  return value ?? "";
}

function optionalRating(value: OpdRatingFormValue | null): number | undefined {
  return value ? Number(value) : undefined;
}

export function toCreateEncounterRequest(values: OpdQueueVisitFormInput): CreateEncounterRequest {
  return {
    patient_id: values.patient_id.trim(),
    department_id: selectedValue(values.department_id),
    doctor_id: optionalTextFromFormValue(values.doctor_id ?? ""),
    visit_type: values.visit_type,
    notes: optionalTextFromFormValue(values.notes),
  };
}

export function toCreateEncounterRequestForPatient(
  patientId: string,
  values: StartOpdVisitFormInput,
): CreateEncounterRequest {
  return toCreateEncounterRequest({
    patient_id: patientId,
    department_id: values.department_id,
    doctor_id: values.doctor_id,
    visit_type: values.visit_type,
    notes: values.notes,
  });
}

export function toCreateLabOrderRequest(
  values: OpdLabOrderFormInput,
  patientId: string,
  encounterId: string,
): CreateLabOrderRequest {
  return {
    patient_id: patientId,
    encounter_id: encounterId,
    test_id: selectedValue(values.test_id),
    priority: values.priority,
    notes: optionalTextFromFormValue(values.notes),
  };
}

export function toCreateProcedureOrderRequest(
  values: OpdProcedureOrderFormInput,
  patientId: string,
  encounterId: string,
): CreateProcedureOrderRequest {
  return {
    patient_id: patientId,
    encounter_id: encounterId,
    procedure_id: selectedValue(values.procedure_id),
    priority: values.priority,
    notes: optionalTextFromFormValue(values.notes),
  };
}

export function toCreateReminderRequest(
  values: OpdReminderFormInput,
  patientId: string,
  encounterId: string,
): CreateReminderRequest {
  return {
    patient_id: patientId,
    encounter_id: encounterId,
    reminder_type: values.reminder_type,
    reminder_date: values.reminder_date,
    title: values.title.trim(),
    description: optionalTextFromFormValue(values.description),
    priority: values.priority,
  };
}

export function toCreateFeedbackRequest(
  values: OpdFeedbackFormInput,
  patientId: string,
  encounterId: string,
): CreateFeedbackRequest {
  return {
    patient_id: patientId,
    encounter_id: encounterId,
    rating: optionalRating(values.rating),
    wait_time_rating: optionalRating(values.wait_time_rating),
    staff_rating: optionalRating(values.staff_rating),
    cleanliness_rating: optionalRating(values.cleanliness_rating),
    overall_experience: optionalTextFromFormValue(values.overall_experience),
    suggestions: optionalTextFromFormValue(values.suggestions),
  };
}

export function toCreateConsentRequest(
  values: OpdProcedureConsentFormInput,
  patientId: string,
  encounterId: string,
): CreateConsentRequest {
  return {
    patient_id: patientId,
    encounter_id: encounterId,
    procedure_name: values.procedure_name.trim(),
    consent_type: values.consent_type,
    risks_explained: optionalTextFromFormValue(values.risks_explained),
    alternatives_explained: optionalTextFromFormValue(values.alternatives_explained),
    benefits_explained: optionalTextFromFormValue(values.benefits_explained),
    consented_by_name: optionalTextFromFormValue(values.consented_by_name),
    consented_by_relation: optionalTextFromFormValue(values.consented_by_relation),
    witness_name: optionalTextFromFormValue(values.witness_name),
  };
}
