// IPD PrescriptionAuditTrail — split from pharmacy.tsx (pure move).

import { Badge, Table } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import { Text } from "@mantine/core";
import type { PrescriptionAuditEntry } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";

export function PrescriptionAuditTrail({ prescriptionId }: { prescriptionId: string }) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["prescription-audit", prescriptionId],
    queryFn: () => pharmacyService.prescriptionAudit(prescriptionId),
  });

  if (isLoading)
    return (
      <Text size="sm" c="dimmed">
        Loading audit trail...
      </Text>
    );
  if (entries.length === 0)
    return (
      <Text size="sm" c="dimmed">
        No audit entries found.
      </Text>
    );

  return (
    <Table striped>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Action</Table.Th>
          <Table.Th>Field</Table.Th>
          <Table.Th>Old Value</Table.Th>
          <Table.Th>New Value</Table.Th>
          <Table.Th>Changed By</Table.Th>
          <Table.Th>Time</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {(entries as PrescriptionAuditEntry[]).map((entry) => (
          <Table.Tr key={`${entry.changed_at}-${entry.action}-${entry.field_name}`}>
            <Table.Td>
              <Badge size="xs">{entry.action}</Badge>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{entry.field_name}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed">
                {entry.old_value ?? "—"}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{entry.new_value ?? "—"}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{entry.changed_by.slice(0, 8)}...</Text>
            </Table.Td>
            <Table.Td>
              <Text size="xs" c="dimmed">
                {new Date(entry.changed_at).toLocaleString()}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

// ── Drug Interaction Check Modal ──────────────────────────
