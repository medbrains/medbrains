import { Box, Tooltip } from "@mantine/core";
import styles from "./abbr.module.scss";

/**
 * Shared clinical abbreviation dictionary — one source of truth so shorthand
 * renders consistently and always expands to the same full term. Add entries
 * here, not inline at call sites.
 */
export const MEDICAL_ABBR = {
  patient: { short: "Pt", full: "Patient" },
  diagnosis: { short: "Dx", full: "Diagnosis" },
  prescription: { short: "Rx", full: "Prescription" },
  treatment: { short: "Tx", full: "Treatment" },
  history: { short: "Hx", full: "History" },
  symptoms: { short: "Sx", full: "Symptoms" },
  biopsy: { short: "Bx", full: "Biopsy" },
  fracture: { short: "Fx", full: "Fracture" },
  doctor: { short: "Dr", full: "Doctor" },
  appointment: { short: "Appt", full: "Appointment" },
  admission: { short: "Adm", full: "Admission" },
  discharge: { short: "DC", full: "Discharge" },
  outpatient: { short: "OPD", full: "Outpatient Department" },
  inpatient: { short: "IPD", full: "Inpatient Department" },
  operation_theatre: { short: "OT", full: "Operation Theatre" },
} as const satisfies Record<string, { short: string; full: string }>;

export type AbbrTerm = keyof typeof MEDICAL_ABBR;

export interface AbbrProps {
  /** Dictionary key — fills short + full from `MEDICAL_ABBR`. */
  term?: AbbrTerm;
  /** Short form shown inline (overrides the dictionary). */
  short?: string;
  /** Full expansion revealed on hover (overrides the dictionary). */
  full?: string;
  /** `underline` = inline dotted-underline text (default); `slug` = boxed chip. */
  variant?: "underline" | "slug";
  size?: "xs" | "sm" | "md";
}

/**
 * Clinical abbreviation label — renders a short form (e.g. "Pt") that expands
 * to its full term (e.g. "Patient") on hover and for screen readers, via the
 * native `<abbr>` element. Same family as [`AiLabel`](./AiLabel) but neutral:
 * the AI gradient stays reserved for AI surfaces.
 */
export function Abbr({ term, short, full, variant = "underline", size = "sm" }: AbbrProps) {
  const entry = term ? MEDICAL_ABBR[term] : undefined;
  const shortText = short ?? entry?.short ?? "";
  const fullText = full ?? entry?.full ?? shortText;

  return (
    <Tooltip label={fullText} withArrow position="top" openDelay={150}>
      <Box
        component="abbr"
        // Native title gives the accessible expansion (screen readers + no-JS).
        title={fullText}
        className={`${styles.abbr} ${styles[variant]} ${styles[size]}`}
      >
        {shortText}
      </Box>
    </Tooltip>
  );
}
Abbr.displayName = "Abbr";
