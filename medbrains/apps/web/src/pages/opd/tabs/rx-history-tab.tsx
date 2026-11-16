import { Card, Group, Stack, Text } from "@mantine/core";
import type { PrescriptionHistoryItem } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Badge, Table } from "@/components/ui";
import { opdService } from "@/services/opd.service";
import { LoadFailed } from "./load-failed";

const WHAT = "Prescription history";

/**
 * The patient's earlier prescriptions, newest first as the server sends them, so the doctor
 * prescribing today sees what was given before. A failed read is shown as a fault, never as
 * "no previous prescriptions", which would be a false statement about the patient.
 */
export function RxHistoryTab({ patientId }: { patientId: string }) {
  const {
    data = [],
    isLoading,
    error,
    isLoadingError,
    isRefetchError,
    refetch,
  } = useQuery({
    queryKey: ["patient-prescriptions", patientId],
    queryFn: () => opdService.listPatientPrescriptions(patientId),
  });

  if (isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading prescription history...
      </Text>
    );
  }
  if (isLoadingError) {
    return <LoadFailed what={WHAT} error={error} onRetry={refetch} />;
  }
  const history = data as PrescriptionHistoryItem[];
  return (
    <Stack gap="sm">
      {isRefetchError && <LoadFailed what={WHAT} error={error} onRetry={refetch} stale />}
      {history.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No previous prescriptions found for this patient.
        </Text>
      ) : (
        history.map((h) => <PrescriptionCard key={h.prescription.id} item={h} />)
      )}
    </Stack>
  );
}

/** One earlier prescription: when, by whom, and each drug with its dose and duration. */
function PrescriptionCard({ item }: { item: PrescriptionHistoryItem }) {
  return (
    <Card padding="sm" withBorder>
      <Group gap={8} mb="xs">
        <Badge size="xs">{new Date(item.encounter_date).toLocaleDateString()}</Badge>
        {item.doctor_name && (
          <Text size="xs" c="dimmed">
            Dr. {item.doctor_name}
          </Text>
        )}
        {item.prescription.notes && (
          <Text size="xs" c="dimmed" fs="italic">
            — {item.prescription.notes}
          </Text>
        )}
      </Group>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Drug</Table.Th>
            <Table.Th>Dosage</Table.Th>
            <Table.Th>Freq</Table.Th>
            <Table.Th>Duration</Table.Th>
            <Table.Th>Route</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {item.items.map((line) => (
            <Table.Tr key={line.id}>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {line.drug_name}
                </Text>
              </Table.Td>
              <Table.Td>{line.dosage}</Table.Td>
              <Table.Td>
                <Badge size="xs">{line.frequency}</Badge>
              </Table.Td>
              <Table.Td>{line.duration}</Table.Td>
              <Table.Td>{line.route ?? "—"}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}
