import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { previewQueueNumber } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import { P, type QueueRow } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { QueueCountersDrawer } from "@/components/Queues/QueueCountersDrawer";
import { QUEUE_MODULES, QueueFormDrawer } from "@/components/Queues/QueueFormDrawer";
import { QueueHoursDrawer } from "@/components/Queues/QueueHoursDrawer";
import { QueueLanesDrawer } from "@/components/Queues/QueueLanesDrawer";
import { Alert, Badge, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";

const STATUS_TONE = { active: "success", paused: "warning", closed: "neutral" } as const;
const moduleLabel = (value: string) => QUEUE_MODULES.find((m) => m.value === value)?.label ?? value;
const STATUS_LABEL = { active: "Active", paused: "Paused", closed: "Closed" } as const;
const RESTARTS = {
  daily: "restarts daily",
  session: "restarts each session",
  never: "never restarts",
} as const;
const day = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
/** "General OPD has closed for today" under General OPD reads "Closed for today". */
const withoutName = (row: QueueRow) => {
  const rest = (row.closed_reason ?? "").replace(`${row.name} `, "").replace(/^(is|has) /, "");
  return rest.charAt(0).toUpperCase() + rest.slice(1);
};
const runs = (row: QueueRow) =>
  row.lifecycle === "permanent" ? "Every day" : `${day(row.valid_from)} – ${day(row.valid_until)}`;

/** Admin → Queues: how each desk, room and camp numbers and admits tokens. */
export function QueuesPage() {
  useRequirePermission(P.FRONT_OFFICE.QUEUE.CONFIG.VIEW);
  const canManage = useHasPermission(P.FRONT_OFFICE.QUEUE.CONFIG.MANAGE);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<QueueRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [lanesOf, setLanesOf] = useState<QueueRow | null>(null);
  const [hoursOf, setHoursOf] = useState<QueueRow | null>(null);
  const [countersOf, setCountersOf] = useState<QueueRow | null>(null);
  const queues = useQuery({ queryKey: ["queues"], queryFn: () => api.listQueues() });

  const setStatus = useMutation({
    mutationFn: ({ row, status }: { row: QueueRow; status: QueueRow["status"] }) =>
      api.updateQueue(row.id, { ...row, status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["queues"] }),
    onError: (error: Error) => toast.error(error.message, { title: "Queue not changed" }),
  });

  const columns: Column<QueueRow>[] = [
    {
      key: "name",
      label: "Queue",
      searchable: true,
      searchValue: (row) => row.name,
      // Status sits under the name: a column of its own squeezed the badge to
      // "PAU…", which an admin cannot read at a glance.
      render: (row) => (
        <Stack gap={4} align="flex-start">
          <strong>{row.name}</strong>
          <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
          {/* Paused and closed already say so; this is for hours and dates. */}
          {row.status === "active" && row.closed_reason && (
            <Text size="xs" c="dimmed" data-testid={`queue-closed-reason-${row.id}`}>
              {withoutName(row)}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "serves",
      label: "Serves",
      searchable: true,
      searchValue: (row) => `${moduleLabel(row.module)} ${row.scope_label ?? ""}`,
      render: (row) => `${moduleLabel(row.module)} · ${row.scope_label ?? row.scope}`,
    },
    {
      key: "numbering",
      label: "Numbering",
      render: (row) =>
        `${previewQueueNumber(row.prefix, row.start_at, row.pad_width)} · ${RESTARTS[row.reset_rule]}`,
    },
    {
      key: "today",
      label: "Issued",
      render: (row) =>
        row.max_tokens_per_period
          ? `${row.issued} of ${row.max_tokens_per_period}`
          : String(row.issued),
    },
    { key: "runs", label: "Runs", render: runs },
    {
      key: "actions",
      label: "Actions",
      render: (row) =>
        canManage && row.status !== "closed" ? (
          <Group gap={6} wrap="nowrap">
            <Button size="xs" tone="secondary" onClick={() => setEditing(row)}>
              Edit
            </Button>
            <Button
              size="xs"
              tone="secondary"
              onClick={() => setHoursOf(row)}
              data-testid="btn-queue-hours"
            >
              Hours
            </Button>
            <Button
              size="xs"
              tone="secondary"
              onClick={() => setCountersOf(row)}
              data-testid="btn-queue-counters"
            >
              Counters
            </Button>
            <Button size="xs" tone="secondary" onClick={() => setLanesOf(row)}>
              Lanes
            </Button>
            <Button
              size="xs"
              tone="secondary"
              onClick={() =>
                setStatus.mutate({ row, status: row.status === "paused" ? "active" : "paused" })
              }
            >
              {row.status === "paused" ? "Resume" : "Pause"}
            </Button>
            <Button
              size="xs"
              tone="danger"
              onClick={() => setStatus.mutate({ row, status: "closed" })}
            >
              Close
            </Button>
          </Group>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <Stack>
      <PageHeader
        title="Queues"
        subtitle="How each desk, room and camp numbers and admits tokens."
        actions={
          canManage ? (
            <Button tone="primary" onClick={() => setCreating(true)}>
              New queue
            </Button>
          ) : undefined
        }
      />
      {queues.isError ? (
        <Alert tone="danger" title="Could not load the queues">
          {queues.error.message}
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          data={queues.data ?? []}
          loading={queues.isLoading}
          rowKey={(row) => row.id}
          rowTestId={(row) => `row-queue-${row.id}`}
          // A hospital runs dozens of queues; an admin finds one by name.
          searchable
          searchPlaceholder="Find a queue or place"
          emptyTitle="No queues set up yet"
          emptyDescription="Every place uses the standard numbering (T-001, P-001…) until you set up a queue for it."
        />
      )}
      {!canManage && (
        <Text size="sm" c="dimmed">
          Only a hospital administrator can change queues.
        </Text>
      )}
      <QueueLanesDrawer queue={lanesOf} onClose={() => setLanesOf(null)} />
      <QueueHoursDrawer queue={hoursOf} onClose={() => setHoursOf(null)} />
      <QueueCountersDrawer queue={countersOf} onClose={() => setCountersOf(null)} />
      <QueueFormDrawer
        opened={creating || editing !== null}
        queue={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </Stack>
  );
}
