// How an early-warning score reads on screen — one place for every view.

import type { EwsBand, EwsResponseAction, EwsTool, EwsZone } from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

export const EWS_TOOL_LABEL: Record<EwsTool, string> = {
  news2: "NEWS2",
  pews: "PEWS",
  meows: "MEOWS",
};

export const EWS_BAND_LABEL: Record<EwsBand, string> = {
  routine: "Routine",
  low: "Low",
  low_medium: "Low–medium",
  urgent: "Urgent",
  emergency: "Emergency",
};

export const EWS_BAND_TONE: Record<EwsBand, BadgeTone> = {
  routine: "success",
  low: "neutral",
  low_medium: "warning",
  urgent: "warning",
  emergency: "danger",
};

export const EWS_ZONE_TONE: Record<EwsZone, BadgeTone> = {
  white: "neutral",
  yellow: "warning",
  orange: "warning",
  red: "danger",
  blue: "danger",
};

export const EWS_PARAM_LABEL: Record<string, string> = {
  respiratory_rate: "Respiratory rate",
  spo2: "SpO₂",
  air_or_oxygen: "Air or oxygen",
  oxygen: "Oxygen",
  systolic_bp: "Systolic BP",
  diastolic_bp: "Diastolic BP",
  pulse: "Heart rate",
  consciousness: "Consciousness",
  temperature: "Temperature",
  respiratory_distress: "Respiratory distress",
  capillary_refill: "Capillary refill",
  age: "Date of birth",
};

export const EWS_RESPONSE_LABEL: Record<EwsResponseAction, string> = {
  bedside_review: "Reviewed at the bedside",
  medical_review: "Medical review requested",
  plan_changed: "Treatment plan changed",
  rapid_response_called: "Rapid response team called",
  transfer_higher_care: "Transfer to higher care",
  other: "Other",
};

/** "6", or "3+" when the set was incomplete (the score can only rise). */
export function ewsTotalText(total: number, incomplete: boolean): string {
  return incomplete ? `${total}+` : String(total);
}

/** The bands at or above which a tool's chart turns urgent / emergency. */
export function ewsReferenceLines(tool: EwsTool): { y: number; label: string }[] {
  if (tool === "news2") {
    return [
      { y: 5, label: "Urgent (5)" },
      { y: 7, label: "Emergency (7)" },
    ];
  }
  if (tool === "pews") {
    return [
      { y: 6, label: "Urgent (6)" },
      { y: 8, label: "Emergency (8)" },
    ];
  }
  return [{ y: 2, label: "Triggered (2 yellow)" }];
}

export type DueState = "overdue" | "due_soon" | "scheduled";

/** Overdue once the time has passed; due soon within 15 minutes. */
export function ewsDueState(nextDueAt: string, now: number = Date.now()): DueState {
  const minutes = (new Date(nextDueAt).getTime() - now) / 60_000;
  if (minutes <= 0) return "overdue";
  if (minutes <= 15) return "due_soon";
  return "scheduled";
}

export const DUE_TONE: Record<DueState, BadgeTone> = {
  overdue: "danger",
  due_soon: "warning",
  scheduled: "neutral",
};

export const DUE_LABEL: Record<DueState, string> = {
  overdue: "Observations overdue",
  due_soon: "Observations due soon",
  scheduled: "Next observations",
};
