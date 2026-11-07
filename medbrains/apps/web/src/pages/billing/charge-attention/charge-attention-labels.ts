// Plain-language labels for the charge attention queue: which module raised
// the charge and why it could not be posted.

import type { ChargeAttentionStatus } from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

const MODULE_LABELS: Record<string, string> = {
  ambulance: "Ambulance",
  cssd: "CSSD",
  diet: "Diet",
  emergency: "Emergency",
  ipd: "IPD",
  opd: "OPD",
  ot: "Operation theatre",
};

const REASON_LABELS: Record<string, string> = {
  billing_setting_unreadable: "Auto-billing setting could not be read",
  "charge_failed:database": "Charge could not be saved",
  "charge_failed:rejected": "Charge refused: details did not match",
  "charge_failed:not_found": "Charge refused: record not found",
  "charge_failed:conflict": "Charge refused: conflicting record",
  "charge_failed:internal": "Billing is not set up for this charge",
  "charge_failed:other": "Charge could not be posted",
};

export const STATUS_LABEL: Record<ChargeAttentionStatus, string> = {
  open: "Needs attention",
  posted: "Posted",
  dismissed: "Dismissed",
};

export const STATUS_TONE: Record<ChargeAttentionStatus, BadgeTone> = {
  open: "warning",
  posted: "success",
  dismissed: "neutral",
};

/** The module's name, or its code when it is one this screen does not know. */
export function moduleLabel(code: string): string {
  return MODULE_LABELS[code] ?? code;
}

/** Why the charge is here, in words; the raw class when unknown. */
export function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}
