/**
 * Words for every state on Health → Intelligence. Each label is text, never
 * colour alone, and small counts are always "fewer than 5" (RFC-OSINT §4).
 */

import type { BaselineMethod, CheckStatus, SignalLevel } from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

/** The rule, in words, exactly as the server applies it (baseline.rs). */
export const BASELINE_RULE =
  "Higher than usual means at least 5 cases in the last 7 days and more than the usual number " +
  "plus twice its normal variation; much higher means more than the usual plus three times it. " +
  "Normal variation is the larger of how much past weeks varied and the square root of the usual.";

export const HEAT_RULE =
  "India Meteorological Department (plains): a heat wave is declared at a maximum of 45 °C, or " +
  "40 °C and 4.5 °C above normal; severe at 47 °C. Without a station normal, 40 °C is shown as " +
  "heat caution.";

export const AIR_RULE =
  "CPCB National Air Quality Index bands from the current hourly PM2.5 and PM10 readings (the " +
  "index itself uses 24-hour averages). Poor or worse is an advisory.";

export function levelLabel(level: SignalLevel): { label: string; tone: BadgeTone } {
  if (level === "much_higher") return { label: "Much higher than usual", tone: "danger" };
  if (level === "higher") return { label: "Higher than usual", tone: "warning" };
  return { label: "Usual", tone: "neutral" };
}

/** A count as shown: null (1–4, suppressed by the server) is "fewer than 5". */
export function formatCount(count: number | null): string {
  if (count === null) return "fewer than 5";
  // Defence in depth: never print 1–4 even if a server sent one.
  if (count > 0 && count < 5) return "fewer than 5";
  return String(count);
}

export function methodLabel(method: BaselineMethod): string {
  if (method === "same_weeks_previous_years") return "Same weeks in previous years";
  if (method === "rolling_8_weeks") return "Previous 8 weeks";
  return "Not enough history yet";
}

const HEAT: Record<string, { label: string; tone: BadgeTone }> = {
  none: { label: "No heat advisory", tone: "success" },
  heat_caution: { label: "Heat caution", tone: "warning" },
  heat_wave: { label: "Heat wave", tone: "danger" },
  severe_heat_wave: { label: "Severe heat wave", tone: "danger" },
};

const AIR: Record<string, { label: string; tone: BadgeTone }> = {
  good: { label: "Good", tone: "success" },
  satisfactory: { label: "Satisfactory", tone: "success" },
  moderate: { label: "Moderate", tone: "info" },
  poor: { label: "Poor", tone: "warning" },
  very_poor: { label: "Very poor", tone: "danger" },
  severe: { label: "Severe", tone: "danger" },
};

const UNKNOWN = { label: "Unknown", tone: "neutral" as BadgeTone };

export const heatLabel = (level: string) => HEAT[level] ?? UNKNOWN;
export const airLabel = (level: string) => AIR[level] ?? UNKNOWN;

export function checkLabel(state: CheckStatus["state"]): { label: string; tone: BadgeTone } {
  if (state === "running") return { label: "Running", tone: "success" };
  if (state === "failing") return { label: "Last attempt failed", tone: "warning" };
  if (state === "stopped") return { label: "Stopped", tone: "danger" };
  return { label: "Never run", tone: "danger" };
}

/** Checks that need a person: anything not running. */
export const troubledChecks = (checks: CheckStatus[]) =>
  checks.filter((c) => c.state !== "running");
