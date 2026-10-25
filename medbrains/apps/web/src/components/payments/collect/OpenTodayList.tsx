/**
 * The counter's list before a patient is chosen: everyone with an open bill
 * charged today, newest first. Picking a row opens that patient's dues.
 */

import { Stack, Text, Title, VisuallyHidden } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Table } from "@/components/ui";
import { formatTime } from "@/lib/date-utils";
import { billingService } from "@/services/billing.service";
import { rupees } from "./collect-math";
import { useCanCollect } from "./use-dues";

interface OpenTodayListProps {
  onPick: (patientId: string) => void;
}

export function OpenTodayList({ onPick }: OpenTodayListProps) {
  const canCollect = useCanCollect();
  const query = useQuery({
    queryKey: ["counter-open-today"],
    queryFn: () => billingService.listCounterOpenToday(),
    enabled: canCollect,
    refetchInterval: 60_000,
  });
  if (!canCollect) return null;
  const rows = query.data ?? [];

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Title order={6}>Open bills today</Title>
        {query.isError && (
          <Alert tone="danger" title="Today's open bills could not be read">
            {query.error.message}
          </Alert>
        )}
        {query.isLoading && <Text c="dimmed">Loading…</Text>}
        {query.data && rows.length === 0 && (
          <Text c="dimmed" size="sm">
            No bills are waiting today. Search a patient above to start one.
          </Text>
        )}
        {rows.length > 0 && (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Patient</Table.Th>
                <Table.Th>UHID</Table.Th>
                <Table.Th>Bills</Table.Th>
                <Table.Th>Balance</Table.Th>
                <Table.Th>Last charge</Table.Th>
                <Table.Th>
                  <VisuallyHidden>Action</VisuallyHidden>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.patient_id} data-testid="row-counter-open-today">
                  <Table.Td>{row.patient_name ?? "—"}</Table.Td>
                  <Table.Td ff="monospace">{row.uhid}</Table.Td>
                  <Table.Td>{row.bill_count}</Table.Td>
                  <Table.Td ff="monospace">{rupees(Number(row.balance))}</Table.Td>
                  <Table.Td>{formatTime(row.last_charged_at)}</Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      tone="secondary"
                      onClick={() => onPick(row.patient_id)}
                      aria-label={`Open bills for ${row.patient_name ?? row.uhid}`}
                    >
                      Open
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Card>
  );
}
