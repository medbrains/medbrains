// Utilization-review shared helpers — split from utilization-review.tsx (pure move).

import type { BadgeTone } from "@/components/ui";
import { statusColor } from "@/lib/status-colors";

export const reviewTypeColors: Record<string, BadgeTone> = {
  pre_admission: "primary",
  admission: "success",
  continued_stay: "warning",
  retrospective: "neutral",
};

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

export function optionalTrimmed(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
