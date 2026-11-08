// Plain-language labels for the charge attention queue: which module raised
// the charge, why it is here, and how its amount and age read.

import type { ChargeAttentionStatus } from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

const MODULE_LABELS: Record<string, string> = {
  ambulance: "Ambulance",
  cssd: "CSSD",
  diet: "Diet",
  emergency: "Emergency",
  ipd: "IPD",
  lab: "Laboratory",
  opd: "OPD",
  ot: "Operation theatre",
  procedure: "Procedure",
  radiology: "Radiology",
};

/** The leakage check's reason: the order was done and never billed. */
export const REASON_UNBILLED = "unbilled_order";

const REASON_LABELS: Record<string, string> = {
  [REASON_UNBILLED]: "Done, not billed",
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

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

/** What an unpriced row says, and why its Post is disabled. */
export const NO_TARIFF = "No tariff: set price";

/** A rupee amount, e.g. "₹1,050.00"; [`NO_TARIFF`] when the row has no price. */
export function rupees(amount: string | null): string {
  return amount === null ? NO_TARIFF : INR.format(Number(amount));
}

/** "Today", "1 day", "12 days". */
export function ageLabel(days: number): string {
  if (days <= 0) return "Today";
  return days === 1 ? "1 day" : `${days} days`;
}
