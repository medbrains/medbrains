/**
 * The HBCR abstract form: its values are strings (what Mantine Selects and
 * inputs hold), the API wants codes. Pattern checks mirror the server's
 * (`medbrains_core::specialty::hbcr`); the server re-checks every save.
 */
import type { HbcrCoding, RegistryStatus, RegistryWorklistRow } from "@medbrains/types";
import { z } from "zod";

const optionalPattern = (re: RegExp, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || re.test(v), message);

export const registrySchema = z.object({
  hbcr_registration_no: z.string().trim().max(40),
  date_of_first_diagnosis: z.string(),
  case_registered_through: z.string(),
  referral_type: z.string(),
  method_of_diagnosis: z.string(),
  icdo3_topography: optionalPattern(/^C[0-8][0-9]\.[0-9]$/, "Topography looks like C50.4"),
  icdo3_morphology: optionalPattern(/^[89][0-9]{3}\/[0-369]$/, "Morphology looks like 8500/3"),
  icd10_code: optionalPattern(/^[CD][0-9]{2}(\.[0-9])?$/, "ICD-10 looks like C50.4"),
  laterality: z.string(),
  sequence: z.string(),
  extent_of_disease: z.string(),
  staging_system: z.string(),
  prior_treatment: z.string(),
  intention: z.string(),
  ecog: z.string(),
  treatment_at_ri: z.string(),
});

export type RegistryFormValues = z.infer<typeof registrySchema>;

const CODED = [
  "case_registered_through",
  "method_of_diagnosis",
  "laterality",
  "sequence",
  "extent_of_disease",
  "staging_system",
  "prior_treatment",
  "intention",
  "ecog",
  "treatment_at_ri",
] as const;

const TEXT = [
  "hbcr_registration_no",
  "date_of_first_diagnosis",
  "icdo3_topography",
  "icdo3_morphology",
  "icd10_code",
] as const;

/** Form values from a saved abstract; blanks for what is not coded yet. */
export function toFormValues(c: HbcrCoding): RegistryFormValues {
  const out = { referral_type: c.referral_type ?? "" } as RegistryFormValues;
  for (const k of CODED) out[k] = c[k] === null ? "" : String(c[k]);
  for (const k of TEXT) out[k] = c[k] ?? "";
  return out;
}

/** The coding to save: blank becomes null, codes become numbers. */
export function toCoding(v: RegistryFormValues): HbcrCoding {
  const out = {
    referral_type: v.referral_type === "" ? null : v.referral_type,
  } as HbcrCoding;
  for (const k of CODED) out[k] = v[k] === "" ? null : Number(v[k]);
  for (const k of TEXT) out[k] = v[k].trim() === "" ? null : v[k].trim();
  return out;
}

export type Filter = "open" | RegistryStatus | "all";

/** Whether a worklist row shows under a filter; "open" is everything not yet submitted. */
export function matchesFilter(row: RegistryWorklistRow, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "open") return row.status !== "submitted";
  return row.status === filter;
}
