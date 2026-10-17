import type { BadgeTone } from "@/components/ui";

/**
 * FDI tooth layout as a dentist reads a chart: the patient's right on the
 * viewer's left, upper arch on top. Quadrants 1-4 are permanent, 5-8
 * deciduous.
 */
const range = (from: number, to: number) =>
  Array.from({ length: Math.abs(to - from) + 1 }, (_, i) =>
    String(from < to ? from + i : from - i),
  );

export type Dentition = "permanent" | "deciduous";

export const ARCHES: Record<Dentition, { upper: string[]; lower: string[] }> = {
  permanent: {
    upper: [...range(18, 11), ...range(21, 28)],
    lower: [...range(48, 41), ...range(31, 38)],
  },
  deciduous: {
    upper: [...range(55, 51), ...range(61, 65)],
    lower: [...range(85, 81), ...range(71, 75)],
  },
};

export const CONDITIONS = [
  "caries",
  "filled",
  "missing",
  "crown",
  "root_canal",
  "implant",
  "extraction_needed",
  "healthy",
  "other",
] as const;

/** What needs treatment shows as a warning; what has been treated is informational. */
export function conditionTone(condition: string | undefined): BadgeTone {
  switch (condition) {
    case "caries":
    case "extraction_needed":
      return "danger";
    case "filled":
    case "crown":
    case "root_canal":
    case "implant":
      return "info";
    case "missing":
      return "neutral";
    case "healthy":
      return "success";
    default:
      return condition ? "warning" : "neutral";
  }
}

export const label = (value: string) => value.replace(/_/g, " ");
