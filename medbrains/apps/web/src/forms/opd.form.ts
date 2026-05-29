import type {
  OpdFeedbackFormInput,
  OpdFollowUpAppointmentFormInput,
  OpdLabOrderFormInput,
  OpdLabOrderPriorityFormValue,
  OpdPreAuthFormInput,
  OpdProcedureConsentFormInput,
  OpdProcedureConsentTypeFormValue,
  OpdProcedureOrderFormInput,
  OpdProcedureOrderPriorityFormValue,
  OpdQueueVisitFormInput,
  OpdRatingFormValue,
  OpdReferralFormInput,
  OpdReferralUrgencyFormValue,
  OpdReminderFormInput,
  OpdReminderPriorityFormValue,
  OpdReminderTypeFormValue,
  OpdVisitTypeFormValue,
} from "@medbrains/schemas";
import { optionalNumberFromFormValue, optionalTextFromFormValue } from "@medbrains/schemas";
import type {
  BookAppointmentRequest,
  CreateConsentRequest,
  CreateEncounterRequest,
  CreateFeedbackRequest,
  CreateLabOrderRequest,
  CreatePreAuthRequest,
  CreateProcedureOrderRequest,
  CreateReferralRequest,
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

export const OPD_REFERRAL_URGENCY_OPTIONS: Array<SelectOption<OpdReferralUrgencyFormValue>> = [
  { value: "routine", label: "Routine" },
  { value: "urgent", label: "Urgent" },
  { value: "emergency", label: "Emergency" },
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
  { value: "camp", label: "Camp / outreach" },
];

export const DEFAULT_OPD_QUEUE_VISIT_FORM_VALUES: OpdQueueVisitFormInput = {
  patient_id: "",
  department_id: null,
  doctor_id: null,
  visit_type: "walk_in",
  camp_id: null,
  notes: "",
};

export const DEFAULT_OPD_FOLLOW_UP_FORM_VALUES: OpdFollowUpAppointmentFormInput = {
  appointment_date: "",
  slot: null,
  reason: "",
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

export const DEFAULT_OPD_REFERRAL_FORM_VALUES: OpdReferralFormInput = {
  to_department_id: null,
  urgency: "routine",
  reason: "",
  clinical_notes: "",
};

export const DEFAULT_OPD_PRE_AUTH_FORM_VALUES: OpdPreAuthFormInput = {
  insurance_provider: "",
  policy_number: "",
  procedure_codes: "",
  diagnosis_codes: "",
  estimated_cost: "",
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

function commaList(value: string): string[] | undefined {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export function toCreateEncounterRequest(values: OpdQueueVisitFormInput): CreateEncounterRequest {
  return {
    patient_id: values.patient_id.trim(),
    department_id: selectedValue(values.department_id),
    doctor_id: optionalTextFromFormValue(values.doctor_id ?? ""),
    visit_type: values.visit_type,
    camp_id: optionalTextFromFormValue(values.camp_id ?? ""),
    notes: optionalTextFromFormValue(values.notes),
  };
}

export function toBookFollowUpAppointmentRequest(
  values: OpdFollowUpAppointmentFormInput,
  patientId: string,
  doctorId: string,
  departmentId: string,
): BookAppointmentRequest {
  const [slotStart = "", slotEnd = ""] = selectedValue(values.slot).split("|");
  return {
    patient_id: patientId,
    doctor_id: doctorId,
    department_id: departmentId,
    appointment_date: selectedValue(values.appointment_date),
    slot_start: slotStart,
    slot_end: slotEnd,
    appointment_type: "follow_up",
    reason: optionalTextFromFormValue(values.reason),
  };
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

export function toCreateReferralRequest(
  values: OpdReferralFormInput,
  patientId: string,
  encounterId: string,
): CreateReferralRequest {
  return {
    patient_id: patientId,
    encounter_id: encounterId,
    to_department_id: selectedValue(values.to_department_id),
    urgency: values.urgency,
    reason: values.reason.trim(),
    clinical_notes: optionalTextFromFormValue(values.clinical_notes),
  };
}

export function toCreatePreAuthRequest(
  values: OpdPreAuthFormInput,
  patientId: string,
  encounterId: string,
): CreatePreAuthRequest {
  return {
    patient_id: patientId,
    encounter_id: encounterId,
    insurance_provider: values.insurance_provider.trim(),
    policy_number: optionalTextFromFormValue(values.policy_number),
    procedure_codes: commaList(values.procedure_codes),
    diagnosis_codes: commaList(values.diagnosis_codes),
    estimated_cost: optionalNumberFromFormValue(values.estimated_cost),
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
