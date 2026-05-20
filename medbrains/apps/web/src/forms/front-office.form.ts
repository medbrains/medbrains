import {
  formNumberValue,
  integerFromFormValue,
  optionalIntegerFromFormValue,
  optionalTextFromFormValue,
  requiredTrimmed,
} from "@medbrains/schemas";
import type {
  CreateEnquiryRequest,
  CreateVisitorPassRequest,
  CreateVisitorRequest,
  UpsertDisplayConfigRequest,
  UpsertQueuePriorityRequest,
  UpsertVisitingHoursRequest,
} from "@medbrains/types";
import { z } from "zod";

type SelectOption = {
  value: string;
  label: string;
};

const optionalPhone = z.string().refine((value) => {
  const trimmed = value.trim();
  return trimmed.length === 0 || /^[\d+\-() ]{7,20}$/.test(trimmed);
}, "Enter a valid phone number");

const timeValue = z.string().refine((value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value), {
  message: "Use HH:MM in 24-hour format",
});

const boundedInteger = (message: string, min: number, max: number) =>
  formNumberValue.refine((value) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isInteger(parsed) && parsed >= min && parsed <= max;
  }, message);

export const VISITOR_CATEGORY_OPTIONS: SelectOption[] = [
  { value: "general", label: "General" },
  { value: "legal_counsel", label: "Legal Counsel" },
  { value: "religious", label: "Religious" },
  { value: "vip", label: "VIP" },
  { value: "media", label: "Media" },
  { value: "vendor", label: "Vendor" },
  { value: "emergency", label: "Emergency" },
];

export const VISITOR_ID_TYPE_OPTIONS: SelectOption[] = [
  { value: "aadhaar", label: "Aadhaar" },
  { value: "driving_license", label: "Driving License" },
  { value: "passport", label: "Passport" },
  { value: "pan", label: "PAN Card" },
  { value: "voter_id", label: "Voter ID" },
];

export const QUEUE_PRIORITY_OPTIONS: SelectOption[] = [
  { value: "normal", label: "Normal" },
  { value: "elderly", label: "Elderly" },
  { value: "disabled", label: "Disabled" },
  { value: "pregnant", label: "Pregnant" },
  { value: "emergency_referral", label: "Emergency Referral" },
  { value: "vip", label: "VIP" },
];

export const DISPLAY_TYPE_OPTIONS: SelectOption[] = [
  { value: "waiting_area", label: "Waiting Area" },
  { value: "doctor_room", label: "Doctor Room" },
  { value: "counter", label: "Counter" },
];

export const ENQUIRY_TYPE_OPTIONS: SelectOption[] = [
  { value: "patient_status", label: "Patient Status" },
  { value: "visiting_hours", label: "Visiting Hours" },
  { value: "doctor_availability", label: "Doctor Availability" },
  { value: "general", label: "General" },
  { value: "billing", label: "Billing" },
];

export const DAY_OPTIONS: SelectOption[] = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export const frontOfficeVisitorFormSchema = z.object({
  visitor_name: requiredTrimmed("Visitor name is required", 160),
  phone: optionalPhone,
  id_type: z.string().nullable(),
  id_number: z.string().max(64, "ID number is too long"),
  relationship: z.string().max(80, "Relationship is too long"),
  category: z.string().nullable(),
  purpose: z.string().max(500, "Purpose is too long"),
});

export const frontOfficeVisitorPassFormSchema = z.object({
  valid_hours: boundedInteger("Valid hours must be between 1 and 24", 1, 24),
});

export const frontOfficeQueuePriorityFormSchema = z.object({
  priority: requiredTrimmed("Priority is required", 80),
  weight: boundedInteger("Weight must be between 1 and 100", 1, 100),
});

export const frontOfficeDisplayConfigFormSchema = z.object({
  location_name: requiredTrimmed("Location name is required", 160),
  display_type: z.string().nullable(),
  doctors_per_screen: boundedInteger("Doctors per screen must be between 1 and 20", 1, 20),
  show_patient_name: z.boolean(),
  show_wait_time: z.boolean(),
  announcement_enabled: z.boolean(),
});

export const frontOfficeVisitingHoursFormSchema = z.object({
  day_of_week: z.string().regex(/^[0-6]$/, "Select a valid day"),
  start_time: timeValue,
  end_time: timeValue,
  max_visitors_per_patient: boundedInteger("Max visitors must be between 1 and 10", 1, 10),
});

export const frontOfficeEnquiryFormSchema = z.object({
  caller_name: z.string().max(160, "Caller name is too long"),
  caller_phone: optionalPhone,
  enquiry_type: z.string().nullable(),
  response_text: z.string().max(1000, "Response is too long"),
});

export type FrontOfficeVisitorFormInput = z.infer<typeof frontOfficeVisitorFormSchema>;
export type FrontOfficeVisitorPassFormInput = z.infer<typeof frontOfficeVisitorPassFormSchema>;
export type FrontOfficeQueuePriorityFormInput = z.infer<typeof frontOfficeQueuePriorityFormSchema>;
export type FrontOfficeDisplayConfigFormInput = z.infer<typeof frontOfficeDisplayConfigFormSchema>;
export type FrontOfficeVisitingHoursFormInput = z.infer<typeof frontOfficeVisitingHoursFormSchema>;
export type FrontOfficeEnquiryFormInput = z.infer<typeof frontOfficeEnquiryFormSchema>;

export const DEFAULT_VISITOR_FORM_VALUES: FrontOfficeVisitorFormInput = {
  visitor_name: "",
  phone: "",
  id_type: null,
  id_number: "",
  relationship: "",
  category: "general",
  purpose: "",
};

export const DEFAULT_VISITOR_PASS_FORM_VALUES: FrontOfficeVisitorPassFormInput = {
  valid_hours: 2,
};

export const DEFAULT_QUEUE_PRIORITY_FORM_VALUES: FrontOfficeQueuePriorityFormInput = {
  priority: "normal",
  weight: 1,
};

export const DEFAULT_DISPLAY_CONFIG_FORM_VALUES: FrontOfficeDisplayConfigFormInput = {
  location_name: "",
  display_type: "waiting_area",
  doctors_per_screen: 4,
  show_patient_name: false,
  show_wait_time: true,
  announcement_enabled: false,
};

export const DEFAULT_VISITING_HOURS_FORM_VALUES: FrontOfficeVisitingHoursFormInput = {
  day_of_week: "1",
  start_time: "09:00",
  end_time: "17:00",
  max_visitors_per_patient: 2,
};

export const DEFAULT_ENQUIRY_FORM_VALUES: FrontOfficeEnquiryFormInput = {
  caller_name: "",
  caller_phone: "",
  enquiry_type: "general",
  response_text: "",
};

export function toCreateVisitorRequest(values: FrontOfficeVisitorFormInput): CreateVisitorRequest {
  return {
    visitor_name: values.visitor_name.trim(),
    phone: optionalTextFromFormValue(values.phone),
    id_type: values.id_type ?? undefined,
    id_number: optionalTextFromFormValue(values.id_number),
    relationship: optionalTextFromFormValue(values.relationship),
    category: values.category ?? undefined,
    purpose: optionalTextFromFormValue(values.purpose),
  };
}

export function toCreateVisitorPassRequest(
  registrationId: string,
  values: FrontOfficeVisitorPassFormInput,
): CreateVisitorPassRequest {
  return {
    registration_id: registrationId,
    valid_hours: integerFromFormValue(values.valid_hours, 2),
  };
}

export function toUpsertQueuePriorityRequest(
  values: FrontOfficeQueuePriorityFormInput,
): UpsertQueuePriorityRequest {
  return {
    priority: values.priority,
    weight: integerFromFormValue(values.weight, 1),
  };
}

export function toUpsertDisplayConfigRequest(
  values: FrontOfficeDisplayConfigFormInput,
): UpsertDisplayConfigRequest {
  return {
    location_name: values.location_name.trim(),
    display_type: values.display_type ?? undefined,
    doctors_per_screen: optionalIntegerFromFormValue(values.doctors_per_screen),
    show_patient_name: values.show_patient_name,
    show_wait_time: values.show_wait_time,
    announcement_enabled: values.announcement_enabled,
  };
}

export function toUpsertVisitingHoursRequest(
  values: FrontOfficeVisitingHoursFormInput,
): UpsertVisitingHoursRequest {
  return {
    day_of_week: Number(values.day_of_week),
    start_time: values.start_time,
    end_time: values.end_time,
    max_visitors_per_patient: integerFromFormValue(values.max_visitors_per_patient, 2),
  };
}

export function toCreateEnquiryRequest(values: FrontOfficeEnquiryFormInput): CreateEnquiryRequest {
  return {
    caller_name: optionalTextFromFormValue(values.caller_name),
    caller_phone: optionalTextFromFormValue(values.caller_phone),
    enquiry_type: values.enquiry_type ?? undefined,
    response_text: optionalTextFromFormValue(values.response_text),
  };
}
