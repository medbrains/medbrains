import { Stack, Text } from "@mantine/core";
import type { CampRegistration, CreateVitalRequest } from "@medbrains/types";
import { useTranslation } from "react-i18next";
import { VitalsRecorder } from "@/components/Clinical/VitalsRecorder";

interface CampScreeningVitalsProps {
  /** The participant being screened, whose age grades their vitals. */
  participant: CampRegistration | undefined;
  onChange: (vitals: CreateVitalRequest) => void;
}

/**
 * The vitals block of a camp screening. The participant's recorded age
 * grades pulse, breathing and blood pressure for their age; their patient
 * record's date of birth is used when the registration has no age.
 */
export function CampScreeningVitals({ participant, onChange }: CampScreeningVitalsProps) {
  const { t } = useTranslation("camp");
  return (
    <Stack gap="xs">
      <Text fw={600} size="sm">
        {t("screenings.form.vitals")}
      </Text>
      <VitalsRecorder
        onChange={onChange}
        showActions={false}
        showNotes={false}
        patientId={participant?.patient_id}
        ageYears={participant?.age}
      />
    </Stack>
  );
}
