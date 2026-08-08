/**
 * How long a bed has been waiting on its terminal clean.
 *
 * Lifted out of the screen so the rule can be tested without a React Native
 * renderer, and so the decision it encodes is visible on its own rather than
 * buried in a card component.
 */

/** Past this, a dirty bed is the reason somebody is waiting for admission. */
export const OVERDUE_MINUTES = 60;

export interface TurnaroundTiming {
  dirty_at: string | null;
  discharge_at: string | null;
}

/**
 * Counts from whichever moment the bed actually became the housekeeper's
 * problem.
 *
 * The fallback to `discharge_at` is the point of this function. A bed nobody
 * flagged as dirty is exactly the one that goes unnoticed, and reading only
 * `dirty_at` would show it as having waited no time at all — the worst case
 * would look like the best one.
 *
 * Returns null when neither timestamp exists, so the caller can say "unknown"
 * rather than print a confident zero.
 */
export function minutesWaiting(row: TurnaroundTiming, now: number = Date.now()): number | null {
  const since = row.dirty_at ?? row.discharge_at;
  if (!since) {
    return null;
  }
  const started = new Date(since).getTime();
  if (Number.isNaN(started)) {
    return null;
  }
  return Math.max(0, Math.round((now - started) / 60_000));
}

export function isOverdue(waiting: number | null): boolean {
  return waiting !== null && waiting >= OVERDUE_MINUTES;
}

export function waitingLabel(waiting: number | null): string {
  if (waiting === null) {
    return "Waiting time unknown";
  }
  if (waiting < 60) {
    return `WAITING ${waiting} MIN`;
  }
  const hours = Math.floor(waiting / 60);
  const minutes = waiting % 60;
  return `WAITING ${hours}H ${minutes}M`;
}
