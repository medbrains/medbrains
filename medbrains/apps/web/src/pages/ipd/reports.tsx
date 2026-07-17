import { Card, Group, Progress, Stack, Text } from "@mantine/core";
import type { CensusWardRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Badge, Table } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";

export function CensusReport() {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-report-census"],
    queryFn: () => ipdService.reportCensus(),
  });

  const rows = (data ?? []) as CensusWardRow[];

  return (
    <Table striped>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Ward</Table.Th>
          <Table.Th>Total Beds</Table.Th>
          <Table.Th>Occupied</Table.Th>
          <Table.Th>Vacant</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {isLoading ? (
          <Table.Tr>
            <Table.Td colSpan={4}>
              <Text c="dimmed">Loading...</Text>
            </Table.Td>
          </Table.Tr>
        ) : (
          rows.map((r, i) => (
            <Table.Tr key={r.ward_id ?? `unassigned-${i}`}>
              <Table.Td>
                <Text size="sm">{r.ward_name ?? "Unassigned"}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.total_beds}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.occupied}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.vacant}</Text>
              </Table.Td>
            </Table.Tr>
          ))
        )}
      </Table.Tbody>
    </Table>
  );
}

export function OccupancyReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-report-occupancy", from, to],
    queryFn: () => ipdService.reportOccupancy({ from, to }),
    enabled: !!from && !!to,
  });

  if (!from || !to)
    return (
      <Text c="dimmed" size="sm">
        Select a date range to view occupancy.
      </Text>
    );

  const rows = (data ?? []) as Array<{
    ward_id: string | null;
    ward_name: string | null;
    total_beds: number;
    occupied_bed_days: number;
    total_bed_days: number;
    occupancy_pct: number;
  }>;

  return (
    <Stack>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : (
        rows.map((r, i) => (
          <Card key={r.ward_id ?? `unassigned-${i}`} withBorder p="sm">
            <Group justify="space-between" mb={4}>
              <Text size="sm" fw={500}>
                {r.ward_name ?? "Unassigned"}
              </Text>
              <Text size="sm" fw={700}>
                {r.occupancy_pct.toFixed(1)}%
              </Text>
            </Group>
            <Progress
              value={r.occupancy_pct}
              size="lg"
              color={r.occupancy_pct > 90 ? "danger" : r.occupancy_pct > 70 ? "warning" : "success"}
            />
            <Text size="xs" c="dimmed" mt={4}>
              {r.occupied_bed_days} bed-days / {r.total_bed_days} total
            </Text>
          </Card>
        ))
      )}
    </Stack>
  );
}

export function AlosReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-report-alos", from, to],
    queryFn: () => ipdService.reportAlos({ from, to }),
    enabled: !!from && !!to,
  });

  if (!from || !to)
    return (
      <Text c="dimmed" size="sm">
        Select a date range to view ALOS.
      </Text>
    );

  const rows = (data ?? []) as Array<{
    department_name: string | null;
    discharge_type: string;
    avg_los_days: number;
    count: number;
  }>;

  return (
    <Table striped>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Department</Table.Th>
          <Table.Th>Discharge Type</Table.Th>
          <Table.Th>Avg LOS (days)</Table.Th>
          <Table.Th>Count</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {isLoading ? (
          <Table.Tr>
            <Table.Td colSpan={4}>
              <Text c="dimmed">Loading...</Text>
            </Table.Td>
          </Table.Tr>
        ) : (
          rows.map((r) => (
            <Table.Tr
              key={`${r.department_name ?? "unknown"}-${r.discharge_type}-${r.count}-${r.avg_los_days}`}
            >
              <Table.Td>
                <Text size="sm">{r.department_name ?? "—"}</Text>
              </Table.Td>
              <Table.Td>
                <Badge size="sm">{r.discharge_type}</Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {r.avg_los_days.toFixed(1)}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.count}</Text>
              </Table.Td>
            </Table.Tr>
          ))
        )}
      </Table.Tbody>
    </Table>
  );
}
