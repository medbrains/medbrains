// Lab PhlebotomyTab — split from lab.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { LabPhlebotomyQueueItem } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable, StatusDot } from "@/components";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Badge, Button } from "@/components/ui";
import { statusColor } from "@/lib/status-colors";
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

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      labService.updatePhlebotomyStatus(id, {
        status: status as "in_progress" | "completed" | "skipped" | "waiting",
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["lab-phlebotomy-queue"] }),
  });

  const columns = [
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
