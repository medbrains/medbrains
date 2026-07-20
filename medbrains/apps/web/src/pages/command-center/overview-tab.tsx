// Command-center OverviewTab — split from command-center.tsx (pure move).

import { Group, Paper, Progress, SimpleGrid, Stack, Text, ThemeIcon, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  DepartmentAlertRow,
  DepartmentLoadRow,
  KpiTile,
  PatientFlowSnapshot,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBed,
  IconBellRinging,
  IconCheck,
  IconChevronRight,
  IconClipboardCheck,
  IconClock,
  IconDoorExit,
  IconHeartbeat,
  IconStethoscope,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { DataTable, StatCard } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, IconButton } from "@/components/ui";
import { commandCenterService } from "@/services/commandCenter.service";
import { alertLevelColor, fmtDate, REFETCH } from "./shared";

function occupancyColor(pct: number): string {
  if (pct >= 85) return "danger";
  if (pct >= 70) return "warning";
  return "success";
}

export function OverviewTab() {
  const canManageAlerts = useHasPermission(P.COMMAND_CENTER.ALERTS.MANAGE);
  const qc = useQueryClient();

  const { data: kpis } = useQuery({
    queryKey: ["command-center", "kpis"],
    queryFn: () => commandCenterService.getKpis(),
    refetchInterval: REFETCH,
  });

  const { data: flow } = useQuery({
    queryKey: ["command-center", "patient-flow"],
    queryFn: () => commandCenterService.getPatientFlow(),
    refetchInterval: REFETCH,
  });

  const { data: deptLoad, isLoading: deptLoading } = useQuery({
    queryKey: ["command-center", "department-load"],
    queryFn: () => commandCenterService.getDepartmentLoad(),
    refetchInterval: REFETCH,
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ["command-center", "alerts"],
    queryFn: () => commandCenterService.getActiveAlerts(),
    refetchInterval: REFETCH,
  });

  const ackAlert = useMutation({
    mutationFn: (id: string) => commandCenterService.acknowledgeAlert(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["command-center", "alerts"] });
      notifications.show({ title: "Alert Acknowledged", message: "Alert has been acknowledged" });
    },
  });

  // KPI helper — find a tile by code
  const kpi = (code: string): KpiTile | undefined => kpis?.find((k) => k.code === code);

  const kpiTiles: { code: string; label: string; icon: React.ReactNode; color: string }[] = [
    {
      code: "total_inpatients",
      label: "Inpatients",
      icon: <IconBed size={18} />,
      color: "primary",
    },
    { code: "opd_today", label: "OPD Today", icon: <IconStethoscope size={18} />, color: "teal" },
    { code: "bed_occupancy", label: "Bed Occupancy", icon: <IconBed size={18} />, color: "orange" },
    {
      code: "pending_discharges",
      label: "Pending Discharges",
      icon: <IconDoorExit size={18} />,
      color: "violet",
    },
    {
      code: "active_alerts",
      label: "Active Alerts",
      icon: <IconAlertTriangle size={18} />,
      color: "danger",
    },
    {
      code: "avg_wait_mins",
      label: "Avg Wait (min)",
      icon: <IconClock size={18} />,
      color: "info",
    },
  ];

  // Department load columns
  const deptCols: Column<DepartmentLoadRow>[] = [
    {
      key: "department",
      label: "Department",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.department_name}
        </Text>
      ),
    },
    {
      key: "beds",
      label: "Beds",
      render: (r) => (
        <Text size="sm">
          {r.bed_occupied}/{r.bed_total}
        </Text>
      ),
    },
    {
      key: "occupancy",
      label: "Occupancy %",
      render: (r) => (
        <Group gap="xs">
          <Progress
            value={r.occupancy_pct}
            color={occupancyColor(r.occupancy_pct)}
            size="sm"
            w={80}
          />
          <Text size="xs" c={`var(--mantine-color-${occupancyColor(r.occupancy_pct)}-6)`} fw={600}>
            {r.occupancy_pct.toFixed(0)}%
          </Text>
        </Group>
      ),
    },
    {
      key: "queue",
      label: "Queue",
      render: (r) => (
        <Badge
          variant="light"
          tone={r.queue_depth > 10 ? "danger" : r.queue_depth > 5 ? "warning" : "success"}
          size="sm"
        >
          {r.queue_depth}
        </Badge>
      ),
    },
    {
      key: "avg_wait",
      label: "Avg Wait",
      render: (r) => (
        <Text size="sm" c={r.avg_wait_mins > 30 ? "danger" : undefined}>
          {r.avg_wait_mins.toFixed(0)} min
        </Text>
      ),
    },
  ];

  // Alert columns (compact for overview)
  const alertCols: Column<DepartmentAlertRow>[] = [
    {
      key: "level",
      label: "Level",
      render: (r) => (
        <Badge tone={alertLevelColor(r.alert_level)} size="sm" variant="filled">
          {r.alert_level.toUpperCase()}
        </Badge>
      ),
    },
    { key: "dept", label: "Department", render: (r) => <Text size="sm">{r.department_name}</Text> },
    { key: "message", label: "Message", render: (r) => <Text size="sm">{r.message}</Text> },
    {
      key: "time",
      label: "Time",
      render: (r) => (
        <Text size="xs" c="dimmed">
          {fmtDate(r.created_at)}
        </Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) =>
        !r.acknowledged_by && canManageAlerts ? (
          <Tooltip label="Acknowledge">
            <IconButton
              tone="success"
              size="sm"
              onClick={() => ackAlert.mutate(r.id)}
              loading={ackAlert.isPending}
              aria-label="Acknowledge"
            >
              <IconCheck size={14} />
            </IconButton>
          </Tooltip>
        ) : r.acknowledged_by ? (
          <Badge size="xs" variant="light" tone="success">
            ACK
          </Badge>
        ) : null,
    },
  ];

  return (
    <Stack gap="md">
      {/* KPI Tiles */}
      <SimpleGrid cols={6}>
        {kpiTiles.map((t) => {
          const tile = kpi(t.code);
          return (
            <StatCard
              key={t.code}
              label={t.label}
              value={tile?.value ?? 0}
              icon={t.icon}
              color={t.color}
              trend={tile?.trend != null ? { value: tile.trend, label: tile.period } : undefined}
            />
          );
        })}
      </SimpleGrid>

      {/* Patient Flow Pipeline */}
      <Paper p="md" withBorder>
        <Text size="sm" fw={600} mb="sm">
          Patient Flow Pipeline
        </Text>
        <PatientFlowPipeline flow={flow ?? null} />
      </Paper>

      {/* Department Load */}
      <Text size="sm" fw={600}>
        Department Load
      </Text>
      <DataTable<DepartmentLoadRow>
        columns={deptCols}
        data={deptLoad ?? []}
        loading={deptLoading}
        rowKey={(r) => r.department_id}
        emptyIcon={<IconBed size={40} />}
        emptyTitle="No department data"
      />

      {/* Active Alerts (compact) */}
      <Text size="sm" fw={600}>
        Active Alerts
      </Text>
      <DataTable<DepartmentAlertRow>
        columns={alertCols}
        data={(alerts ?? []).filter((a) => !a.acknowledged_by).slice(0, 5)}
        loading={alertsLoading}
        rowKey={(r) => r.id}
        emptyIcon={<IconBellRinging size={40} />}
        emptyTitle="No active alerts"
        emptyDescription="All systems operating normally"
      />
    </Stack>
  );
}

// ── Patient Flow Pipeline Component ───────────────────

function PatientFlowPipeline({ flow }: { flow: PatientFlowSnapshot | null }) {
  const stages: { label: string; value: number; icon: React.ReactNode; color: string }[] = [
    {
      label: "Registered",
      value: flow?.registered_today ?? 0,
      icon: <IconUsers size={18} />,
      color: "primary",
    },
    {
      label: "OPD Queue",
      value: flow?.opd_waiting ?? 0,
      icon: <IconClock size={18} />,
      color: "info",
    },
    {
      label: "In Consult",
      value: flow?.opd_in_consult ?? 0,
      icon: <IconStethoscope size={18} />,
      color: "teal",
    },
    {
      label: "ER Active",
      value: flow?.er_active ?? 0,
      icon: <IconHeartbeat size={18} />,
      color: "danger",
    },
    {
      label: "Admitted",
      value: flow?.ipd_admitted ?? 0,
      icon: <IconBed size={18} />,
      color: "violet",
    },
    {
      label: "Pending Discharge",
      value: flow?.pending_discharge ?? 0,
      icon: <IconClipboardCheck size={18} />,
      color: "orange",
    },
    {
      label: "Discharged",
      value: flow?.discharged_today ?? 0,
      icon: <IconDoorExit size={18} />,
      color: "success",
    },
  ];

  return (
    <Group gap={0} justify="center" wrap="nowrap">
      {stages.map((stage, idx) => (
        <Group gap={0} key={stage.label} wrap="nowrap">
          <Paper
            p="sm"
            withBorder
            style={{
              textAlign: "center",
              minWidth: 120,
              borderColor: `var(--mantine-color-${stage.color}-3)`,
              background: `var(--mantine-color-${stage.color}-0)`,
            }}
          >
            <ThemeIcon variant="light" color={stage.color} size={32} radius="xl" mx="auto" mb={4}>
              {stage.icon}
            </ThemeIcon>
            <Text fz={22} fw={700} lh={1.1} c={`var(--mantine-color-${stage.color}-7)`}>
              {stage.value}
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              {stage.label}
            </Text>
          </Paper>
          {idx < stages.length - 1 && (
            <IconChevronRight
              size={20}
              color="var(--mantine-color-gray-4)"
              style={{ flexShrink: 0, margin: "0 4px" }}
            />
          )}
        </Group>
      ))}
    </Group>
  );
}
