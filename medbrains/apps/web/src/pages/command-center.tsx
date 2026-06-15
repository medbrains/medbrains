import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Group,
  Modal,
  NumberInput,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
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
import type {
  AlertThresholdRow,
  BedTurnaroundRow,
  DepartmentAlertRow,
  DepartmentLoadRow,
  KpiTile,
  PatientFlowSnapshot,
  PendingDischargeRow,
  TransportRequestRow,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconActivity,
  IconAlertTriangle,
  IconAmbulance,
  IconBed,
  IconBellRinging,
  IconCheck,
  IconChevronRight,
  IconClipboardCheck,
  IconClock,
  IconDashboard,
  IconDoorExit,
  IconHeartbeat,
  IconPlus,
  IconStethoscope,
  IconTruck,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader, StatCard } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import {
  type AssignTransportInput,
  type CreateAlertThresholdInput,
  type CreateTransportInput,
  commandCenterService,
  type UpdateAlertThresholdInput,
} from "@/services/commandCenter.service";

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

const REFETCH = 30_000;
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

function occupancyColor(pct: number): string {
  if (pct >= 85) return "danger";
  if (pct >= 70) return "warning";
  return "success";
}

function bedStatusColor(s: string): BadgeTone {
  switch (s) {
    case "vacant_clean":
      return "success";
    case "occupied":
      return "primary";
    case "cleaning":
      return "warning";
    case "vacant_dirty":
      return "danger";
    case "maintenance":
      return "neutral";
    default:
      return "neutral";
  }
}

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

function alertLevelColor(level: string): BadgeTone {
  return level === "critical" ? "danger" : "warning";
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleString();
}

function fmtShortDate(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString();
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

function OverviewTab() {
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

// ══════════════════════════════════════════════════════════
//  Tab 2: Bed Management
// ══════════════════════════════════════════════════════════

function BedManagementTab() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["command-center", "turnaround-stats"],
    queryFn: () => commandCenterService.getTurnaroundStats(),
    refetchInterval: REFETCH,
  });

  const { data: beds, isLoading: bedsLoading } = useQuery({
    queryKey: ["command-center", "bed-turnaround"],
    queryFn: () => commandCenterService.getBedTurnaround(),
    refetchInterval: REFETCH,
  });

  const { data: pendingDischarges, isLoading: dischargesLoading } = useQuery({
    queryKey: ["command-center", "pending-discharges"],
    queryFn: () => commandCenterService.listPendingDischarges(),
    refetchInterval: REFETCH,
  });

  // Turnaround table columns
  const bedCols: Column<BedTurnaroundRow>[] = [
    { key: "location", label: "Location", render: (r) => <Text size="sm">{r.location_code}</Text> },
    { key: "ward", label: "Ward", render: (r) => <Text size="sm">{r.ward_name}</Text> },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={bedStatusColor(r.status)} size="sm" variant="filled">
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "discharge_at",
      label: "Discharge Time",
      render: (r) => <Text size="xs">{fmtDate(r.discharge_at)}</Text>,
    },
    {
      key: "cleaning_started",
      label: "Cleaning Started",
      render: (r) => <Text size="xs">{fmtDate(r.cleaning_started_at)}</Text>,
    },
    {
      key: "cleaning_completed",
      label: "Completed",
      render: (r) => <Text size="xs">{fmtDate(r.cleaning_completed_at)}</Text>,
    },
    {
      key: "turnaround",
      label: "Turnaround (min)",
      render: (r) => (
        <Text
          size="sm"
          fw={500}
          c={r.turnaround_minutes != null && r.turnaround_minutes > 60 ? "danger" : undefined}
        >
          {r.turnaround_minutes != null ? r.turnaround_minutes : "-"}
        </Text>
      ),
    },
  ];

  // Discharge pipeline columns (compact view)
  const dischargeCols: Column<PendingDischargeRow>[] = [
    {
      key: "patient",
      label: "Patient",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.patient_name}
        </Text>
      ),
    },
    {
      key: "uhid",
      label: "UHID",
      render: (r) => (
        <Text size="xs" c="dimmed">
          {r.uhid}
        </Text>
      ),
    },
    { key: "ward", label: "Ward", render: (r) => <Text size="sm">{r.ward_name}</Text> },
    { key: "bed", label: "Bed", render: (r) => <Text size="sm">{r.bed_code}</Text> },
    {
      key: "expected",
      label: "Expected Discharge",
      render: (r) => {
        const isOverdue =
          r.expected_discharge_date && new Date(r.expected_discharge_date) < new Date();
        return (
          <Text size="sm" c={isOverdue ? "danger" : undefined} fw={isOverdue ? 600 : undefined}>
            {fmtShortDate(r.expected_discharge_date)}
          </Text>
        );
      },
    },
    { key: "days", label: "Days", render: (r) => <Text size="sm">{r.days_admitted}</Text> },
  ];

  return (
    <Stack gap="md">
      {/* Turnaround Stats Cards */}
      <Text size="sm" fw={600}>
        Ward Turnaround Statistics
      </Text>
      <SimpleGrid cols={4}>
        {(stats ?? []).map((s) => (
          <Card key={s.ward_name} p="md" withBorder>
            <Text size="sm" fw={600} mb="xs">
              {s.ward_name}
            </Text>
            <SimpleGrid cols={2} spacing="xs">
              <div>
                <Text size="xs" c="dimmed">
                  Avg Turnaround
                </Text>
                <Text size="lg" fw={700}>
                  {s.avg_turnaround_mins.toFixed(0)} min
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Max Turnaround
                </Text>
                <Text size="lg" fw={700}>
                  {s.max_turnaround_mins.toFixed(0)} min
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Awaiting Cleaning
                </Text>
                <Text size="lg" fw={700} c={s.beds_awaiting_cleaning > 0 ? "orange" : undefined}>
                  {s.beds_awaiting_cleaning}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Being Cleaned
                </Text>
                <Text size="lg" fw={700} c={s.beds_being_cleaned > 0 ? "primary" : undefined}>
                  {s.beds_being_cleaned}
                </Text>
              </div>
            </SimpleGrid>
          </Card>
        ))}
        {!statsLoading && (stats ?? []).length === 0 && (
          <Text size="sm" c="dimmed">
            No turnaround stats available
          </Text>
        )}
      </SimpleGrid>

      {/* Bed Turnaround Table */}
      <Text size="sm" fw={600}>
        Bed Turnaround Detail
      </Text>
      <DataTable<BedTurnaroundRow>
        columns={bedCols}
        data={beds ?? []}
        loading={bedsLoading}
        rowKey={(r) => r.location_id}
        emptyIcon={<IconBed size={40} />}
        emptyTitle="No bed turnaround data"
      />

      {/* Discharge Pipeline (compact) */}
      <Text size="sm" fw={600}>
        Discharge Pipeline
      </Text>
      <DataTable<PendingDischargeRow>
        columns={dischargeCols}
        data={(pendingDischarges ?? []).sort((a, b) => {
          const da = a.expected_discharge_date
            ? new Date(a.expected_discharge_date).getTime()
            : Number.MAX_SAFE_INTEGER;
          const db = b.expected_discharge_date
            ? new Date(b.expected_discharge_date).getTime()
            : Number.MAX_SAFE_INTEGER;
          return da - db;
        })}
        loading={dischargesLoading}
        rowKey={(r) => r.admission_id}
        emptyIcon={<IconDoorExit size={40} />}
        emptyTitle="No pending discharges"
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 3: Discharge Coordinator
// ══════════════════════════════════════════════════════════

function DischargeCoordinatorTab() {
  const { data: pendingDischarges, isLoading } = useQuery({
    queryKey: ["command-center", "pending-discharges"],
    queryFn: () => commandCenterService.listPendingDischarges(),
    refetchInterval: REFETCH,
  });

  const sorted = [...(pendingDischarges ?? [])].sort((a, b) => {
    const da = a.expected_discharge_date
      ? new Date(a.expected_discharge_date).getTime()
      : Number.MAX_SAFE_INTEGER;
    const db = b.expected_discharge_date
      ? new Date(b.expected_discharge_date).getTime()
      : Number.MAX_SAFE_INTEGER;
    return da - db;
  });

  const cols: Column<PendingDischargeRow>[] = [
    {
      key: "patient",
      label: "Patient",
      render: (r) => (
        <div>
          <Text size="sm" fw={500}>
            {r.patient_name}
          </Text>
          <Text size="xs" c="dimmed">
            {r.uhid}
          </Text>
        </div>
      ),
    },
    { key: "ward", label: "Ward", render: (r) => <Text size="sm">{r.ward_name}</Text> },
    { key: "bed", label: "Bed", render: (r) => <Text size="sm">{r.bed_code}</Text> },
    { key: "doctor", label: "Doctor", render: (r) => <Text size="sm">{r.doctor_name}</Text> },
    {
      key: "admitted",
      label: "Admitted",
      render: (r) => <Text size="xs">{fmtShortDate(r.admitted_at)}</Text>,
    },
    {
      key: "expected",
      label: "Expected Discharge",
      render: (r) => {
        const isOverdue =
          r.expected_discharge_date && new Date(r.expected_discharge_date) < new Date();
        return (
          <Group gap={4}>
            <Text size="sm" c={isOverdue ? "danger" : undefined} fw={isOverdue ? 600 : undefined}>
              {fmtShortDate(r.expected_discharge_date)}
            </Text>
            {isOverdue && (
              <Badge size="xs" tone="danger" variant="filled">
                OVERDUE
              </Badge>
            )}
          </Group>
        );
      },
    },
    {
      key: "days",
      label: "Days",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.days_admitted}
        </Text>
      ),
    },
    {
      key: "blockers",
      label: "Blockers",
      render: (r) => {
        const badges: React.ReactNode[] = [];
        if (r.pending_labs > 0) {
          badges.push(
            <Badge key="labs" size="xs" tone="danger" variant="filled">
              Labs ({r.pending_labs})
            </Badge>,
          );
        }
        if (r.pending_billing) {
          badges.push(
            <Badge key="billing" size="xs" tone="warning" variant="filled">
              Billing
            </Badge>,
          );
        }
        if (r.summary_draft) {
          badges.push(
            <Badge key="summary" size="xs" tone="warning" variant="filled">
              Summary
            </Badge>,
          );
        }
        if (r.checklist_pending > 0) {
          badges.push(
            <Badge key="checklist" size="xs" tone="warning" variant="filled">
              Checklist ({r.checklist_pending})
            </Badge>,
          );
        }
        if (badges.length === 0) {
          return (
            <Badge size="xs" tone="success" variant="light">
              Clear
            </Badge>
          );
        }
        return <Group gap={4}>{badges}</Group>;
      },
    },
  ];

  // Summary stats
  const total = sorted.length;
  const overdue = sorted.filter(
    (r) => r.expected_discharge_date && new Date(r.expected_discharge_date) < new Date(),
  ).length;
  const withBlockers = sorted.filter(
    (r) => r.pending_labs > 0 || r.pending_billing || r.summary_draft || r.checklist_pending > 0,
  ).length;

  return (
    <Stack gap="md">
      {/* Summary Stats */}
      <SimpleGrid cols={4}>
        <StatCard
          label="Total Pending"
          value={total}
          icon={<IconDoorExit size={18} />}
          color="primary"
        />
        <StatCard
          label="Overdue"
          value={overdue}
          icon={<IconAlertTriangle size={18} />}
          color="danger"
        />
        <StatCard
          label="With Blockers"
          value={withBlockers}
          icon={<IconClipboardCheck size={18} />}
          color="orange"
        />
        <StatCard
          label="Ready to Discharge"
          value={total - withBlockers}
          icon={<IconCheck size={18} />}
          color="success"
        />
      </SimpleGrid>

      {/* Pending Discharges Table */}
      <DataTable<PendingDischargeRow>
        columns={cols}
        data={sorted}
        loading={isLoading}
        rowKey={(r) => r.admission_id}
        emptyIcon={<IconDoorExit size={40} />}
        emptyTitle="No pending discharges"
        emptyDescription="All patients have been discharged"
        rowStyle={(r) => {
          if (r.expected_discharge_date && new Date(r.expected_discharge_date) < new Date()) {
            return { backgroundColor: "var(--mantine-color-red-0)" };
          }
          return undefined;
        }}
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 4: Transport
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
    formState: { errors: assignErrors },
    handleSubmit: handleAssignSubmit,
    register: registerAssign,
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
          <TextInput
            label="Patient ID (optional)"
            error={transportErrors.patient_id?.message}
            {...registerTransport("patient_id")}
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
          <TextInput
            label="Assign To (Staff ID)"
            required
            error={assignErrors.assigned_to?.message}
            {...registerAssign("assigned_to")}
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
    register: registerThreshold,
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
          <TextInput
            label="Department ID"
            required
            error={thresholdErrors.department_id?.message}
            {...registerThreshold("department_id")}
            placeholder="Enter department UUID"
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
