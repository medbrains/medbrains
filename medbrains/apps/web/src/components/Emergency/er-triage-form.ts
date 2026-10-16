import { refineBloodPressure } from "@medbrains/schemas";
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

const reading = (max: number) => z.number().int().min(0).max(max).optional();

export const erTriageSchema = z
  .object({
    triage_level: z.enum(TRIAGE_LEVELS, { message: "Choose the triage level" }),
    chief_complaint: z.string().optional(),
    pulse_rate: reading(300),
    respiratory_rate: reading(80),
    spo2: reading(100),
    gcs_score: z.number().int().min(3).max(15).optional(),
    pain_score: reading(10),
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
