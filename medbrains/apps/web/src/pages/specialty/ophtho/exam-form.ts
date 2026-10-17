/**
 * The eye-exam form's shape and its conversion to and from the API (#231).
 * Ranges are checked again on the server, which has the final word; these
 * catch the slip before the round trip.
 */
import type { OphthoExam, UpdateOphthoExamRequest } from "@medbrains/types";
import { z } from "zod";

const quarter = (lo: number, hi: number, what: string) =>
  z
    .number()
    .min(lo, `${what} ${lo} to +${hi}`)
    .max(hi, `${what} ${lo} to +${hi}`)
    .refine((v) => Number.isInteger(v * 4), `${what} in 0.25 steps`)
    .nullable();

const acuity = z.string().trim().max(20, "A short value such as 6/9, N6 or CF");
const axis = z.number().int().min(1, "Axis 1 to 180°").max(180, "Axis 1 to 180°").nullable();

export const LENS_TYPES = [
  { value: "single_vision", label: "Single vision" },
  { value: "bifocal", label: "Bifocal" },
  { value: "progressive", label: "Progressive" },
  { value: "none", label: "No glasses needed" },
] as const;

export const examSchema = z.object({
  patient_id: z.string().min(1, "Choose the patient"),
  visual_acuity_od: acuity,
  visual_acuity_os: acuity,
  bcva_od: acuity,
  bcva_os: acuity,
  near_va_od: acuity,
  near_va_os: acuity,
  sphere_od: quarter(-30, 30, "Sphere"),
  sphere_os: quarter(-30, 30, "Sphere"),
  cylinder_od: quarter(-10, 10, "Cylinder"),
  cylinder_os: quarter(-10, 10, "Cylinder"),
  axis_od: axis,
  axis_os: axis,
  add_od: quarter(0.25, 4, "Add"),
  add_os: quarter(0.25, 4, "Add"),
  iop_od: z.number().min(0).max(80, "IOP 0 to 80 mmHg").nullable(),
  iop_os: z.number().min(0).max(80, "IOP 0 to 80 mmHg").nullable(),
  pd_mm: z.number().min(40, "PD 40 to 80 mm").max(80, "PD 40 to 80 mm").nullable(),
  lens_type: z.enum(["single_vision", "bifocal", "progressive", "none"]).nullable(),
  lens_advice: z.string(),
  review_after_months: z.number().int().min(1).max(60, "Review 1 to 60 months").nullable(),
  slit_lamp: z.string(),
  fundus: z.string(),
  diagnosis: z.string(),
  plan: z.string(),
});
export type ExamForm = z.infer<typeof examSchema>;

const TEXT = [
  "visual_acuity_od",
  "visual_acuity_os",
  "bcva_od",
  "bcva_os",
  "near_va_od",
  "near_va_os",
  "lens_advice",
  "slit_lamp",
  "fundus",
  "diagnosis",
  "plan",
] as const;
const DECIMAL = [
  "sphere_od",
  "sphere_os",
  "cylinder_od",
  "cylinder_os",
  "add_od",
  "add_os",
  "iop_od",
  "iop_os",
  "pd_mm",
] as const;

const num = (v: string | null) => (v == null ? null : Number(v));

export function toForm(exam: OphthoExam | null, patientId: string): ExamForm {
  const form = {
    patient_id: exam?.patient_id ?? patientId,
    axis_od: exam?.axis_od ?? null,
    axis_os: exam?.axis_os ?? null,
    lens_type: exam?.lens_type ?? null,
    review_after_months: exam?.review_after_months ?? null,
  } as ExamForm;
  for (const k of TEXT) form[k] = exam?.[k] ?? "";
  for (const k of DECIMAL) form[k] = num(exam?.[k] ?? null);
  return form;
}

/** The workup as the API takes it: blanks are null, powers are decimal strings. */
export function toWorkup(v: ExamForm): UpdateOphthoExamRequest {
  const out: Record<string, unknown> = {
    axis_od: v.axis_od,
    axis_os: v.axis_os,
    lens_type: v.lens_type,
    review_after_months: v.review_after_months,
  };
  for (const k of TEXT) out[k] = v[k].trim() === "" ? null : v[k].trim();
  for (const k of DECIMAL) out[k] = v[k] == null ? null : String(v[k]);
  return out as UpdateOphthoExamRequest;
}
