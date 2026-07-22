/**
 * The result of an advisory check, and how it changes.
 *
 * Several screens run a check that warns but does not block — drug safety on a
 * prescription, duplicate orders on a lab test or procedure. They shared a
 * bug: state was updated only on success, so a failed check either left the
 * previous subject's result on screen or showed an empty result that reads as
 * "nothing found".
 *
 * Empty and unavailable are not the same thing. "Checked, nothing found" and
 * "could not check" render identically unless the difference is carried
 * explicitly, and the clinician has no way to tell that a safeguard did not
 * run.
 *
 * Not blocking when the check fails is deliberate and stays that way. Claiming
 * a clean result that was never received is the part that is not.
 */

export interface CheckResult<T> {
  /** Findings to display. Meaningful only when `unavailable` is false. */
  findings: T;
  /** The check could not run, so nothing has been examined. */
  unavailable: boolean;
}

export type CheckEvent<T> =
  /** Nothing to check, or checking is disabled by tenant policy. */
  | { type: "reset" }
  /** The service answered. */
  | { type: "checked"; findings: T }
  /** The service could not be reached. */
  | { type: "failed" };

/**
 * `empty` is the caller's own "no findings" value — the shapes differ between
 * callers, so it is supplied rather than assumed.
 */
export function nextCheckState<T>(event: CheckEvent<T>, empty: T): CheckResult<T> {
  switch (event.type) {
    case "checked":
      return { findings: event.findings, unavailable: false };
    case "failed":
      // Deliberately drops whatever was there. Returning the previous state
      // here is the bug this function exists to prevent.
      return { findings: empty, unavailable: true };
    default:
      return { findings: empty, unavailable: false };
  }
}
