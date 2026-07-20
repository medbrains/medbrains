// Radiology shared helpers — split from radiology.tsx (pure move).

import type { BadgeTone } from "@/components/ui";

export function colorToBadgeTone(color: string | null | undefined): BadgeTone {
  switch (color) {
    case "primary":
      return "primary";
    case "info":
    case "blue":
      return "info";
    case "warning":
    case "orange":
    case "yellow":
      return "warning";
    case "teal":
    case "green":
    case "success":
      return "success";
    case "danger":
    case "red":
      return "danger";
    case "violet":
    case "grape":
    case "rose":
    case "cinnabar":
      return "accent";
    default:
      return "neutral";
  }
}
