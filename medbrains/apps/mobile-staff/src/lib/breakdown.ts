/**
 * What a reported equipment breakdown must say before it can be filed.
 *
 * The priority wording is deliberately about the patient rather than the
 * device. A nurse at a bedside knows whether someone is currently depending on
 * the thing that just failed; they do not necessarily know whether it is a
 * "critical asset" in an inventory sense, and asking them to guess produces a
 * field nobody can trust.
 */

export type BreakdownPriority = "critical" | "high" | "medium" | "low";

export const PRIORITY_MEANING: Record<BreakdownPriority, string> = {
  critical: "A patient is on it right now",
  high: "Needed within the hour",
  medium: "Needed today",
  low: "Can wait",
};

export interface BreakdownDraft {
  equipmentId: string | null;
  priority: BreakdownPriority;
  description: string;
}

export interface BreakdownProblems {
  equipment?: string;
  description?: string;
  canSubmit: boolean;
}

const MIN_DESCRIPTION = 8;

export function checkBreakdown(draft: BreakdownDraft): BreakdownProblems {
  const equipment = draft.equipmentId ? undefined : "Scan or pick the equipment first.";

  // An engineer arriving to "not working" has to diagnose from scratch, which
  // is the difference between a swap and a shift of downtime.
  const description =
    draft.description.trim().length < MIN_DESCRIPTION
      ? "Say what it is doing. 'Not working' tells the engineer nothing."
      : undefined;

  return { equipment, description, canSubmit: !equipment && !description };
}

/**
 * Whether reporting this should also take the device out of service in the
 * reporter's mind — i.e. whether to show the warning.
 *
 * Only `critical` means a patient is on it now, and that is the case where the
 * device must be swapped before anything else happens.
 */
export function needsImmediateSwap(priority: BreakdownPriority): boolean {
  return priority === "critical";
}
