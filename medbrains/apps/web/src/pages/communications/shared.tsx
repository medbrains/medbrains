// Communications shared helpers — split from communications.tsx (pure move).

import type { BadgeTone } from "@/components/ui";

export function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function requiredText(value: string | null | undefined) {
  return optionalText(value) ?? null;
}

export function numberValue(value: number | string) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const PRIORITY_COLORS: Record<string, BadgeTone> = {
  routine: "info",
  urgent: "warning",
  critical: "danger",
  stat: "danger",
};
