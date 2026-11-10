/**
 * Words for the paperless meter's numbers. A share with nothing under it is
 * "no documents", and a range never counted is "not counted yet": neither is
 * ever shown as 0%.
 */

/** "67%", or the reason there is no share. */
export function formatShare(pct: number | null, empty = "No documents"): string {
  return pct === null ? empty : `${Math.round(pct)}%`;
}

/** "2 of 3": the count behind a share. */
export function ofCount(part: number, whole: number): string {
  return `${part.toLocaleString("en-IN")} of ${whole.toLocaleString("en-IN")}`;
}

/** The ranges a reader may pick, in days. */
export const RANGE_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];
