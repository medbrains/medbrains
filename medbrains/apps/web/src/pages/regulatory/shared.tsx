// Shared regulatory helpers — status→BadgeTone resolver used across the compliance tabs.

import type { BadgeTone } from "@/components/ui";
import { statusColor } from "@/lib/status-colors";

export function statusColorTone(v: string): BadgeTone {
  const c = statusColor(v);
  const m: Record<string, BadgeTone> = {
    success: "success",
    danger: "danger",
    warning: "warning",
    primary: "primary",
    info: "info",
    slate: "neutral",
    gray: "neutral",
    teal: "success",
    green: "success",
    red: "danger",
    yellow: "warning",
    orange: "warning",
    blue: "info",
    violet: "accent",
    cinnabar: "accent",
  };
  return (c ? m[c] : undefined) ?? "neutral";
}

export const checklistStatusColors: Record<string, BadgeTone> = {
  not_started: "neutral",
  in_progress: "primary",
  compliant: "success",
  non_compliant: "danger",
  not_applicable: "neutral",
};
