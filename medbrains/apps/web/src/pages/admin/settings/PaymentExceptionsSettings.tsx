import { Card, Group, Loader, SegmentedControl, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { PaymentWebhookException } from "@medbrains/types";
import { IconCheck, IconShieldCheck, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Table } from "@/components/ui";
import { paymentsService } from "@/services/payments.service";

const TILE_COLOR: Record<string, string> = {
  success: "green",
  warning: "orange",
  danger: "red",
  info: "blue",
};

function ReconTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card withBorder padding="sm" radius="md">
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text fw={700} size="lg" ff="monospace" c={TILE_COLOR[tone]}>
        {value}
      </Text>
    </Card>
  );
}

const STATUS_FILTERS = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "ignored", label: "Ignored" },
] as const;

function reasonTone(reason: string): "danger" | "warning" | "neutral" {
  if (reason === "signature_failed") return "danger";
  if (reason === "amount_mismatch") return "warning";
  return "neutral";
}

export function PaymentExceptionsSettings() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>("open");

  const key = ["payment-exceptions", status] as const;
  const {
    data: exceptions,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: key,
    queryFn: () => paymentsService.listPaymentExceptions({ status }),
  });

  const { data: recon } = useQuery({
    queryKey: ["payment-recon-summary"],
    queryFn: () => paymentsService.getReconSummary(),
    staleTime: 60_000,
  });

  const reconAmount = (statuses: string[]) =>
    (recon?.by_status ?? [])
      .filter((row) => statuses.includes(row.status))
      .reduce((sum, row) => sum + Number(row.total_amount), 0);
  const settled = reconAmount(["captured"]);
  const pending = reconAmount(["pending_gateway", "created"]);
  const failed = reconAmount(["failed"]);
  const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;

  const resolveMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: "resolved" | "ignored" }) =>
      paymentsService.resolvePaymentException(id, { status: next }),
    onSuccess: (_data, { next }) => {
      void queryClient.invalidateQueries({ queryKey: ["payment-exceptions"] });
      notifications.show({
        title: next === "resolved" ? "Marked resolved" : "Ignored",
        message: "Exception updated.",
        color: "success",
      });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Update failed", message: err.message, color: "danger" }),
  });

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading payment exceptions…</Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="danger">
          Failed to load exceptions: {error instanceof Error ? error.message : "Unknown error"}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Text fw={600} size="lg">
            Payment Reconciliation Exceptions
          </Text>
          <Text size="sm" c="dimmed">
            Inbound gateway credits that couldn't be matched to a bill — review and resolve so no
            payment is lost.
          </Text>
        </div>
        <SegmentedControl
          value={status}
          onChange={setStatus}
          data={STATUS_FILTERS.map((s) => ({ value: s.value, label: s.label }))}
        />
      </Group>

      {recon && (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <ReconTile label="Settled" value={money(settled)} tone="success" />
          <ReconTile label="Pending" value={money(pending)} tone="warning" />
          <ReconTile label="Failed" value={money(failed)} tone="danger" />
          <ReconTile label="Open exceptions" value={String(recon.open_exceptions)} tone="info" />
        </SimpleGrid>
      )}

      {exceptions && exceptions.length > 0 ? (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>When</Table.Th>
              <Table.Th>Provider</Table.Th>
              <Table.Th>Order ref</Table.Th>
              <Table.Th>Reason</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th w={160}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {exceptions.map((exc: PaymentWebhookException) => (
              <Table.Tr key={exc.id}>
                <Table.Td>
                  <Text size="xs" ff="monospace">
                    {new Date(exc.created_at).toLocaleString("en-IN")}
                  </Text>
                </Table.Td>
                <Table.Td>{exc.provider}</Table.Td>
                <Table.Td>
                  <Text size="xs" ff="monospace">
                    {exc.order_ref ?? "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge tone={reasonTone(exc.reason)} size="sm">
                    {exc.reason}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge tone={exc.status === "open" ? "warning" : "neutral"} size="sm">
                    {exc.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {exc.status === "open" ? (
                    <Group gap="xs" wrap="nowrap">
                      <Button
                        tone="primary"
                        size="compact-xs"
                        leftSection={<IconCheck size={14} />}
                        loading={resolveMutation.isPending}
                        onClick={() => resolveMutation.mutate({ id: exc.id, next: "resolved" })}
                      >
                        Resolve
                      </Button>
                      <Button
                        tone="ghost"
                        size="compact-xs"
                        leftSection={<IconX size={14} />}
                        onClick={() => resolveMutation.mutate({ id: exc.id, next: "ignored" })}
                      >
                        Ignore
                      </Button>
                    </Group>
                  ) : (
                    <Text size="xs" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Stack align="center" py="xl" gap="xs">
          <IconShieldCheck size={32} color="var(--mb-success-accent, green)" />
          <Text c="dimmed">No {status} exceptions — all inbound credits reconciled.</Text>
        </Stack>
      )}
    </Stack>
  );
}
