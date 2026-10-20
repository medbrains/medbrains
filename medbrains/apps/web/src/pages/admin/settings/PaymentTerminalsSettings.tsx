/**
 * The payment devices at each counter: card machines (by the provider's
 * cloud or wired to the counter PC through the site bridge), QR and online
 * checkout — which counter each sits at, whether it answers, and retiring
 * one that is replaced.
 */
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { PaymentTerminal } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconDeviceMobile, IconPencil, IconPlugConnected, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { machineStatusLabel } from "@/components/payments/cardSale";
import { Alert, Badge, type BadgeTone, Button, IconButton, Table, toast } from "@/components/ui";
import { paymentsService } from "@/services/payments.service";
import { PaymentTerminalModal, TERMINALS_KEY } from "./PaymentTerminalModal";
import { TerminalSimulatorPanel } from "./TerminalSimulatorPanel";

const STATUS_TONE: Record<PaymentTerminal["status"], BadgeTone> = {
  online: "success",
  offline: "danger",
  unknown: "neutral",
};

const KIND_LABEL: Record<string, string> = {
  pos: "Card machine",
  qr: "Dynamic QR",
  online: "Online checkout",
};

function seen(t: PaymentTerminal): string {
  return t.last_seen_at ? `Last answered ${new Date(t.last_seen_at).toLocaleString("en-IN")}` : "";
}

function reachedThrough(t: PaymentTerminal): string {
  if (t.connection !== "bridge") return t.provider;
  const where = t.device_address ? ` · ${t.device_address}` : "";
  return `Counter PC (${t.adapter ?? "no adapter"}${where})`;
}

export function PaymentTerminalsSettings() {
  const canManage = useHasPermission(P.BILLING.TERMINALS_MANAGE);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<PaymentTerminal | "new" | null>(null);

  const terminalsQuery = useQuery({
    queryKey: TERMINALS_KEY,
    queryFn: () => paymentsService.listPaymentTerminals(),
    enabled: canManage,
  });
  const providersQuery = useQuery({
    queryKey: ["terminal-providers"],
    queryFn: paymentsService.listTerminalProviders,
    enabled: canManage,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: TERMINALS_KEY });

  const ping = useMutation({
    mutationFn: paymentsService.pingPaymentTerminal,
    onSuccess: (t) => {
      void refresh();
      if (t.status === "online") toast.success(`${t.label} answered.`);
      else toast.error(`${t.label} did not answer: ${t.last_error ?? "no reason given"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const retire = useMutation({
    mutationFn: paymentsService.retirePaymentTerminal,
    onSuccess: (t) => {
      void refresh();
      toast.success(`${t.label} retired — it takes no more payments.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canManage) {
    return (
      <Alert tone="warning">
        Managing card machines needs the "Manage card machines" permission.
      </Alert>
    );
  }
  if (terminalsQuery.isLoading) return <Text c="dimmed">Loading payment devices…</Text>;
  if (terminalsQuery.isError) {
    return (
      <Alert tone="danger" title="Payment devices could not be loaded">
        {terminalsQuery.error.message}
      </Alert>
    );
  }
  const terminals = terminalsQuery.data ?? [];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Text fw={600} size="lg">
            Payment devices
          </Text>
          <Text size="sm" c="dimmed">
            A cashier's card payments go to the machine at the counter they work at.
          </Text>
        </Stack>
        <Button
          tone="primary"
          leftSection={<IconPlus size={16} />}
          onClick={() => setEditing("new")}
        >
          Add device
        </Button>
      </Group>

      {terminals.length === 0 ? (
        <Stack align="center" py="xl" gap="xs">
          <IconDeviceMobile size={32} aria-hidden />
          <Text c="dimmed">No payment devices yet.</Text>
        </Stack>
      ) : (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Device</Table.Th>
              <Table.Th>Counter</Table.Th>
              <Table.Th>Reached through</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {terminals.map((t) => (
              <Table.Tr key={t.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {t.label}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {KIND_LABEL[t.kind] ?? t.kind} · {t.mode === "live" ? "Live" : "Sandbox"}
                  </Text>
                </Table.Td>
                <Table.Td>{t.station_name ?? "No counter"}</Table.Td>
                <Table.Td>{reachedThrough(t)}</Table.Td>
                <Table.Td>
                  {t.retired_at ? (
                    <Badge tone="neutral">Retired</Badge>
                  ) : (
                    <Stack gap={2}>
                      <Badge tone={STATUS_TONE[t.status]}>{machineStatusLabel(t)}</Badge>
                      <Text size="xs" c="dimmed">
                        {seen(t)}
                      </Text>
                    </Stack>
                  )}
                </Table.Td>
                <Table.Td>
                  {!t.retired_at && (
                    <Group gap="xs" wrap="nowrap">
                      {t.kind === "pos" && (
                        <Button
                          tone="tertiary"
                          size="xs"
                          aria-label={`Test ${t.label}`}
                          leftSection={<IconPlugConnected size={14} />}
                          loading={ping.isPending && ping.variables === t.id}
                          onClick={() => ping.mutate(t.id)}
                        >
                          Test
                        </Button>
                      )}
                      <IconButton
                        tone="primary"
                        size="sm"
                        aria-label={`Change ${t.label}`}
                        onClick={() => setEditing(t)}
                      >
                        <IconPencil size={16} />
                      </IconButton>
                      <Button
                        tone="danger-ghost"
                        size="xs"
                        aria-label={`Retire ${t.label}`}
                        onClick={() => retire.mutate(t.id)}
                      >
                        Retire
                      </Button>
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {providersQuery.data?.simulator_enabled && <TerminalSimulatorPanel terminals={terminals} />}

      {editing && (
        <PaymentTerminalModal
          terminal={editing === "new" ? undefined : editing}
          providers={providersQuery.data}
          onClose={() => setEditing(null)}
        />
      )}
    </Stack>
  );
}
