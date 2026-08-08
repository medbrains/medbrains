/**
 * Reading a QC run the way a lab has to act on it.
 *
 * The server decides the verdict — it computes the SD index, applies the
 * Westgard rules and sets the status. Nothing here re-judges that. What this
 * does is order and explain it, because the consequence is what a phone screen
 * has to make obvious: results on a test whose QC was rejected must not be
 * released.
 */

export type QcStatus = "rejected" | "warning" | "accepted";

export interface QcRun {
  status: QcStatus;
  westgard_violations: string[] | null;
  run_date: string | null;
}

/** Rejected first. A warning read before a rejection wastes the glance. */
const SEVERITY: Record<QcStatus, number> = {
  rejected: 0,
  warning: 1,
  accepted: 2,
};

export function bySeverity<T extends QcRun>(runs: ReadonlyArray<T>): T[] {
  return [...runs].sort((a, b) => {
    const bySev = SEVERITY[a.status] - SEVERITY[b.status];
    if (bySev !== 0) {
      return bySev;
    }
    // Within a status, most recent first — an old rejection that has since been
    // repeated is less urgent than today's.
    return (b.run_date ?? "").localeCompare(a.run_date ?? "");
  });
}

/**
 * Whether results on this test may be released.
 *
 * Only an accepted run clears it. A warning does not — the whole point of a
 * warning rule like 1_2s is that it is a signal to look before releasing, and
 * treating it as a pass is how the Westgard scheme stops working.
 */
export function blocksRelease(run: QcRun): boolean {
  return run.status !== "accepted";
}

/** Plain-language names, because "r_4s" means nothing at 2am. */
const RULE_NAMES: Record<string, string> = {
  "1_2s": "one result beyond 2SD",
  "1_3s": "one result beyond 3SD",
  "2_2s": "two in a row beyond 2SD",
  r_4s: "range across 4SD",
  "4_1s": "four in a row beyond 1SD",
  "10x": "ten in a row on one side",
};

export function describeViolations(violations: string[] | null): string {
  if (!violations || violations.length === 0) {
    return "No rule violations";
  }
  return violations.map((rule) => RULE_NAMES[rule] ?? rule).join(", ");
}
