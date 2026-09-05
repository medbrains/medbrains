// Lab PhlebotomyTab — split from lab.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { LabPhlebotomyQueueItem } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable, StatusDot } from "@/components";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Badge, Button, Select, toast } from "@/components/ui";
import { statusColor } from "@/lib/status-colors";
import { adminAccessService } from "@/services/adminAccess.service";
import { labService } from "@/services/lab.service";
import { phlebotomyStatusColors } from "./shared";

export function PhlebotomyTab() {
  const { t } = useTranslation("lab");
  const canManage = useHasPermission(P.LAB.PHLEBOTOMY_MANAGE);
  const queryClient = useQueryClient();

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["lab-phlebotomy-queue"],
    queryFn: () => labService.listPhlebotomyQueue(),
    refetchInterval: 15_000,
  });

  // Who is going to draw this. `assignPhlebotomist` had no client method at
  // all, so a draw could be queued and worked but never given to anybody —
  // on a busy round that means two people walk to the same bed, or nobody
  // does.
  const { data: staff = [] } = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => adminAccessService.listUsers(),
    staleTime: 300_000,
  });
  const assignMutation = useMutation({
    mutationFn: ({ id, assignedTo }: { id: string; assignedTo: string }) =>
      labService.assignPhlebotomist(id, { assigned_to: assignedTo }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-phlebotomy-queue"] });
      toast.success("Draw assigned");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not assign the draw" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      labService.updatePhlebotomyStatus(id, {
        status: status as "in_progress" | "completed" | "skipped" | "waiting",
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["lab-phlebotomy-queue"] }),
  });

  const staffOptions = staff.map((user) => ({ value: user.id, label: user.full_name }));

  const columns = [
    {
      key: "assigned_to",
      label: "Phlebotomist",
      render: (row: LabPhlebotomyQueueItem) =>
        canManage && row.status !== "completed" ? (
          <Select
            aria-label={`Assign a phlebotomist for this draw`}
            placeholder="Unassigned"
            data={staffOptions}
            value={row.assigned_to}
            onChange={(value) => value && assignMutation.mutate({ id: row.id, assignedTo: value })}
            disabled={assignMutation.isPending}
            searchable
            size="xs"
            w={190}
          />
        ) : (
          <Text size="sm" c={row.assigned_to ? undefined : "dimmed"}>
            {staffOptions.find((o) => o.value === row.assigned_to)?.label ?? "Unassigned"}
          </Text>
        ),
    },
    {
      key: "patient_id",
      label: "Patient",
      render: (row: LabPhlebotomyQueueItem) => (
        <PatientNameCell patientId={row.patient_id} showUhid={false} />
      ),
    },
    {
      key: "order_id",
      label: "Order",
      render: (row: LabPhlebotomyQueueItem) => <Text size="sm">{row.order_id.slice(0, 8)}...</Text>,
    },
    {
      key: "priority",
      label: "Priority",
      render: (row: LabPhlebotomyQueueItem) => (
        <StatusDot color={statusColor(row.priority) ?? "slate"} label={row.priority} />
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: LabPhlebotomyQueueItem) => (
        <Badge tone={phlebotomyStatusColors[row.status] ?? "neutral"} size="sm">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "queued_at",
      label: "Queued",
      render: (row: LabPhlebotomyQueueItem) => (
        <Text size="sm">{new Date(row.queued_at).toLocaleTimeString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: LabPhlebotomyQueueItem) =>
        canManage ? (
          <Group gap="xs">
            {row.status === "waiting" && (
              <Button
                tone="secondary"
                size="xs"
                onClick={() => statusMutation.mutate({ id: row.id, status: "in_progress" })}
              >
                Start
              </Button>
            )}
            {row.status === "in_progress" && (
              <Button
                tone="secondary"
                size="xs"
                onClick={() => statusMutation.mutate({ id: row.id, status: "completed" })}
              >
                Complete
              </Button>
            )}
            {(row.status === "waiting" || row.status === "in_progress") && (
              <Button
                tone="secondary"
                size="xs"
                onClick={() => statusMutation.mutate({ id: row.id, status: "skipped" })}
              >
                Skip
              </Button>
            )}
          </Group>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
  ];

  return (
    <Stack>
      <Text fw={600}>{t("phlebotomyCollectionQueue")}</Text>
      <DataTable columns={columns} data={queue} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  QC & Compliance Tab (NEW)
// ══════════════════════════════════════════════════════════
