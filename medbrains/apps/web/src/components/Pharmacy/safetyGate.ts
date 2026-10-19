import { ApiError } from "@medbrains/api";
import type { MedicationSafetyFinding } from "@medbrains/types";

/** Shortest override reason the server accepts. */
export const MIN_OVERRIDE_REASON = 5;

/** Who may override a block when the server did not say. */
const DEFAULT_OVERRIDE_PERMISSION = "pharmacy.safety.override";

/** Permission codes needed to override every blocking finding, deduplicated. */
export function overridePermissions(findings: readonly MedicationSafetyFinding[]): string[] {
  const codes = new Set<string>();
  for (const f of findings) {
    if (f.severity !== "block") continue;
    const p = f.detail.override_permission;
    codes.add(typeof p === "string" ? p : DEFAULT_OVERRIDE_PERMISSION);
  }
  return [...codes].sort();
}

export interface SafetyGate {
  blocks: MedicationSafetyFinding[];
  warnings: MedicationSafetyFinding[];
  /** A blocking finding is present: proceeding needs an override reason. */
  needsReason: boolean;
  /** The action may be submitted. False while checks are loading or failed. */
  canProceed: boolean;
}

/**
 * Whether a review or dispense may go ahead. Checks that have not run — still
 * loading, or failed — never read as clear: an outage is not a safe result.
 */
export function safetyGate(
  findings: readonly MedicationSafetyFinding[] | undefined,
  opts: { checked: boolean; canOverride: boolean; reason: string },
): SafetyGate {
  if (!opts.checked || !findings) {
    return { blocks: [], warnings: [], needsReason: false, canProceed: false };
  }
  const blocks = findings.filter((f) => f.severity === "block");
  const warnings = findings.filter((f) => f.severity !== "block");
  if (blocks.length === 0) return { blocks, warnings, needsReason: false, canProceed: true };
  return {
    blocks,
    warnings,
    needsReason: true,
    canProceed: opts.canOverride && opts.reason.trim().length >= MIN_OVERRIDE_REASON,
  };
}

/** Prefix of the server's refusal when a release meets a blocking finding. */
const SAFETY_REFUSAL = "Medication safety check:";

/**
 * Whether an error is the pharmacy safety gate refusing — as opposed to any
 * other conflict (stock, stage) — so the screen can offer an override.
 */
export function isSafetyRefusal(error: unknown): error is ApiError {
  return (
    error instanceof ApiError && error.status === 409 && error.message.includes(SAFETY_REFUSAL)
  );
}
