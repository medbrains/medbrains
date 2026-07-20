// Communications shared helpers — split from communications.tsx (pure move).

import type { CommChannel } from "@medbrains/types";
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

export const CHANNEL_COLORS: Record<string, BadgeTone> = {
  sms: "info",
  whatsapp: "success",
  email: "accent",
  push: "warning",
  ivr: "info",
  portal: "success",
};

export function commChannel(value: string | null | undefined): CommChannel | null {
  if (
    value === "sms" ||
    value === "whatsapp" ||
    value === "email" ||
    value === "push" ||
    value === "ivr" ||
    value === "portal"
  ) {
    return value;
  }
  return null;
}
