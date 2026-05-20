import type {
  DietTypeFormValue,
  FormNumberValue,
  KitchenAuditTypeFormValue,
  MealPrepStatusFormValue,
  MealTypeFormValue,
} from "@medbrains/schemas";
import {
  dietTypeValues,
  integerFromFormValue,
  kitchenAuditTypeValues,
  mealPrepStatusValues,
  mealTypeValues,
  numberFromFormValue,
  optionalIntegerFromFormValue,
  optionalNumberFromFormValue,
  optionalTextFromFormValue,
} from "@medbrains/schemas";

const dietTypeLabels: Record<DietTypeFormValue, string> = {
  regular: "Regular",
  diabetic: "Diabetic",
  renal: "Renal",
  cardiac: "Cardiac",
  liquid: "Liquid",
  soft: "Soft",
  high_protein: "High Protein",
  low_sodium: "Low Sodium",
  npo: "NPO",
  custom: "Custom",
};

const mealTypeLabels: Record<MealTypeFormValue, string> = {
  breakfast: "Breakfast",
  morning_snack: "Morning Snack",
  lunch: "Lunch",
  afternoon_snack: "Afternoon Snack",
  dinner: "Dinner",
  bedtime_snack: "Bedtime Snack",
};

const mealPrepStatusLabels: Record<MealPrepStatusFormValue, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  dispatched: "Dispatched",
  delivered: "Delivered",
};

const kitchenAuditTypeLabels: Record<KitchenAuditTypeFormValue, string> = {
  routine: "Routine",
  surprise: "Surprise",
  external: "External",
};

export const dietTypeOptions = dietTypeValues.map((value) => ({
  value,
  label: dietTypeLabels[value],
}));

export const mealTypeOptions = mealTypeValues.map((value) => ({
  value,
  label: mealTypeLabels[value],
}));

export const mealPrepStatusOptions = mealPrepStatusValues.map((value) => ({
  value,
  label: mealPrepStatusLabels[value],
}));

export const kitchenAuditTypeOptions = kitchenAuditTypeValues.map((value) => ({
  value,
  label: kitchenAuditTypeLabels[value],
}));

export function dietOptionalText(value: string): string | undefined {
  return optionalTextFromFormValue(value);
}

export function dietNumberOrFallback(value: FormNumberValue, fallback: number): number {
  return numberFromFormValue(value, fallback);
}

export function dietIntegerOrFallback(value: FormNumberValue, fallback: number): number {
  return integerFromFormValue(value, fallback);
}

export function dietOptionalNumber(value: FormNumberValue): number | undefined {
  return optionalNumberFromFormValue(value);
}

export function dietOptionalInteger(value: FormNumberValue): number | undefined {
  return optionalIntegerFromFormValue(value);
}
