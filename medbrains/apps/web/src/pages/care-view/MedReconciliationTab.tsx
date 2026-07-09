import { Stack, Text } from "@mantine/core";
import { useState } from "react";
import { MedReconciliationPanel } from "@/components/MedReconciliationPanel";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";

/** Medication reconciliation (IPSG.6) for a selected patient. */
export function MedReconciliationTab() {
  const [patientId, setPatientId] = useState("");
  return (
    <Stack gap="md" maw={840}>
      <PatientSearchSelect value={patientId} onChange={setPatientId} />
      {patientId ? (
        <MedReconciliationPanel patientId={patientId} />
      ) : (
        <Text size="sm" c="dimmed">
          Select a patient to reconcile medications at admission, transfer, or discharge.
        </Text>
      )}
    </Stack>
  );
}
