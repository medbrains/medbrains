// Shared quality helpers — cross-tab status→BadgeTone color maps and the status-tone
// resolver, extracted from quality.tsx so the tab components can split into their own
// files without a cycle.

import type { BadgeTone } from "@/components/ui";
import { statusColor } from "@/lib/status-colors";

export const incidentStatusColors: Record<string, BadgeTone> = {
  reported: "neutral",
  acknowledged: "primary",
  investigating: "primary",
  rca_complete: "accent",
  capa_assigned: "warning",
  capa_in_progress: "success",
  closed: "success",
  reopened: "danger",
};

export const docStatusColors: Record<string, BadgeTone> = {
  draft: "neutral",
  under_review: "primary",
  approved: "success",
  released: "success",
  revised: "warning",
  obsolete: "danger",
};

export const capaStatusColors: Record<string, BadgeTone> = {
  open: "neutral",
  in_progress: "primary",
  completed: "success",
  verified: "success",
  overdue: "danger",
};

export const auditStatusColors: Record<string, BadgeTone> = {
  planned: "neutral",
  in_progress: "primary",
  completed: "success",
  cancelled: "danger",
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
