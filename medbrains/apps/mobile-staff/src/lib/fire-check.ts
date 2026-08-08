/**
 * Status and validation for a fire-equipment check.
 *
 * Unlike medical gas, these are date comparisons rather than engineering
 * limits: an extinguisher past its expiry or refill date is out of date by
 * arithmetic, not by judgement, so computing it here is safe.
 */

export interface FireEquipmentDates {
  expiry_date?: string | null;
  next_refill_date?: string | null;
}

export type FireStatus = "expired" | "refill_due" | "ok" | "unknown";

/** ISO date compare, so no timezone shifts a due date across midnight. */
function isPast(date: string | null | undefined, today: string): boolean {
  return typeof date === "string" && date !== "" && date <= today;
}

/**
 * Expiry beats refill: a cylinder past its life is out regardless of when it
 * was last topped up, and reporting the lesser problem would let someone sign
 * it off.
 *
 * "unknown" when neither date is recorded — the equipment is not proven good,
 * and calling that "ok" is the mistake this whole screen exists to prevent.
 */
export function fireStatus(equipment: FireEquipmentDates, today: string): FireStatus {
  if (isPast(equipment.expiry_date, today)) {
    return "expired";
  }
  if (isPast(equipment.next_refill_date, today)) {
    return "refill_due";
  }
  if (!equipment.expiry_date && !equipment.next_refill_date) {
    return "unknown";
  }
  return "ok";
}

export function isBlocking(status: FireStatus): boolean {
  return status === "expired" || status === "refill_due" || status === "unknown";
}

export interface InspectionDraft {
  is_functional: boolean;
  findings: string;
}

/**
 * A failed check must say what is wrong. "Not functional" with no findings is a
 * record that cannot be acted on and cannot be audited — and fire equipment is
 * exactly what an inspector asks to see.
 */
export function inspectionProblem(draft: InspectionDraft): string | null {
  if (!draft.is_functional && draft.findings.trim().length < 5) {
    return "Say what is wrong. A failed check with no findings cannot be acted on.";
  }
  return null;
}
