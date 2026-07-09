import { Stack, Text } from "@mantine/core";
import { useState } from "react";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { SepsisBundlePanel } from "@/components/SepsisBundlePanel";

/** Surviving Sepsis Hour-1 bundle tracker for a selected patient. */
export function SepsisBundleTab() {
  const [patientId, setPatientId] = useState("");
  return (
    <Stack gap="md" maw={720}>
      <PatientSearchSelect value={patientId} onChange={setPatientId} />
      {patientId ? (
        <SepsisBundlePanel patientId={patientId} />
      ) : (
        <Text size="sm" c="dimmed">
          Select a patient to record the Surviving Sepsis Hour-1 bundle.
        </Text>
      )}
    </Stack>
  );
}
