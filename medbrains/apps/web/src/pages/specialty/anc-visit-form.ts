import { refineBloodPressure } from "@medbrains/schemas";
import type { CreateAncVisitRequest } from "@medbrains/types";
import { z } from "zod";

// One antenatal visit. Gestational age, weight, BP, fundal height, FHR,
// urine dipstick, oedema and Hb — the MoHFW ANC card — plus the
// pre-eclampsia screen the visit exists to run.

export const URINE_DIPSTICK = ["nil", "trace", "1+", "2+", "3+", "4+"] as const;
export const OEDEMA = ["none", "pedal", "generalised"] as const;

/** Hypertension in pregnancy: ≥140 systolic or ≥90 diastolic (ACOG / FOGSI). */
export const PRE_ECLAMPSIA_BP = { systolic: 140, diastolic: 90 } as const;

export function isPreEclampsiaRangeBp(systolic?: number | null, diastolic?: number | null) {
  return (
    (systolic != null && systolic >= PRE_ECLAMPSIA_BP.systolic) ||
    (diastolic != null && diastolic >= PRE_ECLAMPSIA_BP.diastolic)
  );
}

/** Proteinuria on dipstick: 1+ or more. */
export function hasProteinuria(urineProtein?: string | null): boolean {
  return urineProtein != null && /^[1-4]\+$/.test(urineProtein);
}

const optional = (min: number, max: number) => z.number().min(min).max(max).optional();

export const ancVisitSchema = z
  .object({
    visit_number: z.number().int().min(1).max(20),
    gestational_weeks: z.number({ message: "Enter the gestational age" }).min(4).max(44),
    weight_kg: optional(25, 250),
    bp_systolic: z.number().optional(),
    bp_diastolic: z.number().optional(),
    fundal_height_cm: optional(5, 50),
    fetal_heart_rate: z.number().int().min(60).max(220).optional(),
    hemoglobin: optional(2, 20),
    urine_protein: z.enum(URINE_DIPSTICK).optional(),
    urine_sugar: z.enum(URINE_DIPSTICK).optional(),
    oedema: z.enum(OEDEMA).optional(),
    notes: z.string().optional(),
  })
  .superRefine(refineBloodPressure("bp_systolic", "bp_diastolic"));

export type AncVisitFormValues = z.input<typeof ancVisitSchema>;

export function toCreateAncVisitRequest(
  values: z.output<typeof ancVisitSchema>,
): CreateAncVisitRequest {
  const { notes, ...rest } = values;
  return { ...rest, notes: notes?.trim() ? notes.trim() : undefined };
}
