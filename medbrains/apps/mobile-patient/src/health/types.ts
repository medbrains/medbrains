/**
 * The health record the companion keeps on the phone.
 *
 * Deliberately its own vocabulary rather than a re-export of
 * `@medbrains/types`. A standalone user has no tenant, no UHID and no
 * encounter, and forcing the hospital's shapes on them would mean inventing a
 * fake tenant per user — which corrupts every count and every RLS assumption
 * on the server the moment the two ever meet. These types describe what a
 * person tracks about themselves; `RecordSource` is where they meet a chart.
 *
 * Wellness only. Nothing here expresses a diagnosis, a dose decision or a
 * triage outcome, and nothing should be added that does — see
 * RFCs/RFC-MODULE-patient-companion.md §3.
 */

/** Where a piece of the record came from. Shown to the user, not decorative. */
export type Provenance =
  /** The person typed it. */
  | "self"
  /** Read from a linked hospital record. Read-only to us. */
  | "record"
  /** Read from HealthKit / Health Connect. */
  | "wearable"
  /** Read from a paired MedBrains device. */
  | "device";

/** Things a person is asked to take. */
export interface MedicationPlan {
  readonly id: string;
  readonly name: string;
  /** Free text as written — "1 tablet twice a day after food". Never parsed into a dose decision. */
  readonly instructions: string;
  /** Local times of day, `HH:MM`, for reminders. Empty means no reminder. */
  readonly times: readonly string[];
  readonly startedOn: string;
  readonly endsOn?: string;
  readonly provenance: Provenance;
}

/** One "I took it" / "I missed it". The unit the streak is built from. */
export interface AdherenceEvent {
  readonly id: string;
  readonly planId: string;
  /** The scheduled slot this answers, so a late tick still lands on the right day. */
  readonly scheduledFor: string;
  readonly takenAt?: string;
  readonly status: "taken" | "skipped" | "missed";
}

/** A number a person tracks. Units are explicit because a bare number is unsafe. */
export interface Observation {
  readonly id: string;
  readonly kind: ObservationKind;
  readonly value: number;
  readonly unit: string;
  readonly recordedAt: string;
  readonly provenance: Provenance;
}

/**
 * The closed set the app understands. Adding one means deciding its unit and
 * its safe range copy, so it is a list rather than a free string.
 */
export type ObservationKind =
  | "weight"
  | "systolic"
  | "diastolic"
  | "pulse"
  | "glucose"
  | "spo2"
  | "temperature"
  | "steps"
  | "sleep_minutes";

/** Something the person, or their clinician, is aiming at. */
export interface Goal {
  readonly id: string;
  readonly kind: ObservationKind;
  readonly target: number;
  readonly unit: string;
  /** Whether higher or lower is the direction of travel. */
  readonly direction: "at_or_below" | "at_or_above";
  readonly provenance: Provenance;
}

/** Everything the app holds locally, in one value. */
export interface HealthRecord {
  readonly medications: readonly MedicationPlan[];
  readonly adherence: readonly AdherenceEvent[];
  readonly observations: readonly Observation[];
  readonly goals: readonly Goal[];
}

export const EMPTY_RECORD: HealthRecord = {
  medications: [],
  adherence: [],
  observations: [],
  goals: [],
};
