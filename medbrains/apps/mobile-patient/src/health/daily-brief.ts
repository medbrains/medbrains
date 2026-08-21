/**
 * The daily brief — the reason to open the app on a day with nothing
 * scheduled.
 *
 * Pure, and deliberately so: everything here is decided from a `HealthRecord`
 * and a clock, with no I/O, so the rules can be tested without a device, a
 * hospital or a wearable.
 *
 * # The line it must not cross
 *
 * Every sentence this produces is an **observation about what happened**, never
 * an instruction about what to do next. "You have taken 6 of 8 doses this week"
 * is a fact. "Your blood pressure is high, see a doctor" is triage, and this
 * module is wellness-only (RFC-MODULE-patient-companion §3). The verdict
 * vocabulary below is a closed set for that reason — a free-text generator
 * here is how a wellness app becomes a medical device by accident.
 */

import type { AdherenceEvent, HealthRecord, MedicationPlan } from "./types.js";

/** One medication at one time of day, with whatever answer the person gave. */
export interface DoseSlot {
  readonly planId: string;
  readonly name: string;
  readonly instructions: string;
  /** `HH:MM`, local. */
  readonly time: string;
  /** ISO instant this slot belongs to, so a late tick lands on the right day. */
  readonly scheduledFor: string;
  readonly status: AdherenceEvent["status"] | "due";
}

/**
 * How much the app trusts its own numbers, and it says so out loud.
 *
 * Borrowed from the reference product's best idea: a score with no confidence
 * is a guess wearing a number. Three days of data cannot describe a pattern,
 * and pretending otherwise is how people lose trust in the whole app.
 */
export type Confidence = "calibrating" | "building" | "established";

export interface DailyBrief {
  /** Doses due today, ordered by time. Bounded — see `MAX_SLOTS`. */
  readonly slots: readonly DoseSlot[];
  /** Whole percent of scheduled doses taken over the trailing window, or null when nothing was scheduled. */
  readonly adherencePercent: number | null;
  /** Consecutive days, ending yesterday, with every scheduled dose taken. */
  readonly streakDays: number;
  readonly confidence: Confidence;
  /** Plain, factual, from a closed set. Never an instruction. */
  readonly verdict: string;
}

/**
 * A day's worth of slots is small, but a corrupt or hostile record should not
 * be able to make the screen unbounded (`docs/DEVICE-CONSTRAINED-RULES.md`).
 */
const MAX_SLOTS = 50;

/** Trailing window for the adherence figure. A week is what a person can hold in their head. */
const ADHERENCE_WINDOW_DAYS = 7;

const CALIBRATING_BELOW_DAYS = 7;
const ESTABLISHED_FROM_DAYS = 28;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function isActiveOn(plan: MedicationPlan, day: string): boolean {
  if (plan.startedOn.slice(0, 10) > day) {
    return false;
  }
  return plan.endsOn === undefined || plan.endsOn.slice(0, 10) >= day;
}

/** The instant a `HH:MM` slot on `day` refers to, as an ISO string. */
function slotInstant(day: string, time: string): string {
  return `${day}T${time.length === 5 ? `${time}:00` : time}.000Z`;
}

export function buildDailyBrief(record: HealthRecord, now: Date): DailyBrief {
  const today = now.toISOString().slice(0, 10);

  const answered = new Map<string, AdherenceEvent>();
  for (const event of record.adherence) {
    answered.set(`${event.planId}@${event.scheduledFor}`, event);
  }

  const slots: DoseSlot[] = [];
  for (const plan of record.medications) {
    if (!isActiveOn(plan, today)) {
      continue;
    }
    for (const time of plan.times) {
      const scheduledFor = slotInstant(today, time);
      slots.push({
        planId: plan.id,
        name: plan.name,
        instructions: plan.instructions,
        time,
        scheduledFor,
        status: answered.get(`${plan.id}@${scheduledFor}`)?.status ?? "due",
      });
    }
  }
  slots.sort((a, b) => a.time.localeCompare(b.time));

  return {
    slots: slots.slice(0, MAX_SLOTS),
    adherencePercent: adherenceOver(record, now, ADHERENCE_WINDOW_DAYS),
    streakDays: streakEndingYesterday(record, now),
    confidence: confidenceFrom(record, now),
    verdict: verdictFor(slots, adherenceOver(record, now, ADHERENCE_WINDOW_DAYS)),
  };
}

/**
 * Percent of *scheduled* doses that were taken in the trailing window.
 *
 * `null` when nothing was scheduled — which is not the same as 0%, and showing
 * a zero to somebody who takes no regular medication would be both wrong and
 * discouraging.
 */
export function adherenceOver(record: HealthRecord, now: Date, days: number): number | null {
  const from = new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);

  let scheduled = 0;
  let taken = 0;
  for (const event of record.adherence) {
    const day = dayKey(event.scheduledFor);
    if (day < from || day > to) {
      continue;
    }
    scheduled += 1;
    if (event.status === "taken") {
      taken += 1;
    }
  }
  return scheduled === 0 ? null : Math.round((taken / scheduled) * 100);
}

/**
 * Consecutive complete days ending yesterday.
 *
 * Deliberately excludes today: a streak that counts a day still in progress
 * breaks every evening when the last dose is not yet due, which reads as a
 * punishment for it being 6pm.
 */
export function streakEndingYesterday(record: HealthRecord, now: Date): number {
  const byDay = new Map<string, { scheduled: number; taken: number }>();
  for (const event of record.adherence) {
    const day = dayKey(event.scheduledFor);
    const bucket = byDay.get(day) ?? { scheduled: 0, taken: 0 };
    bucket.scheduled += 1;
    if (event.status === "taken") {
      bucket.taken += 1;
    }
    byDay.set(day, bucket);
  }

  let streak = 0;
  for (let back = 1; back <= 365; back += 1) {
    const day = new Date(now.getTime() - back * 86_400_000).toISOString().slice(0, 10);
    const bucket = byDay.get(day);
    if (!bucket || bucket.scheduled === 0 || bucket.taken < bucket.scheduled) {
      break;
    }
    streak += 1;
  }
  return streak;
}

/** Days between the earliest thing we know about and now. */
export function confidenceFrom(record: HealthRecord, now: Date): Confidence {
  const stamps = [
    ...record.adherence.map((event) => event.scheduledFor),
    ...record.observations.map((observation) => observation.recordedAt),
  ];
  if (stamps.length === 0) {
    return "calibrating";
  }
  const earliest = stamps.reduce((a, b) => (a < b ? a : b));
  const days = Math.floor((now.getTime() - Date.parse(earliest)) / 86_400_000);
  if (days < CALIBRATING_BELOW_DAYS) {
    return "calibrating";
  }
  return days >= ESTABLISHED_FROM_DAYS ? "established" : "building";
}

/**
 * The closed verdict set.
 *
 * Each is a statement about what happened or what is scheduled. None tells the
 * person what to do about their health, and none interprets a clinical value.
 * Adding a sentence here is a regulatory decision, not a copy change.
 */
function verdictFor(slots: readonly DoseSlot[], adherence: number | null): string {
  if (slots.length === 0) {
    return "Nothing scheduled today.";
  }
  const remaining = slots.filter((slot) => slot.status === "due").length;
  if (remaining === 0) {
    return "Everything scheduled for today is marked done.";
  }
  if (adherence !== null && adherence >= 80) {
    return `${remaining} left today. You are at ${adherence}% this week.`;
  }
  return remaining === 1 ? "1 dose left today." : `${remaining} doses left today.`;
}
