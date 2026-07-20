// Case-management shared helpers — split from case-management.tsx (pure move).

import type { BadgeTone } from "@/components/ui";

export const BARRIER_TYPE_COLORS: Record<string, BadgeTone> = {
  insurance_auth: "danger",
  placement: "warning",
  equipment: "info",
  family: "warning",
  transport: "primary",
  financial: "danger",
  clinical: "accent",
  documentation: "neutral",
  other: "neutral",
};

export function truncate(val: string | undefined | null, len: number): string {
  if (!val) return "—";
  return val.length > len ? `${val.slice(0, len)}...` : val;
}
