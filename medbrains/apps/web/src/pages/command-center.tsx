import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Modal, NumberInput, Select, Stack, Tabs, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  type CommandCenterAlertThresholdFormInput,
  commandCenterAlertThresholdFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { AlertThresholdRow, DepartmentAlertRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconActivity,
  IconAlertTriangle,
  IconBed,
  IconBellRinging,
  IconCheck,
  IconDashboard,
  IconDoorExit,
  IconHeartbeat,
  IconPlus,
  IconTruck,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { Badge, Button, IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import {
  type CreateAlertThresholdInput,
  commandCenterService,
  type UpdateAlertThresholdInput,
} from "@/services/commandCenter.service";
import { BedManagementTab } from "./command-center/bed-management-tab";
import { DischargeCoordinatorTab } from "./command-center/discharge-coordinator-tab";
import { OverviewTab } from "./command-center/overview-tab";
import { alertLevelColor, fmtDate, REFETCH } from "./command-center/shared";
import { TransportTab } from "./command-center/transport-tab";

// ── Constants ──────────────────────────────────────────

const METRIC_OPTIONS = [
  { value: "occupancy_pct", label: "Bed Occupancy %" },
  { value: "avg_wait_mins", label: "Avg Wait Time (mins)" },
  { value: "queue_depth", label: "Queue Depth" },
  { value: "pending_discharges", label: "Pending Discharges" },
  { value: "turnaround_mins", label: "Bed Turnaround (mins)" },
  { value: "er_wait_mins", label: "ER Wait Time (mins)" },
];

const EMPTY_ALERT_THRESHOLD_FORM: CommandCenterAlertThresholdFormInput = {
  department_id: "",
  metric_code: "",
  warning_threshold: "",
  critical_threshold: "",
};

// ── Helpers ────────────────────────────────────────────

function optionalFormNumber(value: string | number): number | undefined {
  if (typeof value === "string" && value.trim().length === 0) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formToAlertThresholdPayload(
  form: CommandCenterAlertThresholdFormInput,
): CreateAlertThresholdInput {
  return {
    department_id: form.department_id.trim(),
    metric_code: form.metric_code.trim(),
    warning_threshold: optionalFormNumber(form.warning_threshold),
    critical_threshold: optionalFormNumber(form.critical_threshold),
  };
}

// ── Main Page ─────────────────────────────────────────

export function CommandCenterPage() {
  useRequirePermission(P.COMMAND_CENTER.VIEW);
  const [tab, setTab] = useState<string | null>("overview");

  return (
    <div>
      <PageHeader
        title="Command Center"
        subtitle="Real-time hospital operations monitoring and control"
        icon={<IconDashboard size={20} stroke={1.5} />}
        color="danger"
      />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconActivity size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="beds" leftSection={<IconBed size={16} />}>
            Bed Management
          </Tabs.Tab>
          <Tabs.Tab value="discharge" leftSection={<IconDoorExit size={16} />}>
            Discharge Coordinator
          </Tabs.Tab>
          <Tabs.Tab value="transport" leftSection={<IconTruck size={16} />}>
            Transport
          </Tabs.Tab>
          <Tabs.Tab value="alerts" leftSection={<IconBellRinging size={16} />}>
            Alerts & Thresholds
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <OverviewTab />
        </Tabs.Panel>
        <Tabs.Panel value="beds" pt="md">
          <BedManagementTab />
        </Tabs.Panel>
        <Tabs.Panel value="discharge" pt="md">
          <DischargeCoordinatorTab />
        </Tabs.Panel>
        <Tabs.Panel value="transport" pt="md">
          <TransportTab />
        </Tabs.Panel>
        <Tabs.Panel value="alerts" pt="md">
          <AlertsThresholdsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 1: Overview
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Tab 2: Bed Management
// ══════════════════════════════════════════════════════════

function AlertsThresholdsTab() {
  const canManage = useHasPermission(P.COMMAND_CENTER.ALERTS.MANAGE);
  const [thresholdOpen, { open: openThreshold, close: closeThreshold }] = useDisclosure(false);
  const qc = useQueryClient();
  const {
    control: thresholdControl,
    formState: { errors: thresholdErrors },
    handleSubmit: handleThresholdSubmit,
    reset: resetThreshold,
  } = useForm<CommandCenterAlertThresholdFormInput>({
    resolver: zodResolver(commandCenterAlertThresholdFormSchema),
    defaultValues: EMPTY_ALERT_THRESHOLD_FORM,
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ["command-center", "alerts"],
    queryFn: () => commandCenterService.getActiveAlerts(),
    refetchInterval: REFETCH,
  });

  const { data: thresholds, isLoading: thresholdsLoading } = useQuery({
    queryKey: ["command-center", "alert-thresholds"],
    queryFn: () => commandCenterService.listAlertThresholds(),
    refetchInterval: REFETCH,
  });

  const ackAlert = useMutation({
    mutationFn: (id: string) => commandCenterService.acknowledgeAlert(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["command-center", "alerts"] });
      notifications.show({ title: "Alert Acknowledged", message: "Alert has been acknowledged" });
    },
  });

  const createThreshold = useMutation({
    mutationFn: (data: CreateAlertThresholdInput) =>
      commandCenterService.createAlertThreshold(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["command-center", "alert-thresholds"] });
      closeThreshold();
      resetThreshold(EMPTY_ALERT_THRESHOLD_FORM);
      notifications.show({ title: "Success", message: "Threshold created" });
    },
  });

  const updateThreshold = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAlertThresholdInput }) =>
      commandCenterService.updateAlertThreshold(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["command-center", "alert-thresholds"] });
      notifications.show({ title: "Success", message: "Threshold updated" });
    },
  });

  const openCreateThreshold = () => {
    resetThreshold(EMPTY_ALERT_THRESHOLD_FORM);
    openThreshold();
  };

  const closeCreateThreshold = () => {
    resetThreshold(EMPTY_ALERT_THRESHOLD_FORM);
    closeThreshold();
  };

  const submitThreshold = handleThresholdSubmit((values) => {
    createThreshold.mutate(formToAlertThresholdPayload(values));
  });

  // Alert columns (full view)
  const alertCols: Column<DepartmentAlertRow>[] = [
    {
      key: "dept",
      label: "Department",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.department_name}
        </Text>
      ),
    },
    {
      key: "level",
      label: "Level",
      render: (r) => (
        <Badge tone={alertLevelColor(r.alert_level)} size="sm" variant="filled">
          {r.alert_level.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "metric",
      label: "Metric",
      render: (r) => <Text size="sm">{r.metric_code.replace(/_/g, " ")}</Text>,
    },
    {
      key: "current",
      label: "Current Value",
      render: (r) => (
        <Text size="sm" fw={600}>
          {r.current_value}
        </Text>
      ),
    },
    {
      key: "threshold",
      label: "Threshold",
      render: (r) => <Text size="sm">{r.threshold_value}</Text>,
    },
    {
      key: "message",
      label: "Message",
      render: (r) => <Text size="sm">{r.message}</Text>,
    },
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
      render: (r) => {
        if (r.acknowledged_by) {
          return (
            <Tooltip
              label={`Acknowledged by ${r.acknowledged_by} at ${fmtDate(r.acknowledged_at)}`}
            >
              <Badge size="xs" variant="light" tone="success">
                ACK
              </Badge>
            </Tooltip>
          );
        }
        if (!canManage) return null;
        return (
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
        );
      },
    },
  ];

  // Threshold columns
  const thresholdCols: Column<AlertThresholdRow>[] = [
    {
      key: "dept",
      label: "Department",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.department_name}
        </Text>
      ),
    },
    {
      key: "metric",
      label: "Metric",
      render: (r) => <Text size="sm">{r.metric_code.replace(/_/g, " ")}</Text>,
    },
    {
      key: "warning",
      label: "Warning Threshold",
      render: (r) => (
        <Text size="sm" c="yellow.7" fw={500}>
          {r.warning_threshold ?? "-"}
        </Text>
      ),
    },
    {
      key: "critical",
      label: "Critical Threshold",
      render: (r) => (
        <Text size="sm" c="danger" fw={500}>
          {r.critical_threshold ?? "-"}
        </Text>
      ),
    },
    {
      key: "active",
      label: "Active",
      render: (r) => (
        <Badge size="sm" tone={r.is_active ? "success" : "neutral"} variant="light">
          {r.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => {
        if (!canManage) return null;
        return (
          <Group gap={4}>
            <Tooltip label={r.is_active ? "Deactivate" : "Activate"}>
              <IconButton
                tone={r.is_active ? "danger" : "success"}
                size="sm"
                onClick={() =>
                  updateThreshold.mutate({
                    id: r.id,
                    data: { is_active: !r.is_active },
                  })
                }
                aria-label={r.is_active ? "Deactivate" : "Activate"}
              >
                {r.is_active ? <IconAlertTriangle size={14} /> : <IconCheck size={14} />}
              </IconButton>
            </Tooltip>
          </Group>
        );
      },
    },
  ];

  return (
    <Stack gap="md">
      {/* Active Alerts */}
      <Text size="sm" fw={600}>
        Active Alerts
      </Text>
      <DataTable<DepartmentAlertRow>
        columns={alertCols}
        data={alerts ?? []}
        loading={alertsLoading}
        rowKey={(r) => r.id}
        emptyIcon={<IconBellRinging size={40} />}
        emptyTitle="No active alerts"
        emptyDescription="All systems operating within normal parameters"
        rowStyle={(r) =>
          !r.acknowledged_by
            ? {
                backgroundColor:
                  r.alert_level === "critical"
                    ? "var(--mantine-color-red-0)"
                    : "var(--mantine-color-yellow-0)",
              }
            : undefined
        }
      />

      {/* Threshold Configuration */}
      <Text size="sm" fw={600}>
        Threshold Configuration
      </Text>
      <DataTable<AlertThresholdRow>
        columns={thresholdCols}
        data={thresholds ?? []}
        loading={thresholdsLoading}
        rowKey={(r) => r.id}
        emptyIcon={<IconHeartbeat size={40} />}
        emptyTitle="No thresholds configured"
        emptyDescription="Add thresholds to enable automated alerting"
        toolbar={
          canManage ? (
            <Group justify="flex-end">
              <Button
                tone="primary"
                leftSection={<IconPlus size={14} />}
                size="xs"
                onClick={openCreateThreshold}
              >
                Add Threshold
              </Button>
            </Group>
          ) : undefined
        }
      />

      {/* Create Threshold Modal */}
      <Modal
        opened={thresholdOpen}
        onClose={closeCreateThreshold}
        title="Add Alert Threshold"
        size="md"
      >
        <Stack component="form" gap="sm" onSubmit={submitThreshold}>
          <Controller
            control={thresholdControl}
            name="department_id"
            render={({ field }) => (
              <DepartmentSelect
                label="Department"
                required
                value={field.value}
                onChange={field.onChange}
                error={thresholdErrors.department_id?.message}
              />
            )}
          />
          <Controller
            name="metric_code"
            control={thresholdControl}
            render={({ field }) => (
              <Select
                label="Metric"
                required
                data={METRIC_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={thresholdErrors.metric_code?.message}
              />
            )}
          />
          <Controller
            name="warning_threshold"
            control={thresholdControl}
            render={({ field }) => (
              <NumberInput
                label="Warning Threshold"
                value={field.value}
                onChange={field.onChange}
                error={thresholdErrors.warning_threshold?.message}
                min={0}
              />
            )}
          />
          <Controller
            name="critical_threshold"
            control={thresholdControl}
            render={({ field }) => (
              <NumberInput
                label="Critical Threshold"
                value={field.value}
                onChange={field.onChange}
                error={thresholdErrors.critical_threshold?.message}
                min={0}
              />
            )}
          />
          <Group justify="flex-end" mt="sm">
            <Button tone="ghost" onClick={closeCreateThreshold}>
              Cancel
            </Button>
            <Button tone="primary" type="submit" loading={createThreshold.isPending}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
