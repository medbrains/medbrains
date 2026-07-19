// Infection Control shared helpers — split from infection-control.tsx (pure move).

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
  };
  return (c ? m[c] : undefined) ?? "neutral";
}
