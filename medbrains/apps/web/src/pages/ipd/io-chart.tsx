// IPD IoChartTab — split from ipd.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { IpdIntakeOutput } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Badge, Table } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";

export function IoChartTab({ admissionId }: { admissionId: string }) {
  // The intake/output chart and its running balance are `ipd.io_chart.list`.
  // Ungated, an empty chart reads as "nothing in, nothing out" — which on a
  // fluid balance is a number somebody prescribes against.
  const canListIoChart = useHasPermission(P.IPD.IO_CHART_LIST);

  const { data: ioData } = useQuery({
    queryKey: ["ipd-io", admissionId],
    queryFn: () => ipdService.listIntakeOutput(admissionId),
    enabled: canListIoChart,
  });
  const { data: balance } = useQuery({
    queryKey: ["ipd-io-balance", admissionId],
    queryFn: () => ipdService.getIoBalance(admissionId),
    enabled: canListIoChart,
  });

  const rows = (ioData ?? []) as IpdIntakeOutput[];

  return (
    <Stack>
      {balance && (
        <Group gap="lg">
          <Badge tone="primary" size="lg">
            Intake: {balance.total_intake_ml} ml
          </Badge>
          <Badge tone="warning" size="lg">
            Output: {balance.total_output_ml} ml
          </Badge>
          <Badge tone={Number(balance.balance_ml) >= 0 ? "success" : "danger"} size="lg">
            Balance: {balance.balance_ml} ml
          </Badge>
        </Group>
      )}
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Type</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th>Volume (ml)</Table.Th>
            <Table.Th>Shift</Table.Th>
            <Table.Th>Time</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td>
                <Badge tone={r.is_intake ? "primary" : "warning"} size="sm">
                  {r.is_intake ? "Intake" : "Output"}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.category}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.volume_ml}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.shift}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="xs">{new Date(r.recorded_at).toLocaleString()}</Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {rows.length === 0 && (
        <Text c="dimmed" size="sm">
          No intake/output records yet.
        </Text>
      )}
    </Stack>
  );
}

// ── Nursing Tab (care plans + handovers) ───────────────
