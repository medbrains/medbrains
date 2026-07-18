// IPD BedTurnaroundView — split from ipd.tsx (pure move).

import { Card, Group, Text } from "@mantine/core";
import type { BedTurnaroundLog } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Badge, Table } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";

export function BedTurnaroundView() {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-bed-turnaround-recent"],
    queryFn: () => ipdService.listBedTurnaround(),
  });

  const rows = (data ?? []) as BedTurnaroundLog[];
  const avgTat =
    rows.length > 0
      ? Math.round(
          rows
            .filter((r) => r.turnaround_minutes != null)
            .reduce((sum, r) => sum + (r.turnaround_minutes ?? 0), 0) /
            Math.max(rows.filter((r) => r.turnaround_minutes != null).length, 1),
        )
      : 0;

  return (
    <Card withBorder p="sm">
      <Group justify="space-between" mb="xs">
        <Text fw={600}>Bed Turnaround Log</Text>
        {avgTat > 0 && (
          <Badge size="lg" tone="primary">
            Avg TAT: {avgTat} min
          </Badge>
        )}
      </Group>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Bed</Table.Th>
              <Table.Th>Vacated</Table.Th>
              <Table.Th>Cleaning Started</Table.Th>
              <Table.Th>Completed</Table.Th>
              <Table.Th>TAT (min)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.slice(0, 20).map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>
                  <Text size="sm">{r.bed_id.slice(0, 8)}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">
                    {r.vacated_at ? new Date(r.vacated_at).toLocaleString() : "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">
                    {r.cleaning_started_at ? new Date(r.cleaning_started_at).toLocaleString() : "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">
                    {r.cleaning_completed_at
                      ? new Date(r.cleaning_completed_at).toLocaleString()
                      : "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {r.turnaround_minutes != null ? (
                    <Badge tone={r.turnaround_minutes <= 60 ? "success" : "warning"} size="sm">
                      {r.turnaround_minutes}
                    </Badge>
                  ) : (
                    <Badge tone="warning" size="sm">
                      In progress
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No turnaround records.
        </Text>
      )}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
//  Phase 3b — Restraint Checks Summary (inline)
// ══════════════════════════════════════════════════════════
