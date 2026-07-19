// OT shared helpers — split from ot.tsx (pure move).

import { Text } from "@mantine/core";
import { PatientNameCell } from "@/components/PatientNameCell";

export const bookingStatusColors: Record<string, string> = {
  requested: "warning",
  confirmed: "primary",
  in_progress: "success",
  completed: "teal",
  cancelled: "danger",
  postponed: "orange",
};

function OtRestrictedValue() {
  return (
    <Text span size="sm" c="dimmed">
      Restricted
    </Text>
  );
}

export function OtPatientCell({
  patientId,
  canViewPatientRecord,
}: {
  patientId: string;
  canViewPatientRecord: boolean;
}) {
  if (!canViewPatientRecord) return <OtRestrictedValue />;
  return <PatientNameCell patientId={patientId} showUhid={false} />;
}
