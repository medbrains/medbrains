// Shared indent helpers — colour→BadgeTone resolver used across indent panels.

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

export const indentTypeLabels: Record<string, string> = {
  general: "General",
  pharmacy: "Pharmacy",
  lab: "Lab",
  surgical: "Surgical",
  housekeeping: "Housekeeping",
  emergency: "Emergency",
};

export function statusToStep(status: string): number {
  const map: Record<string, number> = {
    draft: 0,
    submitted: 1,
    approved: 2,
    partially_approved: 2,
    rejected: 2,
    issued: 3,
    partially_issued: 3,
    closed: 4,
    cancelled: 4,
  };
  return map[status] ?? 0;
}

export const statusColors: Record<string, string> = {
  draft: "slate",
  submitted: "primary",
  approved: "success",
  partially_approved: "teal",
  rejected: "danger",
  issued: "violet",
  partially_issued: "primary",
  closed: "dark",
  cancelled: "danger",
};
