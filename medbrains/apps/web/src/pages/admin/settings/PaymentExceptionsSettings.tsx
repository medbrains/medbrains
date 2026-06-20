import { Group, Loader, SegmentedControl, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { PaymentWebhookException } from "@medbrains/types";
import { IconCheck, IconShieldCheck, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Table } from "@/components/ui";
import { paymentsService } from "@/services/payments.service";

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
