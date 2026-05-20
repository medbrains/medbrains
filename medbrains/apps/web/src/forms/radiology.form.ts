import type { OrderBasketRadiologyPriorityFormValue } from "@medbrains/schemas";
import { orderBasketRadiologyPriorityValues } from "@medbrains/schemas";

const priorityLabels: Record<OrderBasketRadiologyPriorityFormValue, string> = {
  routine: "Routine",
  urgent: "Urgent",
  stat: "STAT",
};

export const radiologyPriorityOptions = orderBasketRadiologyPriorityValues.map((value) => ({
  value,
  label: priorityLabels[value],
}));

export function radiologyOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
