import type {
  SecurityAccessCardFormInput,
  SecurityAccessLogFormInput,
  SecurityCameraFormInput,
  SecurityCodeDebriefFormInput,
  SecurityIncidentFormInput,
  SecurityPatientTagFormInput,
  SecurityZoneFormInput,
} from "@medbrains/schemas";
import { optionalIntegerFromFormValue, optionalTextFromFormValue } from "@medbrains/schemas";
import type {
  CreateSecurityAccessCardRequest,
  CreateSecurityAccessLogRequest,
  CreateSecurityCameraRequest,
  CreateSecurityCodeDebriefRequest,
  CreateSecurityIncidentRequest,
  CreateSecurityPatientTagRequest,
  CreateSecurityZoneRequest,
} from "@medbrains/types";

export const defaultSecurityZoneFormValues: SecurityZoneFormInput = {
  zone_code: "",
  name: "",
  level: null,
  description: "",
  after_hours_restricted: false,
  after_hours_start: "",
  after_hours_end: "",
};

export const defaultSecurityAccessCardFormValues: SecurityAccessCardFormInput = {
  employee_id: "",
  card_number: "",
  card_type: "",
};

export const defaultSecurityAccessLogFormValues: SecurityAccessLogFormInput = {
  zone_id: "",
  person_name: "",
  access_method: null,
  direction: null,
  granted: true,
  is_after_hours: false,
};

export const defaultSecurityCameraFormValues: SecurityCameraFormInput = {
  name: "",
  camera_id: "",
  zone_id: "",
  location_description: "",
  camera_type: null,
  resolution: "",
  retention_days: 30,
  ip_address: "",
};

export const defaultSecurityIncidentFormValues: SecurityIncidentFormInput = {
  severity: null,
  category: "other",
  zone_id: "",
  location_description: "",
  description: "",
  police_notified: false,
  police_report_number: "",
};

export const defaultSecurityPatientTagFormValues: SecurityPatientTagFormInput = {
  patient_id: "",
  tag_type: "infant_rfid",
  tag_identifier: "",
  allowed_zone_id: "",
  mother_id: "",
};

export const defaultSecurityCodeDebriefFormValues: SecurityCodeDebriefFormInput = {
  code_activation_id: "",
  response_time_seconds: "",
  total_duration_minutes: "",
  what_went_well: "",
  what_went_wrong: "",
  root_cause: "",
  lessons_learned: "",
  equipment_issues: "",
  training_gaps: "",
  protocol_changes_recommended: "",
};

export function securityZoneFormToRequest(
  values: SecurityZoneFormInput,
): CreateSecurityZoneRequest {
  return {
    zone_code: values.zone_code.trim(),
    name: values.name.trim(),
    level: values.level ?? undefined,
    description: optionalTextFromFormValue(values.description),
    after_hours_restricted: values.after_hours_restricted,
    after_hours_start: optionalTextFromFormValue(values.after_hours_start),
    after_hours_end: optionalTextFromFormValue(values.after_hours_end),
  };
}

export function securityAccessCardFormToRequest(
  values: SecurityAccessCardFormInput,
): CreateSecurityAccessCardRequest {
  return {
    employee_id: values.employee_id.trim(),
    card_number: values.card_number.trim(),
    card_type: optionalTextFromFormValue(values.card_type),
  };
}

export function securityAccessLogFormToRequest(
  values: SecurityAccessLogFormInput,
): CreateSecurityAccessLogRequest {
  return {
    zone_id: values.zone_id.trim(),
    person_name: optionalTextFromFormValue(values.person_name),
    access_method: values.access_method ?? undefined,
    direction: values.direction ?? undefined,
    granted: values.granted,
    is_after_hours: values.is_after_hours,
  };
}

export function securityCameraFormToRequest(
  values: SecurityCameraFormInput,
): CreateSecurityCameraRequest {
  return {
    name: values.name.trim(),
    camera_id: optionalTextFromFormValue(values.camera_id),
    zone_id: optionalTextFromFormValue(values.zone_id),
    location_description: optionalTextFromFormValue(values.location_description),
    camera_type: values.camera_type ?? undefined,
    resolution: optionalTextFromFormValue(values.resolution),
    retention_days: optionalIntegerFromFormValue(values.retention_days) ?? 30,
    ip_address: optionalTextFromFormValue(values.ip_address),
  };
}

export function securityIncidentFormToRequest(
  values: SecurityIncidentFormInput,
): CreateSecurityIncidentRequest {
  return {
    severity: values.severity ?? undefined,
    category: values.category,
    zone_id: optionalTextFromFormValue(values.zone_id),
    location_description: optionalTextFromFormValue(values.location_description),
    description: values.description.trim(),
    police_notified: values.police_notified,
    police_report_number: optionalTextFromFormValue(values.police_report_number),
  };
}

export function securityPatientTagFormToRequest(
  values: SecurityPatientTagFormInput,
): CreateSecurityPatientTagRequest {
  return {
    patient_id: values.patient_id.trim(),
    tag_type: values.tag_type,
    tag_identifier: optionalTextFromFormValue(values.tag_identifier),
    allowed_zone_id: optionalTextFromFormValue(values.allowed_zone_id),
    mother_id: optionalTextFromFormValue(values.mother_id),
  };
}

export function securityCodeDebriefFormToRequest(
  values: SecurityCodeDebriefFormInput,
): CreateSecurityCodeDebriefRequest {
  return {
    code_activation_id: values.code_activation_id.trim(),
    response_time_seconds: optionalIntegerFromFormValue(values.response_time_seconds),
    total_duration_minutes: optionalIntegerFromFormValue(values.total_duration_minutes),
    what_went_well: optionalTextFromFormValue(values.what_went_well),
    what_went_wrong: optionalTextFromFormValue(values.what_went_wrong),
    root_cause: optionalTextFromFormValue(values.root_cause),
    lessons_learned: optionalTextFromFormValue(values.lessons_learned),
    equipment_issues: optionalTextFromFormValue(values.equipment_issues),
    training_gaps: optionalTextFromFormValue(values.training_gaps),
    protocol_changes_recommended: optionalTextFromFormValue(values.protocol_changes_recommended),
  };
}
