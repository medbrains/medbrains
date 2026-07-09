import { Card, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { VteAssessmentPanel } from "@/components/VteAssessmentPanel";

/** VTE (Padua) risk assessment for a selected patient. */
export function VteTab() {
  const [patientId, setPatientId] = useState("");
  return (
    <Stack gap="md">
      <PatientSearchSelect value={patientId} onChange={setPatientId} />
      {patientId ? (
        <Card withBorder padding="md">
          <VteAssessmentPanel patientId={patientId} />
        </Card>
      ) : (
        <Text size="sm" c="dimmed">
          Select a patient to assess VTE (venous thromboembolism) risk.
        </Text>
      )}
    </Stack>
  );
}
