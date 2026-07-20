// Chronic-care shared helpers — split from chronic-care.tsx (pure move).

import type { ChronicProgramTypeFormValue } from "@medbrains/schemas";
import type { BadgeTone } from "@/components/ui";

export const PROGRAM_TYPES: Array<{ value: ChronicProgramTypeFormValue; label: string }> = [
  { value: "tb_dots", label: "TB DOTS" },
  { value: "hiv_art", label: "HIV/ART" },
  { value: "diabetes", label: "Diabetes" },
  { value: "hypertension", label: "Hypertension" },
  { value: "ckd", label: "Chronic Kidney Disease" },
  { value: "copd", label: "COPD" },
  { value: "asthma", label: "Asthma" },
  { value: "cancer_chemo", label: "Cancer/Chemotherapy" },
  { value: "mental_health", label: "Mental Health" },
  { value: "epilepsy", label: "Epilepsy" },
  { value: "thyroid", label: "Thyroid" },
  { value: "rheumatic", label: "Rheumatic" },
  { value: "other", label: "Other" },
];

export const STATUS_COLORS: Record<string, BadgeTone> = {
  active: "success",
  completed: "success",
  discontinued: "warning",
  transferred: "primary",
  lost_to_followup: "danger",
  deceased: "neutral",
};
