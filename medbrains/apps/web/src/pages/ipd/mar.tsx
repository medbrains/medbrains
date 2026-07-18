// IPD MarTab — split from ipd.tsx (pure move).

import { Badge, Table } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import { Group, Stack, Text, Tooltip } from "@mantine/core";
import type { IpdMedicationAdministration } from "@medbrains/types";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

export function MarTab({ admissionId }: { admissionId: string }) {
  const { data } = useQuery({
    queryKey: ["ipd-mar", admissionId],
    queryFn: () => ipdService.listMar(admissionId),
  });

  const marStatusColors: Record<string, BadgeTone> = {
    scheduled: "primary",
    given: "success",
    held: "warning",
    refused: "warning",
    missed: "danger",
    self_administered: "success",
  };

  const rows = (data ?? []) as IpdMedicationAdministration[];

  return (
    <Stack>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Drug</Table.Th>
            <Table.Th>Dose</Table.Th>
            <Table.Th>Route</Table.Th>
            <Table.Th>Scheduled</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Double-Check</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((m) => (
            <Table.Tr key={m.id} bg={m.is_high_alert ? "red.0" : undefined}>
              <Table.Td>
                <Group gap={4}>
                  <Text size="sm" fw={500}>
                    {m.drug_name}
                  </Text>
                  {m.is_high_alert && (
                    <Tooltip label="High-Alert Medication — requires double-check">
                      <Badge tone="danger" size="xs" leftSection={<IconAlertTriangle size={10} />}>
                        HIGH ALERT
                      </Badge>
                    </Tooltip>
                  )}
                </Group>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{m.dose}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{m.route}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="xs">{new Date(m.scheduled_at).toLocaleString()}</Text>
              </Table.Td>
              <Table.Td>
                <Badge tone={marStatusColors[m.status] ?? "neutral"} size="sm">
                  {m.status}
                </Badge>
                {m.is_high_alert && m.status === "given" && !m.double_checked_by && (
                  <Badge tone="warning" size="xs" ml={4}>
                    Needs witness
                  </Badge>
                )}
              </Table.Td>
              <Table.Td>
                {m.double_checked_by ? (
                  <Badge tone="success" size="xs">
                    Verified
                  </Badge>
                ) : m.is_high_alert ? (
                  <Badge tone="neutral" size="xs">
                    Pending
                  </Badge>
                ) : null}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {rows.length === 0 && (
        <Text c="dimmed" size="sm">
          No medication records yet.
        </Text>
      )}
    </Stack>
  );
}

// ── Admission Prescriptions ──────────────────────────────
