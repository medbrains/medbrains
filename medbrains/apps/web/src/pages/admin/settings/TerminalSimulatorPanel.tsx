/**
 * Test hospitals only: stand at a simulated card machine. Each sale sent to
 * a simulator terminal waits here until someone says what the card did —
 * approved, declined, timed out, the machine dropping offline, or only part
 * of the amount approved — and a simulated machine can be unplugged.
 */
import { Group, Stack, Text } from "@mantine/core";
import type { PaymentTerminal } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Table, toast } from "@/components/ui";
import { paymentsService } from "@/services/payments.service";
import { TERMINALS_KEY } from "./PaymentTerminalModal";
import { SIM_SALES_KEY, SimulatedSaleRow } from "./SimulatedSaleRow";

interface TerminalSimulatorPanelProps {
  terminals: PaymentTerminal[];
}

export function TerminalSimulatorPanel({ terminals }: TerminalSimulatorPanelProps) {
  const queryClient = useQueryClient();
  const salesQuery = useQuery({
    queryKey: SIM_SALES_KEY,
    queryFn: paymentsService.listSimulatedSales,
    refetchInterval: 2_000,
  });
  const power = useMutation({
    mutationFn: (v: { id: string; on: boolean }) =>
      paymentsService.powerSimulatedTerminal(v.id, v.on),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: TERMINALS_KEY }),
    onError: (e: Error) => toast.error(e.message),
  });
  const simulated = terminals.filter((t) => t.provider === "simulator" && !t.retired_at);
  const sales = salesQuery.data ?? [];

  return (
    <Card withBorder data-testid="terminal-simulator">
      <Stack gap="sm">
        <Text fw={600}>Card machine simulator (test only)</Text>
        <Text size="sm" c="dimmed">
          You are the patient at the machine: say what the card does.
        </Text>
        {simulated.length > 0 && (
          <Group gap="xs">
            {simulated.map((t) => (
              <Button
                key={t.id}
                size="xs"
                tone="ghost"
                onClick={() => power.mutate({ id: t.id, on: t.status === "offline" })}
              >
                {t.status === "offline" ? `Plug in ${t.label}` : `Unplug ${t.label}`}
              </Button>
            ))}
          </Group>
        )}
        {salesQuery.isError ? (
          <Alert tone="danger">The simulator's sales could not be loaded.</Alert>
        ) : sales.length === 0 ? (
          <Text size="sm" c="dimmed">
            {salesQuery.isLoading ? "Loading…" : "No card waiting at a simulated machine."}
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Machine</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>The card…</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sales.map((s) => (
                <SimulatedSaleRow key={s.transaction_id} sale={s} />
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Card>
  );
}
