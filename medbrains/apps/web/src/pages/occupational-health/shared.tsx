// Occupational Health shared helpers — split from occupational-health.tsx (pure move).

import type { BadgeTone } from "@/components/ui";
import { statusColor } from "@/lib/status-colors";

export const SCREENING_TYPES = [
  { value: "pre_employment", label: "Pre-Employment" },
  { value: "periodic", label: "Periodic" },
  { value: "special", label: "Special" },
  { value: "exit", label: "Exit" },
];

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

export const FITNESS_STATUS_COLORS: Record<string, string> = {
  fit: "success",
  unfit: "danger",
  pending: "gray",
  referred: "orange",
};
