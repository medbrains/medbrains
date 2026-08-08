/**
 * Shaping a doctor's appointment list for a phone.
 *
 * Separated from the screen so the ordering and the "what is next" rule can be
 * tested, and because both are decisions rather than formatting.
 */

export interface ClinicAppointment {
  id: string;
  status: string;
  start_time: string | null;
}

/** Statuses that mean the patient is not going to be seen. */
const CLOSED = new Set(["cancelled", "no_show", "completed"]);

export function isStillToCome(appointment: ClinicAppointment): boolean {
  return !CLOSED.has(appointment.status);
}

/**
 * By clock time, earliest first.
 *
 * An appointment with no time sorts LAST rather than first. A missing time
 * usually means a walk-in slotted into the day, and putting it at the head of
 * the list would tell the doctor their next patient is one nobody has scheduled.
 */
export function byClinicTime<T extends ClinicAppointment>(list: ReadonlyArray<T>): T[] {
  return [...list].sort((a, b) => {
    if (!a.start_time) {
      return b.start_time ? 1 : 0;
    }
    if (!b.start_time) {
      return -1;
    }
    return a.start_time.localeCompare(b.start_time);
  });
}

/**
 * The one the doctor is about to see: earliest still-open appointment.
 *
 * Returns null when the clinic is finished, so the screen can say so rather
 * than pointing at somebody who has already left.
 */
export function nextPatient<T extends ClinicAppointment>(list: ReadonlyArray<T>): T | null {
  return byClinicTime(list).find(isStillToCome) ?? null;
}

export function remainingCount(list: ReadonlyArray<ClinicAppointment>): number {
  return list.filter(isStillToCome).length;
}
