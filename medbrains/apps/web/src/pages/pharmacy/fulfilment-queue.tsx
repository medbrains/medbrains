/**
 * The picking queue — what is in flight, short-dated stock first.
 *
 * The order is FEFO carried past the shelf into the queue: orders holding a
 * batch that dies soon come first, then FIFO on how long the batch has lived
 * in the store, then oldest order first. A batch nobody dispenses in time is
 * not stock, it is a write-off with a patient attached.
 *
 * Only meaningful in a `pack_and_collect` store. A counter pharmacy's orders
 * never enter these states, so its queue is simply empty — which is the honest
 * answer, and better than hiding the screen and leaving somebody wondering
 * where their order went.
 */

import { Group, Loader, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { FulfilmentQueueRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { DataTable } from "@/components";
import { Alert, Badge, type BadgeProps, Button } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import { ReasonModal } from "./reason-modal";

/** Colour carries the stage, so a picker can find their own work at a glance. */
const STAGE_TONE: Partial<Record<FulfilmentQueueRow["status"], BadgeProps["tone"]>> = {
  ordered: "neutral",
  picking: "primary",
  packed: "accent",
  verified: "info",
  ready: "success",
};

/** What this row is waiting for someone to do. */
function nextAction(row: FulfilmentQueueRow): string | null {
  switch (row.status) {
    case "ordered":
      return "Claim";
    case "picking":
      return "Pack";
    case "packed":
      return "Check";
    case "verified":
      return "Call";
    default:
      return null;
  }
}

export function FulfilmentQueuePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canPick = useHasPermission(P.PHARMACY.FULFILMENT.PICK);
  const canPack = useHasPermission(P.PHARMACY.FULFILMENT.PACK);
  const canDispatch = useHasPermission(P.PHARMACY.FULFILMENT.DISPATCH);
  const canCancel = useHasPermission(P.PHARMACY.FULFILMENT.RELEASE);

  const [cancelling, setCancelling] = useState<FulfilmentQueueRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pharmacy-fulfilment-queue"],
    queryFn: () => pharmacyService.listFulfilmentQueue(),
    enabled: canPick,
    // The queue is a shared work surface — two pickers looking at a stale list
    // both walk to the same shelf.
    refetchInterval: 15_000,
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["pharmacy-fulfilment-queue"] });
  }

  const advance = useMutation({
    mutationFn: ({ row }: { row: FulfilmentQueueRow }) => {
      switch (row.status) {
        case "ordered":
          return pharmacyService.claimFulfilmentOrder(row.id);
        case "picking":
          return pharmacyService.packFulfilmentOrder(row.id);
        case "verified":
          return pharmacyService.markFulfilmentReady(row.id);
        default:
          return Promise.reject(new Error(`No action for an order that is ${row.status}`));
      }
    },
    onSuccess: (result) => {
      invalidate();
      notifications.show({
        title: "Updated",
        message: `Order is now ${result.status}`,
        color: "green",
      });
    },
    onError: (error: Error) => {
      // The server's refusals name the specific problem — the wrong stage, a
      // counter pharmacy, an unchecked line. Passing them through unchanged is
      // the whole point of writing them that way.
      notifications.show({ title: "Cannot do that", message: error.message, color: "red" });
    },
  });

  const cancel = useMutation({
    mutationFn: ({ orderId, why }: { orderId: string; why: string }) =>
      pharmacyService.cancelFulfilmentOrder(orderId, { reason: why }),
    onSuccess: () => {
      invalidate();
      notifications.show({
        title: "Cancelled",
        message: "Order pulled out of the flow — stock returned to its batches",
        color: "orange",
      });
      setCancelling(null);
    },
    onError: (error: Error) =>
      notifications.show({ title: "Not cancelled", message: error.message, color: "red" }),
  });

  if (!canPick) {
    return (
      <Alert tone="warning" variant="light">
        The picking queue requires `pharmacy.fulfilment.pick`.
      </Alert>
    );
  }

  const columns = [
    {
      key: "token_number",
      label: "Token",
      searchable: true,
      accessor: (row: FulfilmentQueueRow) => row.token_number ?? "",
      render: (row: FulfilmentQueueRow) => (
        <Text size="sm" fw={700} ff="monospace">
          {row.token_number ?? "—"}
        </Text>
      ),
    },
    {
      key: "patient_name",
      label: "Patient",
      searchable: true,
      accessor: (row: FulfilmentQueueRow) => row.patient_name ?? "",
      render: (row: FulfilmentQueueRow) => (
        <Stack gap={0}>
          <Text size="sm">{row.patient_name ?? "—"}</Text>
          {row.uhid && (
            <Text size="xs" c="dimmed" ff="monospace">
              {row.uhid}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "status",
      label: "Stage",
      sortable: true,
      accessor: (row: FulfilmentQueueRow) => row.status,
      render: (row: FulfilmentQueueRow) => (
        <Group gap={6} wrap="nowrap">
          <Badge tone={STAGE_TONE[row.status] ?? "neutral"}>{row.status}</Badge>
          {row.near_expiry_lines > 0 && (
            <Badge tone="warning" title={`${row.near_expiry_lines} line(s) expire within 90 days`}>
              short-dated
            </Badge>
          )}
        </Group>
      ),
    },
    {
      key: "line_count",
      label: "Lines",
      sortable: true,
      accessor: (row: FulfilmentQueueRow) => row.line_count,
      render: (row: FulfilmentQueueRow) => (
        <Text size="sm">
          {row.line_count}
          {row.unverified_lines > 0 && (
            <Text span size="xs" c="orange" ml={6}>
              {row.unverified_lines} unchecked
            </Text>
          )}
        </Text>
      ),
    },
    {
      key: "created_at",
      label: "Waiting since",
      sortable: true,
      sortValue: (row: FulfilmentQueueRow) => row.created_at,
      accessor: (row: FulfilmentQueueRow) => row.created_at,
      render: (row: FulfilmentQueueRow) => (
        <Text size="sm">{new Date(row.created_at).toLocaleTimeString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "",
      accessor: () => "",
      render: (row: FulfilmentQueueRow) => {
        const action = nextAction(row);
        // `packed` is deliberately not an inline button: checking a pack means
        // going through it line by line, which is its own screen.
        const allowed =
          (row.status === "ordered" && canPick) ||
          (row.status === "picking" && canPack) ||
          (row.status === "verified" && canDispatch);
        return (
          <Group gap="xs" justify="flex-end" wrap="nowrap">
            <Button
              size="compact-xs"
              tone="ghost"
              onClick={() => navigate(`/pharmacy/fulfilment/${row.id}`)}
            >
              Pick list
            </Button>
            {canCancel && (
              <Button size="compact-xs" tone="danger-ghost" onClick={() => setCancelling(row)}>
                Cancel
              </Button>
            )}
            {row.status === "packed" ? (
              // Checking a pack means going through it line by line, which is
              // the pick-list screen — the same one, because a picker walks,
              // takes and ticks in one pass rather than in two screens.
              <Button size="compact-xs" onClick={() => navigate(`/pharmacy/fulfilment/${row.id}`)}>
                Check
              </Button>
            ) : (
              action && (
                <Button
                  size="compact-xs"
                  disabled={!allowed || advance.isPending}
                  onClick={() => advance.mutate({ row })}
                >
                  {action}
                </Button>
              )
            )}
          </Group>
        );
      },
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={4}>Fulfilment queue</Title>
        {isLoading && <Loader size="xs" />}
      </Group>
      <Text size="sm" c="dimmed">
        Orders being picked and packed — short-dated stock first, then the longest-resident batch,
        then oldest order. A counter pharmacy hands medicine over directly and its orders never
        appear here.
      </Text>
      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        rowKey={(row: FulfilmentQueueRow) => row.id}
      />

      <ReasonModal
        opened={cancelling !== null}
        title={`Cancel ${cancelling?.token_number ?? "order"}`}
        description="This pulls the order out mid-flight and puts its stock back into the exact batches it came from. The money already taken stays a question for billing, so the reason is kept."
        label="Why is this order being cancelled?"
        placeholder="Wrong order claimed, patient left, duplicate, …"
        confirmLabel="Cancel order and restock"
        confirmTone="danger"
        pending={cancel.isPending}
        onClose={() => setCancelling(null)}
        onConfirm={(why) => cancelling && cancel.mutate({ orderId: cancelling.id, why })}
      />
    </Stack>
  );
}
