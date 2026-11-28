import { refineBloodPressure, vitalRangeMessage } from "@medbrains/schemas";
import type { CreateTriageRequest } from "@medbrains/types";
import { z } from "zod";

// The ER triage assessment: an ESI level and the vitals it was decided on.
// The server stores each assessment and moves the visit to that level.

export const TRIAGE_LEVELS = [
  "immediate",
  "emergent",
  "urgent",
  "less_urgent",
  "non_urgent",
  "expectant",
] as const;

/** The triage form's number fields: what each is called and what it accepts. */
export const ER_TRIAGE_NUMBERS = [
  { name: "pulse_rate", label: "Pulse (bpm)", plain: "Pulse", min: 0, max: 300 },
  {
    name: "respiratory_rate",
    label: "Resp. rate (/min)",
    plain: "Respiratory rate",
    min: 0,
    max: 80,
  },
  { name: "spo2", label: "SpO₂ %", plain: "SpO₂", min: 0, max: 100 },
  { name: "gcs_score", label: "GCS (3–15)", plain: "GCS", min: 3, max: 15 },
  { name: "pain_score", label: "Pain (0–10)", plain: "Pain score", min: 0, max: 10 },
] as const;

/** Whole numbers, kept as typed: a clamp would turn "900" into a saved 300. */
export const TRIAGE_NUMBER_INPUT = { allowDecimal: false, clampBehavior: "none" } as const;

type TriageNumber = (typeof ER_TRIAGE_NUMBERS)[number];

/** A whole number within the field's range, refused in plain words otherwise. */
const reading = (field: TriageNumber) => {
  const message = vitalRangeMessage(field.plain, field);
  return z.number().int(message).min(field.min, message).max(field.max, message).optional();
};
const [PULSE, RESP_RATE, SPO2, GCS, PAIN] = ER_TRIAGE_NUMBERS;

export const erTriageSchema = z
  .object({
    triage_level: z.enum(TRIAGE_LEVELS, { message: "Choose the triage level" }),
    chief_complaint: z.string().optional(),
    pulse_rate: reading(PULSE),
    respiratory_rate: reading(RESP_RATE),
    spo2: reading(SPO2),
    gcs_score: reading(GCS),
    pain_score: reading(PAIN),
    blood_pressure_systolic: z.number().optional(),
    blood_pressure_diastolic: z.number().optional(),
    notes: z.string().optional(),
  })
  .superRefine(refineBloodPressure("blood_pressure_systolic", "blood_pressure_diastolic"));

export type ErTriageFormValues = z.input<typeof erTriageSchema>;

const text = (v: string | undefined) => (v?.trim() ? v.trim() : undefined);

export function toCreateTriageRequest(
  values: z.output<typeof erTriageSchema>,
): CreateTriageRequest {
  return {
    triage_level: values.triage_level,
    triage_system: "ESI",
    chief_complaint: text(values.chief_complaint),
    pulse_rate: values.pulse_rate,
    respiratory_rate: values.respiratory_rate,
    spo2: values.spo2,
    gcs_score: values.gcs_score,
    pain_score: values.pain_score,
    blood_pressure_systolic: values.blood_pressure_systolic,
    blood_pressure_diastolic: values.blood_pressure_diastolic,
    notes: text(values.notes),
  };
}
