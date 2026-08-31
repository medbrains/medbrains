/**
 * The collection counter — hand the bag over, or take it back.
 *
 * Two acts, and they are opposites. Collecting closes the order and the token.
 * Releasing is the one everybody forgets: an order nobody came for is off the
 * books and still on the shelf at the same time, and that is exactly the drift
 * a stock report cannot show you. Releasing puts the stock back where it came
 * from, and asks why.
 *
 * The name on each row is not decoration: it is what gets checked against what
 * the patient actually says before the bag changes hands.
 */

import { Group, Loader, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { FulfilmentQueueRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Table } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import { ReasonModal } from "./reason-modal";

export function DispatchPage() {
  const queryClient = useQueryClient();
  const canDispatch = useHasPermission(P.PHARMACY.FULFILMENT.DISPATCH);
  const canRelease = useHasPermission(P.PHARMACY.FULFILMENT.RELEASE);

  const [releasing, setReleasing] = useState<FulfilmentQueueRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pharmacy-fulfilment-queue"],
    queryFn: () => pharmacyService.listFulfilmentQueue(),
    enabled: canDispatch,
    refetchInterval: 15_000,
  });

  // Only orders waiting to be collected. Everything earlier belongs to the
  // people doing the picking, and showing it here would invite a counter clerk
  // to hand over a bag nobody has checked.
  const waiting = rows.filter((row) => row.status === "ready");

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["pharmacy-fulfilment-queue"] });
  }

  const collect = useMutation({
    mutationFn: (orderId: string) => pharmacyService.collectFulfilmentOrder(orderId),
    onSuccess: () => {
      invalidate();
      notifications.show({ title: "Collected", message: "Order handed over", color: "green" });
    },
    onError: (error: Error) =>
      notifications.show({ title: "Not collected", message: error.message, color: "red" }),
  });

  const release = useMutation({
    mutationFn: ({ orderId, why }: { orderId: string; why: string }) =>
      pharmacyService.releaseFulfilmentOrder(orderId, { reason: why }),
    onSuccess: () => {
      invalidate();
      notifications.show({
        title: "Released",
        message: "Stock returned to its original batches",
        color: "orange",
      });
      setReleasing(null);
    },
    onError: (error: Error) =>
      notifications.show({ title: "Not released", message: error.message, color: "red" }),
  });

  if (!canDispatch) {
    return (
      <Alert tone="warning" variant="light">
        The collection counter requires `pharmacy.fulfilment.dispatch`.
      </Alert>
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={4}>Ready to collect</Title>
        {isLoading && <Loader size="xs" />}
      </Group>
      <Text size="sm" c="dimmed">
        Checked packs waiting for the patient. Ask who it is for and check the name against this
        list — then call the token and hand the bag over.
      </Text>

      <Table striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Token</Table.Th>
            <Table.Th>Patient</Table.Th>
            <Table.Th>Lines</Table.Th>
            <Table.Th>Ready since</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {waiting.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text size="sm" c="dimmed">
                  Nothing waiting to be collected.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
          {waiting.map((row) => (
            <Table.Tr key={row.id}>
              <Table.Td>
                <Text fw={700} ff="monospace">
                  {row.token_number ?? "—"}
                </Text>
              </Table.Td>
              <Table.Td>
                <Stack gap={0}>
                  <Text size="sm">{row.patient_name ?? "—"}</Text>
                  {row.uhid && (
                    <Text size="xs" c="dimmed" ff="monospace">
                      {row.uhid}
                    </Text>
                  )}
                </Stack>
              </Table.Td>
              <Table.Td>
                <Badge tone="neutral">{row.line_count}</Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{new Date(row.created_at).toLocaleTimeString()}</Text>
              </Table.Td>
              <Table.Td>
                <Group gap="xs" justify="flex-end" wrap="nowrap">
                  {canRelease && (
                    <Button size="compact-xs" tone="danger-ghost" onClick={() => setReleasing(row)}>
                      Nobody came
                    </Button>
                  )}
                  <Button
                    size="compact-xs"
                    disabled={collect.isPending}
                    onClick={() => collect.mutate(row.id)}
                  >
                    Handed over
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <ReasonModal
        opened={releasing !== null}
        title={`Release ${releasing?.token_number ?? "order"}`}
        description="This puts the stock back on the shelf and leaves a paid bill with nothing against it. Both are questions somebody will ask later, so the reason is kept."
        label="Why was this never collected?"
        placeholder="Patient left, duplicate order, wrong patient, …"
        confirmLabel="Release and restock"
        confirmTone="danger"
        pending={release.isPending}
        onClose={() => setReleasing(null)}
        onConfirm={(why) => releasing && release.mutate({ orderId: releasing.id, why })}
      />
    </Stack>
  );
}
