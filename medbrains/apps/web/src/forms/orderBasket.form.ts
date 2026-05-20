import type {
  OrderBasketDrugFrequencyFormValue,
  OrderBasketDrugRouteFormValue,
  OrderBasketLabPriorityFormValue,
  OrderBasketRadiologyPriorityFormValue,
} from "@medbrains/schemas";
import {
  orderBasketDrugFrequencyValues,
  orderBasketDrugRouteValues,
  orderBasketLabPriorityValues,
  orderBasketRadiologyPriorityValues,
} from "@medbrains/schemas";

export const drugFrequencyOptions: {
  value: OrderBasketDrugFrequencyFormValue;
  label: string;
}[] = orderBasketDrugFrequencyValues.map((value) => ({ value, label: value }));

export const drugRouteOptions: { value: OrderBasketDrugRouteFormValue; label: string }[] =
  orderBasketDrugRouteValues.map((value) => ({ value, label: value }));

export const labPriorityOptions: { value: OrderBasketLabPriorityFormValue; label: string }[] =
  orderBasketLabPriorityValues.map((value) => ({
    value,
    label: value === "stat" ? "STAT" : "Routine",
  }));

export const radiologyPriorityOptions: {
  value: OrderBasketRadiologyPriorityFormValue;
  label: string;
}[] = orderBasketRadiologyPriorityValues.map((value) => ({
  value,
  label: value === "stat" ? "STAT" : value.charAt(0).toUpperCase() + value.slice(1),
}));

export function formNumberOrFallback(value: number | string, fallback: number): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
