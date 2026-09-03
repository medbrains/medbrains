/**
 * How long a token has waited, and whether that wait has moved it up.
 *
 * Mirrors `token_effective_weight` in migration 1006: one step of priority per
 * 30 minutes, floored at 3 so an aged token never precedes stat, urgent or
 * emergency_referral.
 *
 * This exists for the desk, not for the queue — the server decides the order.
 * But a `normal` patient called ahead of a VIP looks like a queue-jump to
 * whoever is standing there, and the desk is who has to explain it.
 */

/** Same table as `token_priority_weight`. Lower is called sooner. */
const WEIGHT: Record<string, number> = {
  stat: 0,
  urgent: 1,
  emergency_referral: 2,
  elderly: 3,
  disabled: 3,
  pregnant: 3,
  carried_over: 4,
  vip: 5,
};
const NORMAL_WEIGHT = 6;

/** Weights at or below this are clinical: they never age and are never passed. */
const CLINICAL_CEILING = 2;
const STEP_MINUTES = 30;

export function priorityWeight(priority: string): number {
  return WEIGHT[priority] ?? NORMAL_WEIGHT;
}

export function minutesWaited(createdAt: string, now: Date = new Date()): number {
  const started = new Date(createdAt).getTime();
  if (Number.isNaN(started)) return 0;
  return Math.max(0, Math.floor((now.getTime() - started) / 60_000));
}

export function effectiveWeight(priority: string, createdAt: string, now?: Date): number {
  const base = priorityWeight(priority);
  if (base <= CLINICAL_CEILING) return base;
  const steps = Math.floor(minutesWaited(createdAt, now) / STEP_MINUTES);
  return Math.max(CLINICAL_CEILING + 1, base - steps);
}

/** True when waiting has actually moved this token up the queue. */
export function hasAged(priority: string, createdAt: string, now?: Date): boolean {
  return effectiveWeight(priority, createdAt, now) < priorityWeight(priority);
}

/** "2h 15m" / "45m" — for a badge, not a report. */
export function formatWaited(createdAt: string, now?: Date): string {
  const mins = minutesWaited(createdAt, now);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
