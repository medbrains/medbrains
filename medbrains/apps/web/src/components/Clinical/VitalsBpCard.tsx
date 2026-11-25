import { Box } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui";
import { ADULT_FROM_YEARS } from "@/lib/paediatric-vital-bands";
import { BloodPressureInput } from "./BloodPressureInput";
import { bloodPressureLevel } from "./vital-grading";
import styles from "./vitals-recorder.module.scss";

interface VitalsBpCardProps {
  systolic: number | undefined;
  diastolic: number | undefined;
  onChange: (systolic: number | undefined, diastolic: number | undefined) => void;
  showErrors: boolean;
  /** Completed years; `null` when no age is on record. */
  ageYears: number | null;
}

/**
 * The blood-pressure card of the vitals recorder, graded for the patient's
 * age: an adult's hypertensive crisis, a child's systolic against the
 * paediatric chart, or "age needed" when there is no age to grade by.
 */
export function VitalsBpCard({
  systolic,
  diastolic,
  onChange,
  showErrors,
  ageYears,
}: VitalsBpCardProps) {
  const { t } = useTranslation("clinical");
  const level = bloodPressureLevel(systolic, diastolic, ageYears);
  const isChild = ageYears !== null && ageYears < ADULT_FROM_YEARS;
  return (
    <Box className={`${styles.vitalCard} ${styles.bpCard}`} data-level={level}>
      <BloodPressureInput
        label={t("vitals.bloodPressure", "Blood pressure")}
        value={{ systolic, diastolic }}
        onChange={(bp) => onChange(bp.systolic, bp.diastolic)}
        showErrors={showErrors}
      />
      <Box role="status" aria-live="polite">
        {level === "critical" && (
          <Badge size="xs" tone="danger" mt={4}>
            {isChild
              ? t("vitals.systolicCritical", "Systolic critical for age")
              : t("vitals.hypertensiveCrisis", "Hypertensive crisis")}
          </Badge>
        )}
        {ageYears === null && systolic !== undefined && (
          <Badge size="xs" tone="neutral" mt={4}>
            {t("vitals.ageNeeded", "age needed to grade")}
          </Badge>
        )}
      </Box>
    </Box>
  );
}
