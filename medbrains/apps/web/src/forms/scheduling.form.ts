import type {
  FormNumberValue,
  SchedulingPriorityFormValue,
  SchedulingResourceTypeFormValue,
} from "@medbrains/schemas";
import {
  integerFromFormValue,
  numberFromFormValue,
  optionalTextFromFormValue,
  schedulingPriorityValues,
  schedulingResourceTypeValues,
} from "@medbrains/schemas";

const priorityLabels: Record<SchedulingPriorityFormValue, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const resourceTypeLabels: Record<SchedulingResourceTypeFormValue, string> = {
  doctor: "Doctor",
  room: "Room",
  equipment: "Equipment",
};

export const schedulingPriorityOptions = schedulingPriorityValues.map((value) => ({
  value,
  label: priorityLabels[value],
}));

export const schedulingResourceTypeOptions = schedulingResourceTypeValues.map((value) => ({
  value,
  label: resourceTypeLabels[value],
}));

export function schedulingOptionalText(value: string): string | undefined {
  return optionalTextFromFormValue(value);
}

export function schedulingInteger(value: FormNumberValue, fallback: number): number {
  return integerFromFormValue(value, fallback);
}

export function schedulingNumber(value: FormNumberValue, fallback: number): number {
  return numberFromFormValue(value, fallback);
}

export function toDateInputValue(value: string): Date | null {
  return value ? new Date(value) : null;
}

export function toIsoDateInputValue(date: Date | string | null): string {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}
