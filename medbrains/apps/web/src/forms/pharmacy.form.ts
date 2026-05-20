import type {
  AwareCategoryFormValue,
  DrugScheduleFormValue,
  FormularyStatusFormValue,
  PharmacyNdpsActionFormValue,
  PharmacyStockTransactionTypeFormValue,
} from "@medbrains/schemas";
import {
  awareCategoryValues,
  drugScheduleValues,
  pharmacyNdpsActionValues,
  pharmacyStockTransactionTypeValues,
} from "@medbrains/schemas";

export const drugScheduleOptions: { value: DrugScheduleFormValue; label: string }[] =
  drugScheduleValues.map((value) => ({ value, label: value }));

export const formularyStatusOptions: { value: FormularyStatusFormValue; label: string }[] = [
  { value: "approved", label: "Approved" },
  { value: "restricted", label: "Restricted" },
  { value: "non_formulary", label: "Non-Formulary" },
];

export const awareCategoryOptions: { value: AwareCategoryFormValue; label: string }[] =
  awareCategoryValues.map((value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1),
  }));

const stockTransactionLabels: Record<PharmacyStockTransactionTypeFormValue, string> = {
  receipt: "Receipt (In)",
  issue: "Issue (Out)",
  return: "Return",
  adjustment: "Adjustment",
};

const ndpsActionLabels: Record<PharmacyNdpsActionFormValue, string> = {
  receipt: "Receipt",
  dispensed: "Dispensed",
  destroyed: "Destroyed",
  transferred: "Transferred",
  adjustment: "Adjustment",
};

export const stockTransactionTypeOptions = pharmacyStockTransactionTypeValues.map((value) => ({
  value,
  label: stockTransactionLabels[value],
}));

export const ndpsActionOptions = pharmacyNdpsActionValues.map((value) => ({
  value,
  label: ndpsActionLabels[value],
}));

export function formIntegerOrFallback(value: number | string, fallback: number): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export function formNumberOrFallback(value: number | string, fallback: number): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function optionalFormText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
