import { Box } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui";
import { BloodPressureInput } from "./BloodPressureInput";
import { bloodPressureLevel } from "./vital-grading";
import styles from "./vitals-recorder.module.scss";

interface VitalsBpCardProps {
  systolic: number | undefined;
  diastolic: number | undefined;
  onChange: (systolic: number | undefined, diastolic: number | undefined) => void;
  showErrors: boolean;
}

/** The blood-pressure card of the vitals recorder, flagging a hypertensive crisis. */
export function VitalsBpCard({ systolic, diastolic, onChange, showErrors }: VitalsBpCardProps) {
  const { t } = useTranslation("clinical");
  const level = bloodPressureLevel(systolic, diastolic);
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
            {t("vitals.hypertensiveCrisis", "Hypertensive crisis")}
          </Badge>
        )}
      </Box>
    </Box>
  );
}
