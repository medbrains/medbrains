// Command-center shared helpers — split from command-center.tsx (pure move).

import type { BadgeTone } from "@/components/ui";

export const REFETCH = 30_000;

export function alertLevelColor(level: string): BadgeTone {
  return level === "critical" ? "danger" : "warning";
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleString();
}

export function fmtShortDate(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString();
}
