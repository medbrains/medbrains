/**
 * The page a pharmacist lands on after scanning a prescription QR.
 *
 * Read at a counter, on a phone, with a patient waiting — so it answers the
 * question in the first line and puts the medicines directly under it. The
 * medicines are the point: forgery is usually a real script with a quantity or
 * a drug altered, so a page that says only "genuine" cannot catch the common
 * case. The pharmacist compares this list against the paper.
 *
 * A missing or expired token gives the same answer as an unknown one. Telling
 * them apart would confirm that a token once existed.
 */

import { Alert, Group, Stack, Table, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { Badge, Card } from "@/components/ui";
import { opdService } from "@/services/opd.service";

export function VerifyPrescriptionPage() {
  const { token } = useParams<{ token: string }>();

  const {
    data: prescription,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["verify-prescription", token],
    queryFn: () => opdService.verifyPrescription(token ?? ""),
    enabled: Boolean(token),
    retry: false,
  });

  if (isLoading) {
    return (
      <Stack p="xl" align="center">
        <Text>Checking this prescription…</Text>
      </Stack>
    );
  }

  if (isError || !prescription) {
    return (
      <Stack p="xl" gap="md" maw={640} mx="auto">
        <Title order={2}>This prescription could not be verified</Title>
        <Alert color="red" title="No match">
          The code on this prescription is not one this hospital issued, or it is no longer valid.
          Do not dispense against it without contacting the hospital directly.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack p="xl" gap="md" maw={720} mx="auto">
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Title order={2}>Issued by {prescription.hospital_name}</Title>
          <Text size="sm" c="dimmed">
            Prescribed by {prescription.doctor_name}
            {prescription.doctor_registration ? ` · Reg ${prescription.doctor_registration}` : ""}{" "}
            on {new Date(prescription.issued_on).toLocaleDateString()}
          </Text>
        </Stack>
        <Badge tone="success">Genuine</Badge>
      </Group>

      <Card withBorder padding="md">
        <Text size="sm" c="dimmed">
          Patient
        </Text>
        <Text fw={600}>
          {prescription.patient_initials} · UHID ending {prescription.uhid_suffix}
        </Text>
        <Text size="xs" c="dimmed" mt={4}>
          Check these match the paper in front of you. Full patient details are not shown here.
        </Text>
      </Card>

      <Stack gap="xs">
        <Text fw={700}>What was prescribed</Text>
        <Text size="sm" c="dimmed">
          If the paper differs from this list in any way — a different drug, a different quantity,
          an extra line — do not dispense it.
        </Text>
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Medicine</Table.Th>
              <Table.Th>Dose</Table.Th>
              <Table.Th>How often</Table.Th>
              <Table.Th>For</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {prescription.medications.map((medication) => (
              <Table.Tr key={`${medication.drug_name}-${medication.dosage}`}>
                <Table.Td>{medication.drug_name}</Table.Td>
                <Table.Td>{medication.dosage}</Table.Td>
                <Table.Td>{medication.frequency}</Table.Td>
                <Table.Td>{medication.duration}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {prescription.medications.length === 0 && (
          <Alert color="yellow" title="No medicines recorded">
            This encounter is genuine but has no prescribed items against it. A paper listing
            medicines does not match this record.
          </Alert>
        )}
      </Stack>

      {prescription.previous_checks > 3 && (
        <Alert color="yellow" title="Checked before">
          This prescription has been verified {prescription.previous_checks} times already. That is
          normal for a repeat dispense, and worth a second look if it is not.
        </Alert>
      )}
    </Stack>
  );
}
