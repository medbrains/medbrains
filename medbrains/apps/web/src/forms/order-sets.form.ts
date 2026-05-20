import type {
  FormNumberValue,
  OrderSetContextFormValue,
  OrderSetItemTypeFormValue,
} from "@medbrains/schemas";
import {
  optionalIntegerFromFormValue,
  optionalTextFromFormValue,
  orderSetContextValues,
  orderSetItemTypeValues,
} from "@medbrains/schemas";

const contextLabels: Record<OrderSetContextFormValue, string> = {
  general: "General",
  admission: "Admission",
  pre_operative: "Pre-Operative",
  diagnosis_specific: "Diagnosis-Specific",
  department_specific: "Department-Specific",
};

const itemTypeLabels: Record<OrderSetItemTypeFormValue, string> = {
  lab: "Lab Test",
  medication: "Medication",
  nursing: "Nursing Task",
  diet: "Diet Order",
};

export const orderSetContextOptions = orderSetContextValues.map((value) => ({
  value,
  label: contextLabels[value],
}));

export const orderSetItemTypeOptions = orderSetItemTypeValues.map((value) => ({
  value,
  label: itemTypeLabels[value],
}));

export function orderSetOptionalText(value: string): string | undefined {
  return optionalTextFromFormValue(value);
}

export function orderSetOptionalInteger(value: FormNumberValue): number | undefined {
  return optionalIntegerFromFormValue(value);
}

export function parseTriggerDiagnoses(value: string): string[] | undefined {
  const codes = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return codes.length > 0 ? codes : undefined;
}
