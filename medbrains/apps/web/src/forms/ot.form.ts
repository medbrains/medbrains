import type {
  OtAnesthesiaRecordFormInput,
  OtAnesthesiaTypeFormValue,
  OtAsaClassificationFormValue,
  OtBookingFormInput,
  OtCasePriorityFormValue,
  OtCaseRecordFormInput,
  OtConsumableCategoryFormValue,
  OtConsumableFormInput,
  OtPostopRecordFormInput,
  OtPostopRecordUpdateFormInput,
  OtPostopRecoveryStatusFormValue,
  OtPreopAssessmentFormInput,
  OtPreopAssessmentUpdateFormInput,
  OtPreopClearanceStatusFormValue,
  OtRoomFormInput,
  OtStatusReasonActionFormValue,
  OtStatusReasonFormInput,
  OtSurgeonPreferenceFormInput,
  OtUtilizationFilterFormInput,
} from "@medbrains/schemas";
import {
  numberFromFormValue,
  optionalNumberFromFormValue,
  optionalTextFromFormValue,
} from "@medbrains/schemas";
import type {
  CreateAnesthesiaRecordRequest,
  CreateCaseRecordRequest,
  CreateOtBookingRequest,
  CreateOtConsumableRequest,
  CreateOtRoomRequest,
  CreatePostopRecordRequest,
  CreatePreopAssessmentRequest,
  CreateSurgeonPreferenceRequest,
  UpdateOtBookingStatusRequest,
  UpdatePostopRecordRequest,
  UpdatePreopAssessmentRequest,
} from "@medbrains/types";

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

export const OT_CONSUMABLE_CATEGORY_OPTIONS: Array<SelectOption<OtConsumableCategoryFormValue>> = [
  { value: "surgical_instrument", label: "Surgical Instrument" },
  { value: "implant", label: "Implant" },
  { value: "disposable", label: "Disposable" },
  { value: "suture", label: "Suture" },
  { value: "drug", label: "Drug" },
  { value: "blood_product", label: "Blood Product" },
  { value: "other", label: "Other" },
];

export const OT_CASE_PRIORITY_OPTIONS: Array<SelectOption<OtCasePriorityFormValue>> = [
  { value: "elective", label: "Elective" },
  { value: "urgent", label: "Urgent" },
  { value: "emergency", label: "Emergency" },
];

export const OT_ASA_OPTIONS: Array<SelectOption<OtAsaClassificationFormValue>> = [
  { value: "asa_1", label: "ASA I - Healthy" },
  { value: "asa_2", label: "ASA II - Mild systemic disease" },
  { value: "asa_3", label: "ASA III - Severe systemic disease" },
  { value: "asa_4", label: "ASA IV - Life-threatening disease" },
  { value: "asa_5", label: "ASA V - Moribund" },
  { value: "asa_6", label: "ASA VI - Brain-dead organ donor" },
];

export const OT_PREOP_CLEARANCE_STATUS_OPTIONS: Array<
  SelectOption<OtPreopClearanceStatusFormValue>
> = [
  { value: "pending", label: "Pending" },
  { value: "cleared", label: "Cleared" },
  { value: "not_cleared", label: "Not Cleared" },
  { value: "conditional", label: "Conditional" },
];

export const OT_ANESTHESIA_TYPE_OPTIONS: Array<SelectOption<OtAnesthesiaTypeFormValue>> = [
  { value: "general", label: "General" },
  { value: "spinal", label: "Spinal" },
  { value: "epidural", label: "Epidural" },
  { value: "regional_block", label: "Regional Block" },
  { value: "local", label: "Local" },
  { value: "sedation", label: "Sedation" },
  { value: "combined", label: "Combined" },
];

export const OT_POSTOP_RECOVERY_STATUS_OPTIONS: Array<
  SelectOption<OtPostopRecoveryStatusFormValue>
> = [
  { value: "in_recovery", label: "In Recovery" },
  { value: "stable", label: "Stable" },
  { value: "shifted_to_ward", label: "Shifted to Ward" },
  { value: "shifted_to_icu", label: "Shifted to ICU" },
  { value: "discharged", label: "Discharged" },
];

export const DEFAULT_OT_BOOKING_FORM_VALUES: OtBookingFormInput = {
  patient_id: "",
  ot_room_id: "",
  primary_surgeon_id: "",
  procedure_name: "",
  scheduled_date: "",
  scheduled_start: "",
  scheduled_end: "",
  priority: "elective",
  notes: "",
};

export const DEFAULT_OT_PREOP_ASSESSMENT_FORM_VALUES: OtPreopAssessmentFormInput = {
  asa_class: null,
  fasting_status: false,
  lab_results_reviewed: false,
  imaging_reviewed: false,
  blood_group_confirmed: false,
  npo_since: "",
  allergies_noted: "",
  current_medications: "",
  conditions: "",
};

export const DEFAULT_OT_PREOP_UPDATE_FORM_VALUES: OtPreopAssessmentUpdateFormInput = {
  clearance_status: "pending",
  asa_class: null,
};

export const DEFAULT_OT_SURGEON_PREFERENCE_FORM_VALUES: OtSurgeonPreferenceFormInput = {
  surgeon_id: "",
  procedure_name: "",
  position: "",
  skin_prep: "",
  draping: "",
  special_instructions: "",
};

export const DEFAULT_OT_CASE_RECORD_FORM_VALUES: OtCaseRecordFormInput = {
  procedure_performed: "",
  findings: "",
  technique: "",
  complications: "",
  blood_loss_ml: "",
  incision_time: "",
  closure_time: "",
  patient_in_time: "",
  patient_out_time: "",
  instrument_count_correct_before: false,
  instrument_count_correct_after: false,
  sponge_count_correct: false,
  specimens: "",
  implants: "",
  drains: "",
  notes: "",
};

export const DEFAULT_OT_ANESTHESIA_RECORD_FORM_VALUES: OtAnesthesiaRecordFormInput = {
  anesthesia_type: "general",
  asa_class: null,
  induction_time: "",
  intubation_time: "",
  airway_details: "",
  drugs_administered: "",
  notes: "",
};

export const DEFAULT_OT_POSTOP_RECORD_FORM_VALUES: OtPostopRecordFormInput = {
  arrival_time: "",
  aldrete_score_arrival: "",
  pain_assessment: "",
  fluid_orders: "",
  diet_orders: "",
  activity_orders: "",
  notes: "",
};

export const DEFAULT_OT_POSTOP_UPDATE_FORM_VALUES: OtPostopRecordUpdateFormInput = {
  recovery_status: "in_recovery",
  aldrete_score_discharge: "",
  discharge_time: "",
  disposition: "",
  notes: "",
};

export const DEFAULT_OT_CONSUMABLE_FORM_VALUES: OtConsumableFormInput = {
  item_name: "",
  category: null,
  quantity: 1,
  unit: "",
  unit_price: "",
  batch_number: "",
};

export const DEFAULT_OT_STATUS_REASON_FORM_VALUES: OtStatusReasonFormInput = {
  reason: "",
};

export const DEFAULT_OT_ROOM_FORM_VALUES: OtRoomFormInput = {
  name: "",
  code: "",
};

export const DEFAULT_OT_UTILIZATION_FILTER_FORM_VALUES: OtUtilizationFilterFormInput = {
  from: "",
  to: "",
};

function requiredCategory(
  value: OtConsumableCategoryFormValue | null,
): OtConsumableCategoryFormValue {
  return value ?? "other";
}

export function normalizeOtCasePriority(value: string | null): OtCasePriorityFormValue {
  return OT_CASE_PRIORITY_OPTIONS.find((option) => option.value === value)?.value ?? "elective";
}

export function normalizeOtAsaClassification(
  value: string | null,
): OtAsaClassificationFormValue | null {
  return OT_ASA_OPTIONS.find((option) => option.value === value)?.value ?? null;
}

export function normalizeOtPreopClearanceStatus(
  value: string | null,
): OtPreopClearanceStatusFormValue {
  return (
    OT_PREOP_CLEARANCE_STATUS_OPTIONS.find((option) => option.value === value)?.value ?? "pending"
  );
}

export function normalizeOtAnesthesiaType(value: string | null): OtAnesthesiaTypeFormValue {
  return OT_ANESTHESIA_TYPE_OPTIONS.find((option) => option.value === value)?.value ?? "general";
}

export function normalizeOtPostopRecoveryStatus(
  value: string | null,
): OtPostopRecoveryStatusFormValue {
  return (
    OT_POSTOP_RECOVERY_STATUS_OPTIONS.find((option) => option.value === value)?.value ??
    "in_recovery"
  );
}

export function toCreateOtBookingRequest(values: OtBookingFormInput): CreateOtBookingRequest {
  return {
    patient_id: values.patient_id.trim(),
    ot_room_id: values.ot_room_id.trim(),
    primary_surgeon_id: values.primary_surgeon_id.trim(),
    procedure_name: values.procedure_name.trim(),
    scheduled_date: values.scheduled_date.trim(),
    scheduled_start: values.scheduled_start.trim(),
    scheduled_end: values.scheduled_end.trim(),
    priority: values.priority,
    notes: optionalTextFromFormValue(values.notes),
  };
}

export function toUpdateOtBookingStatusRequest(
  action: OtStatusReasonActionFormValue,
  values: OtStatusReasonFormInput,
): UpdateOtBookingStatusRequest {
  const reason = values.reason.trim();
  if (action === "cancel") {
    return {
      status: "cancelled",
      cancellation_reason: reason,
    };
  }

  return {
    status: "postponed",
    postpone_reason: reason,
  };
}

export function toCreatePreopAssessmentRequest(
  values: OtPreopAssessmentFormInput,
): CreatePreopAssessmentRequest {
  return {
    asa_class: values.asa_class ?? undefined,
    fasting_status: values.fasting_status,
    lab_results_reviewed: values.lab_results_reviewed,
    imaging_reviewed: values.imaging_reviewed,
    blood_group_confirmed: values.blood_group_confirmed,
    npo_since: optionalTextFromFormValue(values.npo_since),
    allergies_noted: optionalTextFromFormValue(values.allergies_noted),
    current_medications: optionalTextFromFormValue(values.current_medications),
    conditions: optionalTextFromFormValue(values.conditions),
  };
}

export function toUpdatePreopAssessmentRequest(
  values: OtPreopAssessmentUpdateFormInput,
): UpdatePreopAssessmentRequest {
  return {
    clearance_status: values.clearance_status,
    asa_class: values.asa_class ?? undefined,
  };
}

export function toCreateSurgeonPreferenceRequest(
  values: OtSurgeonPreferenceFormInput,
): CreateSurgeonPreferenceRequest {
  return {
    surgeon_id: values.surgeon_id.trim(),
    procedure_name: values.procedure_name.trim(),
    position: optionalTextFromFormValue(values.position),
    skin_prep: optionalTextFromFormValue(values.skin_prep),
    draping: optionalTextFromFormValue(values.draping),
    special_instructions: optionalTextFromFormValue(values.special_instructions),
  };
}

function optionalSingleItemList(value: string): string[] | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? [trimmed] : undefined;
}

export function toCreateCaseRecordRequest(values: OtCaseRecordFormInput): CreateCaseRecordRequest {
  return {
    procedure_performed: values.procedure_performed.trim(),
    findings: optionalTextFromFormValue(values.findings),
    technique: optionalTextFromFormValue(values.technique),
    complications: optionalTextFromFormValue(values.complications),
    blood_loss_ml: optionalNumberFromFormValue(values.blood_loss_ml),
    incision_time: optionalTextFromFormValue(values.incision_time),
    closure_time: optionalTextFromFormValue(values.closure_time),
    patient_in_time: optionalTextFromFormValue(values.patient_in_time),
    patient_out_time: optionalTextFromFormValue(values.patient_out_time),
    instrument_count_correct_before: values.instrument_count_correct_before,
    instrument_count_correct_after: values.instrument_count_correct_after,
    sponge_count_correct: values.sponge_count_correct,
    specimens: optionalSingleItemList(values.specimens),
    implants: optionalSingleItemList(values.implants),
    drains: optionalSingleItemList(values.drains),
    notes: optionalTextFromFormValue(values.notes),
  };
}

export function toCreateAnesthesiaRecordRequest(
  values: OtAnesthesiaRecordFormInput,
): CreateAnesthesiaRecordRequest {
  const airwayDetails = optionalTextFromFormValue(values.airway_details);
  return {
    anesthesia_type: values.anesthesia_type,
    asa_class: values.asa_class ?? undefined,
    induction_time: optionalTextFromFormValue(values.induction_time),
    intubation_time: optionalTextFromFormValue(values.intubation_time),
    airway_details: airwayDetails ? { notes: airwayDetails } : undefined,
    drugs_administered: optionalSingleItemList(values.drugs_administered),
    notes: optionalTextFromFormValue(values.notes),
  };
}

export function toCreatePostopRecordRequest(
  values: OtPostopRecordFormInput,
): CreatePostopRecordRequest {
  return {
    arrival_time: optionalTextFromFormValue(values.arrival_time),
    aldrete_score_arrival: optionalNumberFromFormValue(values.aldrete_score_arrival),
    pain_assessment: optionalTextFromFormValue(values.pain_assessment),
    fluid_orders: optionalTextFromFormValue(values.fluid_orders),
    diet_orders: optionalTextFromFormValue(values.diet_orders),
    activity_orders: optionalTextFromFormValue(values.activity_orders),
    notes: optionalTextFromFormValue(values.notes),
  };
}

export function toUpdatePostopRecordRequest(
  values: OtPostopRecordUpdateFormInput,
): UpdatePostopRecordRequest {
  return {
    recovery_status: values.recovery_status,
    aldrete_score_discharge: optionalNumberFromFormValue(values.aldrete_score_discharge),
    discharge_time: optionalTextFromFormValue(values.discharge_time),
    disposition: optionalTextFromFormValue(values.disposition),
    notes: optionalTextFromFormValue(values.notes),
  };
}

export function toCreateOtConsumableRequest(
  values: OtConsumableFormInput,
): CreateOtConsumableRequest {
  return {
    item_name: values.item_name.trim(),
    category: requiredCategory(values.category),
    quantity: numberFromFormValue(values.quantity, 1),
    unit: optionalTextFromFormValue(values.unit),
    unit_price: optionalNumberFromFormValue(values.unit_price),
    batch_number: optionalTextFromFormValue(values.batch_number),
  };
}

export function toCreateOtRoomRequest(values: OtRoomFormInput): CreateOtRoomRequest {
  return {
    name: values.name.trim(),
    code: values.code.trim(),
  };
}

export function toOtUtilizationParams(
  values: OtUtilizationFilterFormInput,
): { from?: string; to?: string } | undefined {
  const from = optionalTextFromFormValue(values.from);
  const to = optionalTextFromFormValue(values.to);
  if (!from && !to) {
    return undefined;
  }

  return {
    from,
    to,
  };
}
