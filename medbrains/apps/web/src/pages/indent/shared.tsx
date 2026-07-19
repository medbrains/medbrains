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
