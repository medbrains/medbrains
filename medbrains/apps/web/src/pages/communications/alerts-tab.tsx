// Communications AlertsTab — split from communications.tsx (pure move).

import { Card, Group, Select, SimpleGrid, Text, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { CommCriticalAlertRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, IconButton } from "@/components/ui";
import { communicationsService } from "@/services/communications.service";
import { PRIORITY_COLORS } from "./shared";

const ALERT_STATUS_COLORS: Record<string, BadgeTone> = {
  triggered: "danger",
  acknowledged: "info",
  escalated: "warning",
  resolved: "success",
  expired: "neutral",
};

export function AlertsTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.COMMUNICATIONS.ALERTS_MANAGE);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["comm-alerts", statusFilter],
    queryFn: () => communicationsService.listCommAlerts({ status: statusFilter ?? undefined }),
  });

  const ackMut = useMutation({
    mutationFn: (id: string) => communicationsService.acknowledgeCommAlert(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comm-alerts"] });
      notifications.show({ title: "Acknowledged", message: "Alert acknowledged", color: "blue" });
    },
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) => communicationsService.resolveCommAlert(id, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comm-alerts"] });
      notifications.show({ title: "Resolved", message: "Alert resolved", color: "green" });
    },
  });

  const active = data.filter((a) => a.status === "triggered" || a.status === "acknowledged");

  const cols: Column<CommCriticalAlertRow>[] = [
    {
      key: "alert_code",
      label: "Code",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.alert_code}
        </Text>
      ),
    },
    {
      key: "alert_source",
      label: "Source",
      render: (r) => <Badge size="sm">{r.alert_source}</Badge>,
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => (
        <Badge size="sm" tone={PRIORITY_COLORS[r.priority] ?? "neutral"}>
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge size="sm" tone={ALERT_STATUS_COLORS[r.status] ?? "neutral"}>
          {r.status}
        </Badge>
      ),
    },
    { key: "title", label: "Title", render: (r) => <Text size="sm">{r.title}</Text> },
    {
      key: "alert_value",
      label: "Value",
      render: (r) => (
        <Text size="sm" fw={600} c="red">
          {r.alert_value ?? "—"}
        </Text>
      ),
    },
    {
      key: "normal_range",
      label: "Normal",
      render: (r) => (
        <Text size="sm" c="dimmed">
          {r.normal_range ?? "—"}
        </Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => {
        if (!canManage) return null;
        return (
          <Group gap={4}>
            {r.status === "triggered" && (
              <Tooltip label="Acknowledge">
                <IconButton
                  tone="primary"
                  size="sm"
                  onClick={() => ackMut.mutate(r.id)}
                  aria-label="Confirm"
                >
                  <IconCheck size={14} />
                </IconButton>
              </Tooltip>
            )}
            {(r.status === "triggered" || r.status === "acknowledged") && (
              <Tooltip label="Resolve">
                <IconButton
                  tone="success"
                  size="sm"
                  onClick={() => resolveMut.mutate(r.id)}
                  aria-label="Close"
                >
                  <IconX size={14} />
                </IconButton>
              </Tooltip>
            )}
          </Group>
        );
      },
    },
  ];

  return (
    <>
      <SimpleGrid cols={{ base: 2, md: 3 }} mb="md">
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Active Alerts
          </Text>
          <Text size="xl" fw={700} c="red">
            {active.length}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Escalated
          </Text>
          <Text size="xl" fw={700} c="orange">
            {data.filter((a) => a.status === "escalated").length}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Resolved Today
          </Text>
          <Text size="xl" fw={700} c="green">
            {data.filter((a) => a.status === "resolved").length}
          </Text>
        </Card>
      </SimpleGrid>
      <Group mb="md">
        <Select
          placeholder="Status"
          clearable
          value={statusFilter}
          onChange={setStatusFilter}
          data={Object.keys(ALERT_STATUS_COLORS)}
          w={160}
        />
      </Group>
      <DataTable columns={cols} data={data} loading={isLoading} rowKey={(r) => r.id} />
    </>
  );
}

// ── Complaints Tab ──────────────────────────────────────
