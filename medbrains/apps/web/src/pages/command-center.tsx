import { zodResolver } from "@hookform/resolvers/zod";
import {
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  type CommandCenterAlertThresholdFormInput,
  type CommandCenterAssignTransportFormInput,
  type CommandCenterTransportFormInput,
  commandCenterAlertThresholdFormSchema,
  commandCenterAssignTransportFormSchema,
  commandCenterTransportFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { AlertThresholdRow, DepartmentAlertRow, TransportRequestRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconActivity,
  IconAlertTriangle,
  IconAmbulance,
  IconBed,
  IconBellRinging,
  IconCheck,
  IconClock,
  IconDashboard,
  IconDoorExit,
  IconHeartbeat,
  IconPlus,
  IconTruck,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader, StatCard } from "@/components";
import type { Column } from "@/components/DataTable";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import {
  type AssignTransportInput,
  type CreateAlertThresholdInput,
  type CreateTransportInput,
  commandCenterService,
  type UpdateAlertThresholdInput,
} from "@/services/commandCenter.service";
import { BedManagementTab } from "./command-center/bed-management-tab";
import { DischargeCoordinatorTab } from "./command-center/discharge-coordinator-tab";
import { OverviewTab } from "./command-center/overview-tab";
import { alertLevelColor, fmtDate, REFETCH } from "./command-center/shared";

// ── Constants ──────────────────────────────────────────

const TRANSPORT_MODES = [
  { value: "wheelchair", label: "Wheelchair" },
  { value: "stretcher", label: "Stretcher" },
  { value: "ambulance", label: "Ambulance" },
  { value: "walking", label: "Walking" },
  { value: "bed", label: "Bed" },
];

const TRANSPORT_PRIORITIES = [
  { value: "routine", label: "Routine" },
  { value: "urgent", label: "Urgent" },
  { value: "emergency", label: "Emergency" },
];

const METRIC_OPTIONS = [
  { value: "occupancy_pct", label: "Bed Occupancy %" },
  { value: "avg_wait_mins", label: "Avg Wait Time (mins)" },
  { value: "queue_depth", label: "Queue Depth" },
  { value: "pending_discharges", label: "Pending Discharges" },
  { value: "turnaround_mins", label: "Bed Turnaround (mins)" },
  { value: "er_wait_mins", label: "ER Wait Time (mins)" },
];

const EMPTY_TRANSPORT_FORM: CommandCenterTransportFormInput = {
  patient_id: "",
  from_location_id: "",
  to_location_id: "",
  transport_mode: "wheelchair",
  priority: "routine",
  notes: "",
};
const EMPTY_ASSIGN_TRANSPORT_FORM: CommandCenterAssignTransportFormInput = {
  assigned_to: "",
};
const EMPTY_ALERT_THRESHOLD_FORM: CommandCenterAlertThresholdFormInput = {
  department_id: "",
  metric_code: "",
  warning_threshold: "",
  critical_threshold: "",
};

// ── Helpers ────────────────────────────────────────────

function transportModeColor(m: string): BadgeTone {
  switch (m) {
    case "ambulance":
      return "danger";
    case "stretcher":
      return "warning";
    case "wheelchair":
      return "primary";
    case "bed":
      return "accent";
    default:
      return "neutral";
  }
}

function transportPriorityColor(p: string): BadgeTone {
  switch (p) {
    case "emergency":
      return "danger";
    case "urgent":
      return "warning";
    default:
      return "neutral";
  }
}

function transportStatusColor(s: string): BadgeTone {
  switch (s) {
    case "requested":
      return "primary";
    case "assigned":
      return "info";
    case "in_transit":
      return "warning";
    case "completed":
      return "success";
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

function optionalTrimmed(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalFormNumber(value: string | number): number | undefined {
  if (typeof value === "string" && value.trim().length === 0) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formToTransportPayload(form: CommandCenterTransportFormInput): CreateTransportInput {
  return {
    patient_id: optionalTrimmed(form.patient_id),
    from_location_id: form.from_location_id.trim(),
    to_location_id: form.to_location_id.trim(),
    transport_mode: form.transport_mode,
    priority: form.priority,
    notes: optionalTrimmed(form.notes),
  };
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

function TransportTab() {
  const canManage = useHasPermission(P.COMMAND_CENTER.TRANSPORT.MANAGE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [assignModalId, setAssignModalId] = useState<string | null>(null);
  const qc = useQueryClient();
  const {
    control: transportControl,
    formState: { errors: transportErrors },
    handleSubmit: handleTransportSubmit,
    register: registerTransport,
    reset: resetTransport,
  } = useForm<CommandCenterTransportFormInput>({
    resolver: zodResolver(commandCenterTransportFormSchema),
    defaultValues: EMPTY_TRANSPORT_FORM,
  });
  const {
    control: assignControl,
    formState: { errors: assignErrors },
    handleSubmit: handleAssignSubmit,
    reset: resetAssign,
  } = useForm<CommandCenterAssignTransportFormInput>({
    resolver: zodResolver(commandCenterAssignTransportFormSchema),
    defaultValues: EMPTY_ASSIGN_TRANSPORT_FORM,
  });

  const { data: transport, isLoading } = useQuery({
    queryKey: ["command-center", "transport"],
    queryFn: () => commandCenterService.listTransportRequests(),
    refetchInterval: REFETCH,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateTransportInput) => commandCenterService.createTransportRequest(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["command-center", "transport"] });
      closeCreate();
      resetTransport(EMPTY_TRANSPORT_FORM);
      notifications.show({ title: "Success", message: "Transport request created" });
    },
  });

  const assignMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssignTransportInput }) =>
      commandCenterService.assignTransport(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["command-center", "transport"] });
      setAssignModalId(null);
      resetAssign(EMPTY_ASSIGN_TRANSPORT_FORM);
      notifications.show({ title: "Success", message: "Transport assigned" });
    },
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => commandCenterService.completeTransport(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["command-center", "transport"] });
      notifications.show({ title: "Success", message: "Transport completed" });
    },
  });

  // Stats
  const all = transport ?? [];
  const active = all.filter((t) => t.status === "requested" || t.status === "assigned").length;
  const inTransit = all.filter((t) => t.status === "in_transit").length;
  const completedToday = all.filter((t) => {
    if (t.status !== "completed" || !t.completed_at) return false;
    const d = new Date(t.completed_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;
  const completedWithTime = all.filter(
    (t) => t.status === "completed" && t.requested_at && t.completed_at,
  );
  const avgResponse =
    completedWithTime.length > 0
      ? completedWithTime.reduce((sum, t) => {
          if (!t.completed_at) return sum;
          const diff = new Date(t.completed_at).getTime() - new Date(t.requested_at).getTime();
          return sum + diff / 60000;
        }, 0) / completedWithTime.length
      : 0;

  const openCreateTransport = () => {
    resetTransport(EMPTY_TRANSPORT_FORM);
    openCreate();
  };

  const closeCreateTransport = () => {
    resetTransport(EMPTY_TRANSPORT_FORM);
    closeCreate();
  };

  const closeAssignTransport = () => {
    setAssignModalId(null);
    resetAssign(EMPTY_ASSIGN_TRANSPORT_FORM);
  };

  const submitTransport = handleTransportSubmit((values) => {
    createMut.mutate(formToTransportPayload(values));
  });

  const submitAssign = handleAssignSubmit((values) => {
    if (assignModalId) {
      assignMut.mutate({ id: assignModalId, data: { assigned_to: values.assigned_to.trim() } });
    }
  });

  const cols: Column<TransportRequestRow>[] = [
    {
      key: "patient",
      label: "Patient",
      render: (r) => <Text size="sm">{r.patient_name ?? "N/A"}</Text>,
    },
    {
      key: "from",
      label: "From",
      render: (r) => <Text size="sm">{r.from_location ?? "-"}</Text>,
    },
    {
      key: "to",
      label: "To",
      render: (r) => <Text size="sm">{r.to_location ?? "-"}</Text>,
    },
    {
      key: "mode",
      label: "Mode",
      render: (r) => (
        <Badge tone={transportModeColor(r.transport_mode)} size="sm" variant="light">
          {r.transport_mode}
        </Badge>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => (
        <Badge tone={transportPriorityColor(r.priority)} size="sm" variant="filled">
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={transportStatusColor(r.status)} size="sm" variant="filled">
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "requested_by",
      label: "Requested By",
      render: (r) => <Text size="xs">{r.requested_by_name}</Text>,
    },
    {
      key: "assigned_to",
      label: "Assigned To",
      render: (r) => <Text size="xs">{r.assigned_to_name ?? "-"}</Text>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => {
        if (!canManage) return null;
        return (
          <Group gap={4}>
            {r.status === "requested" && (
              <Button tone="secondary" size="compact-xs" onClick={() => setAssignModalId(r.id)}>
                Assign
              </Button>
            )}
            {r.status === "in_transit" && (
              <Button
                tone="primary"
                size="compact-xs"
                onClick={() => completeMut.mutate(r.id)}
                loading={completeMut.isPending}
              >
                Complete
              </Button>
            )}
          </Group>
        );
      },
    },
  ];

  return (
    <Stack gap="md">
      {/* Stats */}
      <SimpleGrid cols={4}>
        <StatCard
          label="Active Requests"
          value={active}
          icon={<IconTruck size={18} />}
          color="primary"
        />
        <StatCard
          label="In Transit"
          value={inTransit}
          icon={<IconAmbulance size={18} />}
          color="warning"
        />
        <StatCard
          label="Completed Today"
          value={completedToday}
          icon={<IconCheck size={18} />}
          color="success"
        />
        <StatCard
          label="Avg Response (min)"
          value={avgResponse.toFixed(0)}
          icon={<IconClock size={18} />}
          color="info"
        />
      </SimpleGrid>

      {/* Transport Table */}
      <DataTable<TransportRequestRow>
        columns={cols}
        data={all.filter((t) => t.status !== "completed" && t.status !== "cancelled")}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyIcon={<IconTruck size={40} />}
        emptyTitle="No active transport requests"
        toolbar={
          canManage ? (
            <Group justify="flex-end">
              <Button
                tone="primary"
                leftSection={<IconPlus size={14} />}
                size="xs"
                onClick={openCreateTransport}
              >
                New Transport Request
              </Button>
            </Group>
          ) : undefined
        }
      />

      {/* Create Transport Modal */}
      <Modal
        opened={createOpen}
        onClose={closeCreateTransport}
        title="New Transport Request"
        size="md"
      >
        <Stack component="form" gap="sm" onSubmit={submitTransport}>
          <Controller
            control={transportControl}
            name="patient_id"
            render={({ field }) => (
              <PatientSearchSelect
                label="Patient (optional)"
                value={field.value}
                onChange={field.onChange}
                error={transportErrors.patient_id?.message}
              />
            )}
          />
          <TextInput
            label="From Location ID"
            required
            error={transportErrors.from_location_id?.message}
            {...registerTransport("from_location_id")}
          />
          <TextInput
            label="To Location ID"
            required
            error={transportErrors.to_location_id?.message}
            {...registerTransport("to_location_id")}
          />
          <Controller
            name="transport_mode"
            control={transportControl}
            render={({ field }) => (
              <Select
                label="Mode"
                data={TRANSPORT_MODES}
                value={field.value}
                onChange={field.onChange}
                error={transportErrors.transport_mode?.message}
              />
            )}
          />
          <Controller
            name="priority"
            control={transportControl}
            render={({ field }) => (
              <Select
                label="Priority"
                data={TRANSPORT_PRIORITIES}
                value={field.value}
                onChange={field.onChange}
                error={transportErrors.priority?.message}
              />
            )}
          />
          <TextInput
            label="Notes"
            error={transportErrors.notes?.message}
            {...registerTransport("notes")}
          />
          <Group justify="flex-end" mt="sm">
            <Button tone="ghost" onClick={closeCreateTransport}>
              Cancel
            </Button>
            <Button tone="primary" type="submit" loading={createMut.isPending}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Assign Modal */}
      <Modal
        opened={assignModalId !== null}
        onClose={closeAssignTransport}
        title="Assign Transport"
        size="sm"
      >
        <Stack component="form" gap="sm" onSubmit={submitAssign}>
          <Controller
            control={assignControl}
            name="assigned_to"
            render={({ field }) => (
              <EmployeeSearchSelect
                label="Assign to"
                required
                value={field.value}
                onChange={field.onChange}
                error={assignErrors.assigned_to?.message}
              />
            )}
          />
          <Group justify="flex-end" mt="sm">
            <Button tone="ghost" onClick={closeAssignTransport}>
              Cancel
            </Button>
            <Button tone="primary" type="submit" loading={assignMut.isPending}>
              Assign
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 5: Alerts & Thresholds
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
