import type { RadiologyContrast, RadiologyExamListItem } from "@medbrains/types";
import type { BodySite } from "@/components/BodySite/anatomy-atlas";

export const CONTRAST_OPTIONS: { value: RadiologyContrast; label: string }[] = [
  { value: "none", label: "No contrast" },
  { value: "without", label: "Plain (without)" },
  { value: "with", label: "With contrast" },
  { value: "with_and_without", label: "Plain + contrast" },
];

export function contrastLabel(contrast: RadiologyContrast): string {
  return CONTRAST_OPTIONS.find((o) => o.value === contrast)?.label ?? contrast;
}

/** What picking an exam fills in on an order form. */
export interface ExamOrderDefaults {
  site: BodySite | null;
  contrastRequired: boolean;
}

export function examOrderDefaults(exam: RadiologyExamListItem): ExamOrderDefaults {
  return {
    site: exam.body_part
      ? { label: exam.body_part, code: exam.body_part_code, laterality: null }
      : null,
    contrastRequired: exam.contrast === "with" || exam.contrast === "with_and_without",
  };
}

/**
 * The exam's price as billing will charge it, or why it bills nothing:
 * prices live in the charge master, never on the exam.
 */
export function examPriceLabel(exam: Pick<RadiologyExamListItem, "price" | "billing_code">): {
  priced: boolean;
  text: string;
} {
  return exam.price === null
    ? { priced: false, text: `No price — add ${exam.billing_code} in the charge master` }
    : { priced: true, text: `₹${exam.price}` };
}
