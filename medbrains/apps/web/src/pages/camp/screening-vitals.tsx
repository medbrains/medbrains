import { Stack, Text } from "@mantine/core";
import type { CreateVitalRequest } from "@medbrains/types";
import { useTranslation } from "react-i18next";
import { VitalsRecorder } from "@/components/Clinical/VitalsRecorder";

interface CampScreeningVitalsProps {
  onChange: (vitals: CreateVitalRequest) => void;
}

/** The vitals block of a camp screening: the recorder without its own buttons or notes. */
export function CampScreeningVitals({ onChange }: CampScreeningVitalsProps) {
  const { t } = useTranslation("camp");
  return (
    <Stack gap="xs">
      <Text fw={600} size="sm">
        {t("screenings.form.vitals")}
      </Text>
      <VitalsRecorder onChange={onChange} showActions={false} showNotes={false} />
    </Stack>
  );
}
