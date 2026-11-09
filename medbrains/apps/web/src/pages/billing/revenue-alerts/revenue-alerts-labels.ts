// Words and numbers for the insurance desk's alerts: pre-auths nearly used up
// and rooms above the policy limit.

import type { RevenueAlert } from "@medbrains/types";

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** "₹1,00,000", or an em dash for a missing figure. */
export function inr(value: unknown): string {
  const n = Number(value);
  return value === null || value === undefined || !Number.isFinite(n) ? "—" : INR.format(n);
}

/** A number from an evidence field, or null. */
export function evidenceNumber(row: RevenueAlert, key: string): number | null {
  const raw = row.evidence?.[key];
  const n = Number(raw);
  return raw === null || raw === undefined || !Number.isFinite(n) ? null : n;
}

/** The pre-auth's approval now, or null when it cannot be read. */
export function liveApproval(row: RevenueAlert): number | null {
  const n = Number(row.approved_amount);
  return row.approved_amount === null || !Number.isFinite(n) ? null : n;
}

/** Share of the live approval the running bill has used, as a whole percent. */
export function percentUsed(row: RevenueAlert): number | null {
  const approved = liveApproval(row);
  const running = evidenceNumber(row, "running_bill");
  if (approved === null || running === null || approved <= 0) return null;
  return Math.round((running / approved) * 100);
}

/** What the insurer may cut from `bill` of room-linked charges at `ratio`. */
export function estimateDeduction(bill: number, ratio: number): number {
  return Math.round(bill * (1 - ratio) * 100) / 100;
}

/** Why an insured inpatient has no usable pre-auth, in words. */
const MISSING_CAUSE: Record<string, string> = {
  expired: "Pre-auth expired",
  unlinked: "Pre-auth not linked to this stay",
  not_approved: "Pre-auth not approved yet",
  none: "No pre-auth for this stay",
};

/** The approval share (a whole percent) at which this row warned. */
function bandOf(row: RevenueAlert): number | null {
  return evidenceNumber(row, "band") ?? evidenceNumber(row, "threshold_percent");
}

/** The row's state in words; the `_unknown` reasons say the check failed. */
export function reasonLabel(row: RevenueAlert): string {
  switch (row.reason) {
    case "preauth_used_up": {
      const band = bandOf(row);
      if (band !== null && band >= 100) return "Approval used up";
      return band === null ? "Approval nearly used" : `${band}% of approval used`;
    }
    case "preauth_approval_unknown":
      return "Approval amount unknown";
    case "preauth_missing_or_expired":
      return MISSING_CAUSE[String(row.evidence?.cause)] ?? "No usable pre-auth";
    case "room_over_limit":
      return "Room above policy limit";
    case "room_eligibility_unknown":
      return "Could not check room";
  }
}

/** Whether the row's only remedy is a new or renewed pre-auth, not an enhancement. */
export function isMissingPreauth(row: RevenueAlert): boolean {
  return row.reason === "preauth_missing_or_expired";
}

/** Whether the row is a fault rather than a finding. */
export function isUnknown(row: RevenueAlert): boolean {
  return row.reason.endsWith("_unknown");
}
