/**
 * Ordering and urgency for infant-RFID and wander-guard alerts.
 *
 * Kept out of the screen so the rule can be tested, and because the ordering is
 * a safety decision rather than a display preference.
 */

/** Past this, an unanswered tag alert is no longer a response — it is a search. */
export const ESCALATE_MINUTES = 5;

export interface TagAlertTiming {
  id: string;
  triggered_at: string;
}

export function minutesSinceTrigger(
  alert: TagAlertTiming,
  now: number = Date.now(),
): number | null {
  const at = new Date(alert.triggered_at).getTime();
  if (Number.isNaN(at)) {
    return null;
  }
  return Math.max(0, Math.round((now - at) / 60_000));
}

export function needsEscalation(minutes: number | null): boolean {
  return minutes !== null && minutes >= ESCALATE_MINUTES;
}

/**
 * Oldest first — the opposite of every other list in this app.
 *
 * Elsewhere newest-first is right because recent means relevant. Here the
 * longest-unanswered alert is the one where a tagged patient has had the most
 * time to leave the building, so it has to be the first thing a guard sees.
 * An alert with an unreadable timestamp sorts to the top rather than the
 * bottom: it cannot be shown to be safe.
 */
export function byMostUrgent<T extends TagAlertTiming>(alerts: ReadonlyArray<T>): T[] {
  return [...alerts].sort((a, b) => {
    const left = new Date(a.triggered_at).getTime();
    const right = new Date(b.triggered_at).getTime();
    if (Number.isNaN(left)) {
      return Number.isNaN(right) ? 0 : -1;
    }
    if (Number.isNaN(right)) {
      return 1;
    }
    return left - right;
  });
}
