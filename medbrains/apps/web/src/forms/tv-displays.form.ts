import {
  integerFromFormValue,
  optionalTextFromFormValue,
  type QueueTokenFormInput,
  type TvAnnouncementFormInput,
  type TvDisplayFormInput,
  tvDisplayTypeValues,
} from "@medbrains/schemas";
import type {
  BroadcastAnnouncementRequest,
  CreateQueueTokenRequest,
  CreateTvDisplayRequest,
  TvDisplay,
  UpdateTvDisplayRequest,
} from "@medbrains/types";

export const defaultTvDisplayFormValues: TvDisplayFormInput = {
  location_name: "",
  display_type: "opd_queue",
  department_id: "",
  doctors_per_screen: 4,
  show_patient_name: false,
  show_wait_time: true,
  language: ["en"],
  announcement_enabled: true,
  scroll_speed: 5,
};

export const defaultQueueTokenFormValues: QueueTokenFormInput = {
  department_id: "",
  patient_id: "",
  doctor_id: "",
  priority: "normal",
};

export const defaultTvAnnouncementFormValues: TvAnnouncementFormInput = {
  message: "",
  priority: "info",
  display_ids: [],
};

const tvDisplayTypes = new Set<string>(tvDisplayTypeValues);

function isTvDisplayType(value: string): value is TvDisplayFormInput["display_type"] {
  return tvDisplayTypes.has(value);
}

export function tvDisplayToForm(display: TvDisplay | null): TvDisplayFormInput {
  if (!display) return defaultTvDisplayFormValues;
  return {
    location_name: display.location_name,
    display_type: isTvDisplayType(display.display_type) ? display.display_type : "opd_queue",
    department_id: display.department_id ?? "",
    doctors_per_screen: display.doctors_per_screen,
    show_patient_name: display.show_patient_name,
    show_wait_time: display.show_wait_time,
    language: display.language.length > 0 ? display.language : ["en"],
    announcement_enabled: display.announcement_enabled,
    scroll_speed: display.scroll_speed,
  };
}

export function tvDisplayFormToCreateRequest(data: TvDisplayFormInput): CreateTvDisplayRequest {
  return {
    location_name: data.location_name.trim(),
    display_type: data.display_type,
    department_id: optionalTextFromFormValue(data.department_id),
    doctors_per_screen: integerFromFormValue(data.doctors_per_screen, 4),
    show_patient_name: data.show_patient_name,
    show_wait_time: data.show_wait_time,
    language: data.language.length > 0 ? data.language : ["en"],
    announcement_enabled: data.announcement_enabled,
    scroll_speed: integerFromFormValue(data.scroll_speed, 5),
  };
}

export function tvDisplayFormToUpdateRequest(data: TvDisplayFormInput): UpdateTvDisplayRequest {
  return tvDisplayFormToCreateRequest(data);
}

export function queueTokenFormToRequest(data: QueueTokenFormInput): CreateQueueTokenRequest {
  return {
    department_id: data.department_id.trim(),
    patient_id: optionalTextFromFormValue(data.patient_id),
    doctor_id: optionalTextFromFormValue(data.doctor_id),
    priority: data.priority,
  };
}

export function tvAnnouncementFormToRequest(
  data: TvAnnouncementFormInput,
): BroadcastAnnouncementRequest {
  return {
    message: data.message.trim(),
    priority: data.priority,
    display_ids: data.display_ids.length > 0 ? data.display_ids : undefined,
  };
}
