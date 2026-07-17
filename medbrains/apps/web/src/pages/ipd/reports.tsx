import { Card, Group, Progress, Stack, Text } from "@mantine/core";
import type { CensusWardRow, SurgeonCaseloadEntry } from "@medbrains/types";
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

export function DischargeStatsReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-report-discharge-stats", from, to],
    queryFn: () => ipdService.reportDischargeStats({ from, to }),
    enabled: !!from && !!to,
  });

  if (!from || !to)
    return (
      <Text c="dimmed" size="sm">
        Select a date range to view discharge statistics.
      </Text>
    );

  const rows = (data ?? []) as Array<{ discharge_type: string; count: number }>;
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <Stack>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : (
        rows.map((r) => (
          <Group
            key={r.discharge_type}
            justify="space-between"
            p="xs"
            style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 0 }}
          >
            <Group>
              <Badge size="lg">{r.discharge_type}</Badge>
              <Text size="sm">{r.count} discharges</Text>
            </Group>
            <Text size="sm" c="dimmed">
              {total > 0 ? ((r.count / total) * 100).toFixed(1) : 0}%
            </Text>
          </Group>
        ))
      )}
      {rows.length === 0 && (
        <Text c="dimmed" size="sm">
          No discharges in this period.
        </Text>
      )}
    </Stack>
  );
}

export function SurgeonCaseloadReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ot-surgeon-caseload", from, to],
    queryFn: () => ipdService.getSurgeonCaseload({ from: from || undefined, to: to || undefined }),
  });

  const rows = (data ?? []) as SurgeonCaseloadEntry[];

  return (
    <Stack>
      <Text fw={500}>Surgeon Caseload Analysis</Text>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">
          No OT case records in this period.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Surgeon</Table.Th>
              <Table.Th>Total Cases</Table.Th>
              <Table.Th>Avg Duration (min)</Table.Th>
              <Table.Th>Complications</Table.Th>
              <Table.Th>Cancellations</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.surgeon_id}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {r.surgeon_name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.total_cases}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {r.avg_duration_minutes != null ? Math.round(r.avg_duration_minutes) : "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {r.complication_count > 0 ? (
                    <Badge tone="danger" size="sm">
                      {r.complication_count}
                    </Badge>
                  ) : (
                    <Badge tone="success" size="sm">
                      0
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  {r.cancellation_count > 0 ? (
                    <Badge tone="warning" size="sm">
                      {r.cancellation_count}
                    </Badge>
                  ) : (
                    <Text size="sm">0</Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
