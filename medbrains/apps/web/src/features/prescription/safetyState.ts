/**
 * What the prescriber is shown about drug safety, and how it changes.
 *
 * A safety check that fails must not leave the previous drug list's verdict on
 * screen: the prescriber reads it as applying to what is in front of them.
 * Both prescription writers used to update state only on success, so a failed
 * check silently kept the last result — alerts for drugs that were no longer
 * on the order, or an absence of alerts for drugs that were never screened.
 *
 * Not blocking on a safety-service outage is deliberate, and the server
 * re-checks allergies and serious interactions at save either way. Presenting
 * a stale verdict as current is the part that is not.
 */

export interface SafetyView<T> {
  /** Alerts to display. Meaningful only when `unavailable` is false. */
  alerts: T;
  /** The check could not run, so nothing has been screened. */
  unavailable: boolean;
}

export type SafetyEvent<T> =
  /** No drugs to check, or checking is disabled by tenant policy. */
  | { type: "reset" }
  /** The service answered. */
  | { type: "checked"; alerts: T }
  /** The service could not be reached. */
  | { type: "failed" };

/**
 * `empty` is the writer's own "no alerts" value — the shapes differ between
 * the two writers, so it is supplied rather than assumed.
 */
export function nextSafetyState<T>(event: SafetyEvent<T>, empty: T): SafetyView<T> {
  switch (event.type) {
    case "checked":
      return { alerts: event.alerts, unavailable: false };
    case "failed":
      // Deliberately drops whatever was there. Returning the previous state
      // here is the bug this function exists to prevent.
      return { alerts: empty, unavailable: true };
    default:
      return { alerts: empty, unavailable: false };
  }
}
