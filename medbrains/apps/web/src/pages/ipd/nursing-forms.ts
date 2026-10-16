// Form schemas + request mappers for the nursing admission assessment and
// care plans (NABH initial nursing assessment; IPSG-6 prevention plans).

import type { CreateCarePlanRequest, CreateNursingAssessmentRequest } from "@medbrains/types";
import { z } from "zod";

const text = z.string().trim();

export const nursingAssessmentSchema = z.object({
  general_appearance: text.min(1, "Describe the general appearance"),
  consciousness: z.enum(["alert", "drowsy", "confused", "unresponsive"]),
  skin_condition: z.enum(["intact", "dry", "broken", "pressure_injury"]),
  skin_notes: text,
  pain_score: z.number().int().min(0).max(10),
  pain_location: text,
  nutrition: z.enum(["normal", "poor_intake", "nil_by_mouth", "tube_feeding"]),
  elimination: text,
  breathing: z.enum(["room_air", "oxygen", "ventilated"]),
  respiratory_notes: text,
  psychosocial: text,
  allergies: text,
  medications_on_admission: text,
  personal_belongings: text,
  patient_education_needs: text,
});

export type NursingAssessmentValues = z.infer<typeof nursingAssessmentSchema>;

export const NURSING_ASSESSMENT_DEFAULTS: NursingAssessmentValues = {
  general_appearance: "",
  consciousness: "alert",
  skin_condition: "intact",
  skin_notes: "",
  pain_score: 0,
  pain_location: "",
  nutrition: "normal",
  elimination: "",
  breathing: "room_air",
  respiratory_notes: "",
  psychosocial: "",
  allergies: "",
  medications_on_admission: "",
  personal_belongings: "",
  patient_education_needs: "",
};

const orUndefined = (value: string) => value || undefined;

export function toNursingAssessmentRequest(
  v: NursingAssessmentValues,
): CreateNursingAssessmentRequest {
  return {
    general_appearance: { appearance: v.general_appearance, consciousness: v.consciousness },
    skin_assessment: { condition: v.skin_condition, notes: v.skin_notes },
    pain_assessment: { score: v.pain_score, location: v.pain_location },
    nutritional_status: { status: v.nutrition },
    elimination_status: { notes: v.elimination },
    respiratory_status: { support: v.breathing, notes: v.respiratory_notes },
    psychosocial_status: { notes: v.psychosocial },
    personal_belongings: { items: v.personal_belongings },
    allergies: orUndefined(v.allergies),
    medications_on_admission: orUndefined(v.medications_on_admission),
    patient_education_needs: orUndefined(v.patient_education_needs),
  };
}

export const carePlanSchema = z.object({
  nursing_diagnosis: text.min(1, "Enter the nursing diagnosis"),
  goals: text,
  interventions: text,
  evaluation: text,
});

export type CarePlanValues = z.infer<typeof carePlanSchema>;

export const CARE_PLAN_DEFAULTS: CarePlanValues = {
  nursing_diagnosis: "",
  goals: "",
  interventions: "",
  evaluation: "",
};

/** One intervention per line, blanks dropped. */
export function splitInterventions(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** The stored interventions as editable lines; tolerates any JSON shape. */
export function interventionLines(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function toCarePlanRequest(v: CarePlanValues): CreateCarePlanRequest {
  return {
    nursing_diagnosis: v.nursing_diagnosis,
    goals: orUndefined(v.goals),
    interventions: splitInterventions(v.interventions),
    evaluation: orUndefined(v.evaluation),
  };
}
