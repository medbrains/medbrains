import type { GroupMatchMethod, MpiMatchBand } from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

/** How a record was linked, as staff read it. */
export const METHOD_LABEL: Record<GroupMatchMethod, string> = {
  abha: "Verified ABHA",
  aadhaar: "Same Aadhaar",
  probabilistic: "Reviewed match",
  manual: "Linked by hand",
};

export const BAND: Record<MpiMatchBand, { label: string; tone: BadgeTone }> = {
  certain: { label: "Same person", tone: "danger" },
  likely: { label: "Likely same", tone: "warning" },
  review: { label: "Check", tone: "neutral" },
};
