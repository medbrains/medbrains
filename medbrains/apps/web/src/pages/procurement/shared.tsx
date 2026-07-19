// Procurement shared helpers — split from procurement.tsx (pure move).

import type { BadgeTone } from "@/components/ui";

export const colorToBadgeTone = (color: string | null | undefined): BadgeTone => {
  switch (color) {
    case "primary":
      return "primary";
    case "success":
    case "green":
    case "teal":
    case "lime":
      return "success";
    case "warning":
    case "yellow":
    case "orange":
      return "warning";
    case "danger":
    case "red":
      return "danger";
    case "info":
    case "blue":
    case "cyan":
      return "info";
    case "violet":
    case "grape":
    case "indigo":
      return "accent";
    default:
      return "neutral";
  }
};

export const optionalText = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
};

export const formNumber = (value: string | number | undefined | null) => {
  if (value == null || (typeof value === "string" && value.trim().length === 0)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const requiredFormNumber = (value: string | number) => Number(value);
