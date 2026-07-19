// Shared HR helpers — status→BadgeTone resolver used across the HR tabs.

import type { BadgeTone } from "@/components/ui";
import { statusColor } from "@/lib/status-colors";

export const STATUS_TONE: Record<string, BadgeTone> = {
  neutral: "neutral",
  gray: "neutral",
  slate: "neutral",
  dark: "neutral",
  primary: "primary",
  indigo: "primary",
  success: "success",
  green: "success",
  teal: "success",
  lime: "success",
  warning: "warning",
  yellow: "warning",
  orange: "warning",
  danger: "danger",
  red: "danger",
  info: "info",
  blue: "info",
  cyan: "info",
  accent: "accent",
  violet: "accent",
  grape: "accent",
  pink: "accent",
  rose: "accent",
};

export function statusBadgeTone(status: string | null | undefined): BadgeTone {
  return STATUS_TONE[statusColor(status)] ?? "neutral";
}
