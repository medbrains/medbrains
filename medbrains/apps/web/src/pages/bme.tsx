import { useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  NumberInput,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Switch,
  Tooltip,
} from "@mantine/core";
import { BarChart } from "@mantine/charts";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconDeviceDesktopAnalytics,
  IconTool,
  IconFileDescription,
  IconAlertTriangle,
  IconPencil,
  IconCheck,
  IconGauge,
  IconStarFilled,
  IconClock,
  IconChartBar,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  BmeEquipment,
  BmePmSchedule,
  BmeWorkOrder,
  BmeCalibration,
  BmeContract,
  BmeBreakdown,
  BmeVendorEvaluation,
  BmeStatsResponse,
  BmeMtbfRow,
  BmeUptimeRow,
  CreateBmeEquipmentRequest,
  CreateBmePmScheduleRequest,
  CreateBmeWorkOrderRequest,
  CreateBmeCalibrationRequest,
  CreateBmeContractRequest,
  CreateBmeBreakdownRequest,
  UpdateBmeBreakdownStatusRequest,
  UpdateBmeWorkOrderStatusRequest,
  CreateBmeVendorEvaluationRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";
import type { Column } from "../components/DataTable";

// ── Constants ──────────────────────────────────────────

const RISK_CATEGORIES = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const PM_FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annual", label: "Semi-Annual" },
  { value: "annual", label: "Annual" },
];

const WORK_ORDER_TYPES = [
  { value: "preventive", label: "Preventive" },
  { value: "corrective", label: "Corrective" },
  { value: "calibration", label: "Calibration" },
  { value: "installation", label: "Installation" },
  { value: "inspection", label: "Inspection" },
];

const CALIBRATION_STATUSES = [
  { value: "calibrated", label: "Calibrated" },
  { value: "due", label: "Due" },
  { value: "overdue", label: "Overdue" },
  { value: "out_of_tolerance", label: "Out of Tolerance" },
  { value: "exempted", label: "Exempted" },
];

const CONTRACT_TYPES = [
  { value: "amc", label: "AMC" },
  { value: "cmc", label: "CMC" },
  { value: "warranty", label: "Warranty" },
  { value: "camc", label: "CAMC" },
];

const BREAKDOWN_PRIORITIES = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const EQUIPMENT_CATEGORIES = [
  { value: "diagnostic", label: "Diagnostic Equipment" },
  { value: "therapeutic", label: "Therapeutic Equipment" },
  { value: "life_support", label: "Life Support" },
  { value: "imaging", label: "Imaging Equipment" },
  { value: "laboratory", label: "Laboratory Equipment" },
  { value: "surgical", label: "Surgical Equipment" },
  { value: "monitoring", label: "Monitoring Equipment" },
  { value: "dental", label: "Dental Equipment" },
  { value: "physiotherapy", label: "Physiotherapy Equipment" },
  { value: "dialysis", label: "Dialysis Equipment" },
  { value: "ophthalmic", label: "Ophthalmic Equipment" },
  { value: "ent", label: "ENT Equipment" },
  { value: "sterilization", label: "Sterilization Equipment" },
  { value: "other", label: "Other" },
];

// ── Badge helpers ──────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: "success", under_maintenance: "warning", out_of_service: "orange",
    condemned: "danger", disposed: "slate",
  };
  return <Badge color={map[status] ?? "slate"} variant="light" size="sm">{status.replace(/_/g, " ")}</Badge>;
}

function riskBadge(risk: string) {
  const map: Record<string, string> = { critical: "danger", high: "orange", medium: "warning", low: "success" };
  return <Badge color={map[risk] ?? "slate"} variant="light" size="sm">{risk}</Badge>;
}

function priorityBadge(p: string) {
  const map: Record<string, string> = { critical: "danger", high: "orange", medium: "warning", low: "primary" };
  return <Badge color={map[p] ?? "slate"} variant="light" size="sm">{p}</Badge>;
}

function calStatusBadge(s: string) {
  const map: Record<string, string> = {
    calibrated: "success", due: "warning", overdue: "danger",
    out_of_tolerance: "danger", exempted: "slate",
  };
  return <Badge color={map[s] ?? "slate"} variant="light" size="sm">{s.replace(/_/g, " ")}</Badge>;
}

function breakdownStatusBadge(s: string) {
  const map: Record<string, string> = {
    reported: "danger", acknowledged: "warning", in_progress: "primary",
    parts_awaited: "orange", resolved: "success", closed: "slate",
  };
  return <Badge color={map[s] ?? "slate"} variant="light" size="sm">{s.replace(/_/g, " ")}</Badge>;
}

function contractTypeBadge(t: string) {
  const map: Record<string, string> = { amc: "primary", cmc: "violet", warranty: "success", camc: "teal" };
  return <Badge color={map[t] ?? "slate"} variant="light" size="sm">{t.toUpperCase()}</Badge>;
}

function woStatusBadge(s: string) {
  const map: Record<string, string> = {
    open: "primary", assigned: "warning", in_progress: "orange",
    completed: "success", cancelled: "slate",
  };
  return <Badge color={map[s] ?? "slate"} variant="light" size="sm">{s.replace(/_/g, " ")}</Badge>;
}

// ── Helpers ────────────────────────────────────────────

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString();
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// ══════════════════════════════════════════════════════════
//  Equipment Tab
// ══════════════════════════════════════════════════════════

function EquipmentTab() {
  const canCreate = useHasPermission(P.BME.EQUIPMENT_CREATE);
  const canUpdate = useHasPermission(P.BME.EQUIPMENT_UPDATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [editItem, setEditItem] = useState<BmeEquipment | null>(null);
  const [form, setForm] = useState<CreateBmeEquipmentRequest>({ name: "" });

  const { data = [], isLoading } = useQuery({
    queryKey: ["bme-equipment"],
    queryFn: () => api.listBmeEquipment(),
  });

  const createMut = useMutation({
    mutationFn: (body: CreateBmeEquipmentRequest) => api.createBmeEquipment(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bme-equipment"] }); close(); notifications.show({ message: "Equipment created" }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.updateBmeEquipment(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bme-equipment"] }); close(); setEditItem(null); notifications.show({ message: "Equipment updated" }); },
  });

  function openCreate() { setEditItem(null); setForm({ name: "" }); open(); }
  function openEdit(item: BmeEquipment) {
    setEditItem(item);
    setForm({ name: item.name, make: item.make ?? undefined, model: item.model ?? undefined, serial_number: item.serial_number ?? undefined, asset_tag: item.asset_tag ?? undefined, category: item.category ?? undefined, risk_category: item.risk_category, is_critical: item.is_critical, department_id: item.department_id ?? undefined, vendor_id: item.vendor_id ?? undefined, notes: item.notes ?? undefined });
    open();
  }

  function handleSubmit() {
    if (editItem) { updateMut.mutate({ id: editItem.id, body: form as unknown as Record<string, unknown> }); }
    else { createMut.mutate(form); }
  }

  const columns: Column<BmeEquipment>[] = [
    { key: "name", label: "Name", render: (r) => <Text fw={500} size="sm">{r.name}</Text> },
    { key: "make_model", label: "Make / Model", render: (r) => <Text size="sm">{[r.make, r.model].filter(Boolean).join(" / ") || "—"}</Text> },
    { key: "serial_number", label: "Serial #", render: (r) => <Text size="sm">{r.serial_number ?? "—"}</Text> },
    { key: "asset_tag", label: "Asset Tag", render: (r) => <Text size="sm">{r.asset_tag ?? "—"}</Text> },
    { key: "risk_category", label: "Risk", render: (r) => riskBadge(r.risk_category) },
    { key: "status", label: "Status", render: (r) => statusBadge(r.status) },
    { key: "warranty_end", label: "Warranty Until", render: (r) => <Text size="sm">{fmtDate(r.warranty_end_date)}</Text> },
    { key: "actions", label: "", render: (r) => canUpdate ? (
      <Tooltip label="Edit"><ActionIcon variant="subtle" size="sm" onClick={() => openEdit(r)}><IconPencil size={16} /></ActionIcon></Tooltip>
    ) : null },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Add Equipment</Button>}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer opened={opened} onClose={close} title={editItem ? "Edit Equipment" : "Add Equipment"} position="right" size="lg">
        <Stack>
          <TextInput label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Group grow>
            <TextInput label="Make" value={form.make ?? ""} onChange={(e) => setForm({ ...form, make: e.target.value })} />
            <TextInput label="Model" value={form.model ?? ""} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </Group>
          <Group grow>
            <TextInput label="Serial Number" value={form.serial_number ?? ""} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
            <TextInput label="Asset Tag" value={form.asset_tag ?? ""} onChange={(e) => setForm({ ...form, asset_tag: e.target.value })} />
          </Group>
          <Group grow>
            <Select label="Category" data={EQUIPMENT_CATEGORIES} value={form.category ?? null} onChange={(v) => setForm({ ...form, category: v || undefined })} clearable searchable />
            <Select label="Risk Category" data={RISK_CATEGORIES} value={form.risk_category ?? "medium"} onChange={(v) => setForm({ ...form, risk_category: (v ?? "medium") as CreateBmeEquipmentRequest["risk_category"] })} />
          </Group>
          <Switch label="Critical Equipment" checked={form.is_critical ?? false} onChange={(e) => setForm({ ...form, is_critical: e.currentTarget.checked })} />
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <Button onClick={handleSubmit} loading={createMut.isPending || updateMut.isPending}>{editItem ? "Update" : "Create"}</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  PM & Work Orders Tab
// ══════════════════════════════════════════════════════════

function PmTab() {
  const canManage = useHasPermission(P.BME.PM_MANAGE);
  const qc = useQueryClient();
  const [pmOpened, { open: openPm, close: closePm }] = useDisclosure(false);
  const [woOpened, { open: openWo, close: closeWo }] = useDisclosure(false);
  const [pmForm, setPmForm] = useState<CreateBmePmScheduleRequest>({ equipment_id: "", frequency: "quarterly" });
  const [woForm, setWoForm] = useState<CreateBmeWorkOrderRequest>({ equipment_id: "", order_type: "preventive" });

  const { data: schedules = [], isLoading: loadingPm } = useQuery({
    queryKey: ["bme-pm-schedules"],
    queryFn: () => api.listBmePmSchedules(),
  });

  const { data: workOrders = [], isLoading: loadingWo } = useQuery({
    queryKey: ["bme-work-orders"],
    queryFn: () => api.listBmeWorkOrders(),
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["bme-equipment"],
    queryFn: () => api.listBmeEquipment(),
  });

  const { data: stats } = useQuery<BmeStatsResponse>({
    queryKey: ["bme-stats"],
    queryFn: () => api.getBmeStats(),
  });

  const equipOptions = equipment.map((e) => ({ value: e.id, label: `${e.name} (${e.asset_tag ?? e.serial_number ?? "—"})` }));

  const createPmMut = useMutation({
    mutationFn: (body: CreateBmePmScheduleRequest) => api.createBmePmSchedule(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bme-pm-schedules"] }); closePm(); notifications.show({ message: "PM schedule created" }); },
  });

  const createWoMut = useMutation({
    mutationFn: (body: CreateBmeWorkOrderRequest) => api.createBmeWorkOrder(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bme-work-orders"] }); closeWo(); notifications.show({ message: "Work order created" }); },
  });

  const updateWoMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateBmeWorkOrderStatusRequest }) => api.updateBmeWorkOrderStatus(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bme-work-orders"] }); qc.invalidateQueries({ queryKey: ["bme-pm-schedules"] }); qc.invalidateQueries({ queryKey: ["bme-stats"] }); notifications.show({ message: "Work order updated" }); },
  });

  const pmColumns: Column<BmePmSchedule>[] = [
    { key: "equipment", label: "Equipment", render: (r) => <Text size="sm">{equipment.find((e) => e.id === r.equipment_id)?.name ?? r.equipment_id}</Text> },
    { key: "frequency", label: "Frequency", render: (r) => <Badge variant="light" size="sm">{r.frequency.replace(/_/g, " ")}</Badge> },
    { key: "next_due", label: "Next Due", render: (r) => {
      const overdue = r.next_due_date && new Date(r.next_due_date) < new Date();
      return <Text size="sm" c={overdue ? "danger" : undefined} fw={overdue ? 700 : undefined}>{fmtDate(r.next_due_date)}</Text>;
    }},
    { key: "last_completed", label: "Last Done", render: (r) => <Text size="sm">{fmtDate(r.last_completed_date)}</Text> },
    { key: "active", label: "Active", render: (r) => r.is_active ? <Badge color="success" size="sm">Yes</Badge> : <Badge color="slate" size="sm">No</Badge> },
  ];

  const woColumns: Column<BmeWorkOrder>[] = [
    { key: "wo_number", label: "WO #", render: (r) => <Text size="sm" fw={500}>{r.work_order_number}</Text> },
    { key: "equipment", label: "Equipment", render: (r) => <Text size="sm">{equipment.find((e) => e.id === r.equipment_id)?.name ?? "—"}</Text> },
    { key: "type", label: "Type", render: (r) => <Badge variant="light" size="sm">{r.order_type}</Badge> },
    { key: "priority", label: "Priority", render: (r) => priorityBadge(r.priority) },
    { key: "status", label: "Status", render: (r) => woStatusBadge(r.status) },
    { key: "scheduled", label: "Scheduled", render: (r) => <Text size="sm">{fmtDate(r.scheduled_date)}</Text> },
    { key: "actions", label: "", render: (r) => canManage && r.status !== "completed" && r.status !== "cancelled" ? (
      <Tooltip label="Mark Completed">
        <ActionIcon variant="subtle" color="success" size="sm" onClick={() => updateWoMut.mutate({ id: r.id, body: { status: "completed" } })}>
          <IconCheck size={16} />
        </ActionIcon>
      </Tooltip>
    ) : null },
  ];

  const pmCompliance = useMemo(() => {
    const now = new Date();
    const total = schedules.filter((s) => s.is_active).length;
    const overdue = schedules.filter((s) => s.is_active && s.next_due_date && new Date(s.next_due_date) < now).length;
    const completedOnTime = schedules.filter((s) => s.is_active && s.last_completed_date).length;
    const complianceRate = total > 0 ? Math.round((completedOnTime / total) * 100) : 0;

    // Build last 6 months bar chart data from work orders
    const months: { month: string; scheduled: number; completed: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = monthLabel(d);
      const monthStart = d.getTime();
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();
      const scheduledCount = workOrders.filter((wo) => wo.order_type === "preventive" && wo.scheduled_date && new Date(wo.scheduled_date).getTime() >= monthStart && new Date(wo.scheduled_date).getTime() <= monthEnd).length;
      const completedCount = workOrders.filter((wo) => wo.order_type === "preventive" && wo.status === "completed" && wo.completed_at && new Date(wo.completed_at).getTime() >= monthStart && new Date(wo.completed_at).getTime() <= monthEnd).length;
      months.push({ month: label, scheduled: scheduledCount, completed: completedCount });
    }
    return { total, overdue, completedOnTime, complianceRate, months };
  }, [schedules, workOrders]);

  return (
    <Stack>
      {stats && (
        <SimpleGrid cols={{ base: 2, sm: 3 }}>
          <Card withBorder p="sm"><Text size="xs" c="dimmed">PM Overdue</Text><Text size="xl" fw={700} c={stats.pm_overdue > 0 ? "danger" : "success"}>{stats.pm_overdue}</Text></Card>
          <Card withBorder p="sm"><Text size="xs" c="dimmed">Open Breakdowns</Text><Text size="xl" fw={700} c={stats.open_breakdowns > 0 ? "orange" : "success"}>{stats.open_breakdowns}</Text></Card>
          <Card withBorder p="sm"><Text size="xs" c="dimmed">Expiring Contracts</Text><Text size="xl" fw={700} c={stats.expiring_contracts > 0 ? "warning" : "success"}>{stats.expiring_contracts}</Text></Card>
        </SimpleGrid>
      )}

      <Card withBorder p="md">
        <Text fw={600} size="lg" mb="sm">PM Compliance Dashboard</Text>
        <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
          <Card withBorder p="sm" bg="blue.0">
            <Text size="xs" c="dimmed">Total Scheduled</Text>
            <Text size="xl" fw={700}>{pmCompliance.total}</Text>
          </Card>
          <Card withBorder p="sm" bg="green.0">
            <Text size="xs" c="dimmed">Completed On Time</Text>
            <Text size="xl" fw={700} c="success">{pmCompliance.completedOnTime}</Text>
          </Card>
          <Card withBorder p="sm" bg="red.0">
            <Text size="xs" c="dimmed">Overdue</Text>
            <Text size="xl" fw={700} c="danger">{pmCompliance.overdue}</Text>
          </Card>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">Compliance Rate</Text>
            <Text size="xl" fw={700} c={pmCompliance.complianceRate >= 80 ? "success" : pmCompliance.complianceRate >= 50 ? "warning" : "danger"}>
              {pmCompliance.complianceRate}%
            </Text>
            <Progress value={pmCompliance.complianceRate} color={pmCompliance.complianceRate >= 80 ? "success" : pmCompliance.complianceRate >= 50 ? "warning" : "danger"} size="sm" mt={4} />
          </Card>
        </SimpleGrid>
        {pmCompliance.months.some((m) => m.scheduled > 0 || m.completed > 0) && (
          <>
            <Text size="sm" fw={500} mb="xs">Scheduled vs Completed PMs (Last 6 Months)</Text>
            <BarChart
              h={250}
              data={pmCompliance.months}
              dataKey="month"
              series={[
                { name: "scheduled", color: "blue.6", label: "Scheduled" },
                { name: "completed", color: "green.6", label: "Completed" },
              ]}
              withLegend
              withTooltip
            />
          </>
        )}
      </Card>

      <Text fw={600} size="lg">PM Schedules</Text>
      <Group justify="flex-end">
        {canManage && <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => { setPmForm({ equipment_id: "", frequency: "quarterly" }); openPm(); }}>Add PM Schedule</Button>}
      </Group>
      <DataTable columns={pmColumns} data={schedules} loading={loadingPm} rowKey={(r) => r.id} />

      <Text fw={600} size="lg" mt="md">Work Orders</Text>
      <Group justify="flex-end">
        {canManage && <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => { setWoForm({ equipment_id: "", order_type: "preventive" }); openWo(); }}>Create Work Order</Button>}
      </Group>
      <DataTable columns={woColumns} data={workOrders} loading={loadingWo} rowKey={(r) => r.id} />

      <Drawer opened={pmOpened} onClose={closePm} title="Add PM Schedule" position="right" size="md">
        <Stack>
          <Select label="Equipment" required data={equipOptions} value={pmForm.equipment_id} onChange={(v) => setPmForm({ ...pmForm, equipment_id: v ?? "" })} searchable />
          <Select label="Frequency" required data={PM_FREQUENCIES} value={pmForm.frequency} onChange={(v) => setPmForm({ ...pmForm, frequency: (v ?? "quarterly") as CreateBmePmScheduleRequest["frequency"] })} />
          <DateInput label="Next Due Date" value={pmForm.next_due_date ?? null} onChange={(d) => setPmForm({ ...pmForm, next_due_date: d?.slice(0, 10) })} />
          <Textarea label="Notes" value={pmForm.notes ?? ""} onChange={(e) => setPmForm({ ...pmForm, notes: e.target.value })} />
          <Button onClick={() => createPmMut.mutate(pmForm)} loading={createPmMut.isPending}>Create</Button>
        </Stack>
      </Drawer>

      <Drawer opened={woOpened} onClose={closeWo} title="Create Work Order" position="right" size="md">
        <Stack>
          <Select label="Equipment" required data={equipOptions} value={woForm.equipment_id} onChange={(v) => setWoForm({ ...woForm, equipment_id: v ?? "" })} searchable />
          <Select label="Type" required data={WORK_ORDER_TYPES} value={woForm.order_type} onChange={(v) => setWoForm({ ...woForm, order_type: (v ?? "preventive") as CreateBmeWorkOrderRequest["order_type"] })} />
          <Select label="Priority" data={BREAKDOWN_PRIORITIES} value={woForm.priority ?? "medium"} onChange={(v) => setWoForm({ ...woForm, priority: (v ?? "medium") as CreateBmeWorkOrderRequest["priority"] })} />
          <DateInput label="Scheduled Date" value={woForm.scheduled_date ?? null} onChange={(d) => setWoForm({ ...woForm, scheduled_date: d?.slice(0, 10) })} />
          <Textarea label="Description" value={woForm.description ?? ""} onChange={(e) => setWoForm({ ...woForm, description: e.target.value })} />
          <Button onClick={() => createWoMut.mutate(woForm)} loading={createWoMut.isPending}>Create</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Calibration Tab
// ══════════════════════════════════════════════════════════

function CalibrationTab() {
  const canManage = useHasPermission(P.BME.CALIBRATION_MANAGE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<CreateBmeCalibrationRequest>({ equipment_id: "" });

  const { data = [], isLoading } = useQuery({
    queryKey: ["bme-calibrations"],
    queryFn: () => api.listBmeCalibrations(),
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["bme-equipment"],
    queryFn: () => api.listBmeEquipment(),
  });
  const equipOptions = equipment.map((e) => ({ value: e.id, label: `${e.name} (${e.asset_tag ?? e.serial_number ?? "—"})` }));

  const createMut = useMutation({
    mutationFn: (body: CreateBmeCalibrationRequest) => api.createBmeCalibration(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bme-calibrations"] }); close(); notifications.show({ message: "Calibration recorded" }); },
  });

  const calibrationAlerts = useMemo(() => {
    const items = data
      .filter((c) => c.next_due_date && daysUntil(c.next_due_date) <= 30)
      .map((c) => ({
        ...c,
        equipName: equipment.find((e) => e.id === c.equipment_id)?.name ?? c.equipment_id,
        daysLeft: daysUntil(c.next_due_date!),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft);
    return items;
  }, [data, equipment]);

  const columns: Column<BmeCalibration>[] = [
    { key: "equipment", label: "Equipment", render: (r) => <Text size="sm">{equipment.find((e) => e.id === r.equipment_id)?.name ?? "—"}</Text> },
    { key: "status", label: "Status", render: (r) => calStatusBadge(r.calibration_status) },
    { key: "frequency", label: "Frequency", render: (r) => <Badge variant="light" size="sm">{r.frequency.replace(/_/g, " ")}</Badge> },
    { key: "last_cal", label: "Last Calibrated", render: (r) => <Text size="sm">{fmtDate(r.last_calibrated_date)}</Text> },
    { key: "next_due", label: "Next Due", render: (r) => {
      const overdue = r.next_due_date && new Date(r.next_due_date) < new Date();
      return <Text size="sm" c={overdue ? "danger" : undefined} fw={overdue ? 700 : undefined}>{fmtDate(r.next_due_date)}</Text>;
    }},
    { key: "tolerance", label: "In Tolerance", render: (r) => r.is_in_tolerance === true ? <Badge color="success" size="sm">Yes</Badge> : r.is_in_tolerance === false ? <Badge color="danger" size="sm">No</Badge> : <Text size="sm">—</Text> },
    { key: "certificate", label: "Certificate #", render: (r) => <Text size="sm">{r.certificate_number ?? "—"}</Text> },
    { key: "locked", label: "Locked", render: (r) => r.is_locked ? <Badge color="danger" size="sm">Locked</Badge> : null },
  ];

  return (
    <Stack>
      {calibrationAlerts.length > 0 && (
        <Alert
          variant="light"
          color={calibrationAlerts.some((a) => a.daysLeft < 0) ? "danger" : "warning"}
          title={`${calibrationAlerts.length} Calibration${calibrationAlerts.length > 1 ? "s" : ""} Due Soon`}
          icon={<IconAlertTriangle size={20} />}
        >
          <Stack gap={4}>
            {calibrationAlerts.map((a) => (
              <Group key={a.id} gap="xs">
                <Text size="sm" fw={500}>{a.equipName}</Text>
                {a.daysLeft < 0 ? (
                  <Badge color="danger" size="sm" variant="filled">OVERDUE by {Math.abs(a.daysLeft)}d</Badge>
                ) : (
                  <Badge color="warning" size="sm" leftSection={<IconClock size={12} />}>Due in {a.daysLeft}d</Badge>
                )}
                <Text size="xs" c="dimmed">({fmtDate(a.next_due_date)})</Text>
              </Group>
            ))}
          </Stack>
        </Alert>
      )}

      <Group justify="flex-end">
        {canManage && <Button leftSection={<IconPlus size={16} />} onClick={() => { setForm({ equipment_id: "" }); open(); }}>Record Calibration</Button>}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer opened={opened} onClose={close} title="Record Calibration" position="right" size="md">
        <Stack>
          <Select label="Equipment" required data={equipOptions} value={form.equipment_id} onChange={(v) => setForm({ ...form, equipment_id: v ?? "" })} searchable />
          <Select label="Status" data={CALIBRATION_STATUSES} value={form.calibration_status ?? "calibrated"} onChange={(v) => setForm({ ...form, calibration_status: (v ?? "calibrated") as CreateBmeCalibrationRequest["calibration_status"] })} />
          <Select label="Frequency" data={PM_FREQUENCIES} value={form.frequency ?? "annual"} onChange={(v) => setForm({ ...form, frequency: (v ?? "annual") as CreateBmeCalibrationRequest["frequency"] })} />
          <DateInput label="Calibrated On" value={form.last_calibrated_date ?? null} onChange={(d) => setForm({ ...form, last_calibrated_date: d?.slice(0, 10) })} />
          <DateInput label="Next Due" value={form.next_due_date ?? null} onChange={(d) => setForm({ ...form, next_due_date: d?.slice(0, 10) })} />
          <TextInput label="Calibrated By" value={form.calibrated_by ?? ""} onChange={(e) => setForm({ ...form, calibrated_by: e.target.value })} />
          <TextInput label="Certificate Number" value={form.certificate_number ?? ""} onChange={(e) => setForm({ ...form, certificate_number: e.target.value })} />
          <TextInput label="Reference Standard" value={form.reference_standard ?? ""} onChange={(e) => setForm({ ...form, reference_standard: e.target.value })} />
          <Switch label="In Tolerance" checked={form.is_in_tolerance ?? true} onChange={(e) => setForm({ ...form, is_in_tolerance: e.currentTarget.checked })} />
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <Button onClick={() => createMut.mutate(form)} loading={createMut.isPending}>Save</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Contracts Tab
// ══════════════════════════════════════════════════════════

function ContractsTab() {
  const canManage = useHasPermission(P.BME.CONTRACTS_MANAGE);
  const canEval = useHasPermission(P.BME.EVALUATIONS_MANAGE);
  const qc = useQueryClient();
  const [contractOpened, { open: openContract, close: closeContract }] = useDisclosure(false);
  const [evalOpened, { open: openEval, close: closeEval }] = useDisclosure(false);
  const [contractForm, setContractForm] = useState<CreateBmeContractRequest>({ contract_number: "", equipment_id: "", contract_type: "amc", vendor_id: "", start_date: "", end_date: "" });
  const [evalForm, setEvalForm] = useState<CreateBmeVendorEvaluationRequest>({ vendor_id: "", evaluation_date: "" });

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["bme-contracts"],
    queryFn: () => api.listBmeContracts(),
  });

  const { data: evaluations = [], isLoading: loadingEvals } = useQuery({
    queryKey: ["bme-vendor-evaluations"],
    queryFn: () => api.listBmeVendorEvaluations(),
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["bme-equipment"],
    queryFn: () => api.listBmeEquipment(),
  });
  const equipOptions = equipment.map((e) => ({ value: e.id, label: `${e.name} (${e.asset_tag ?? "—"})` }));

  const createContractMut = useMutation({
    mutationFn: (body: CreateBmeContractRequest) => api.createBmeContract(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bme-contracts"] }); closeContract(); notifications.show({ message: "Contract created" }); },
  });

  const createEvalMut = useMutation({
    mutationFn: (body: CreateBmeVendorEvaluationRequest) => api.createBmeVendorEvaluation(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bme-vendor-evaluations"] }); closeEval(); notifications.show({ message: "Evaluation saved" }); },
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ["bme-work-orders"],
    queryFn: () => api.listBmeWorkOrders(),
  });

  const contractRenewalAlerts = useMemo(() => {
    return contracts
      .filter((c) => c.is_active)
      .map((c) => {
        const days = daysUntil(c.end_date);
        const alertThreshold = c.renewal_alert_days > 0 ? c.renewal_alert_days : 60;
        return { ...c, daysLeft: days, alertThreshold, equipName: equipment.find((e) => e.id === c.equipment_id)?.name ?? c.equipment_id };
      })
      .filter((c) => c.daysLeft <= c.alertThreshold)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [contracts, equipment]);

  const costAnalysis = useMemo(() => {
    return contracts
      .filter((c) => c.contract_value && c.contract_value > 0)
      .map((c) => {
        const equipName = equipment.find((e) => e.id === c.equipment_id)?.name ?? "—";
        const contractValue = Number(c.contract_value);
        const totalWoCost = workOrders
          .filter((wo) => wo.equipment_id === c.equipment_id && wo.total_cost)
          .reduce((sum, wo) => sum + Number(wo.total_cost), 0);
        const utilization = contractValue > 0 ? Math.round((totalWoCost / contractValue) * 100) : 0;
        return { id: c.id, equipName, contractNumber: c.contract_number, contractType: c.contract_type, contractValue, totalWoCost, utilization };
      });
  }, [contracts, equipment, workOrders]);

  const contractColumns: Column<BmeContract>[] = [
    { key: "number", label: "Contract #", render: (r) => <Text fw={500} size="sm">{r.contract_number}</Text> },
    { key: "equipment", label: "Equipment", render: (r) => <Text size="sm">{equipment.find((e) => e.id === r.equipment_id)?.name ?? "—"}</Text> },
    { key: "type", label: "Type", render: (r) => contractTypeBadge(r.contract_type) },
    { key: "validity", label: "Validity", render: (r) => <Text size="sm">{fmtDate(r.start_date)} — {fmtDate(r.end_date)}</Text> },
    { key: "value", label: "Value", render: (r) => <Text size="sm">{r.contract_value ? `₹${Number(r.contract_value).toLocaleString()}` : "—"}</Text> },
    { key: "expiry", label: "Expiry", render: (r) => {
      const daysLeft = Math.ceil((new Date(r.end_date).getTime() - Date.now()) / 86400000);
      if (daysLeft < 0) return <Badge color="danger" size="sm">Expired</Badge>;
      if (daysLeft <= 30) return <Badge color="danger" size="sm">{daysLeft}d left</Badge>;
      if (daysLeft <= 90) return <Badge color="warning" size="sm">{daysLeft}d left</Badge>;
      return <Badge color="success" size="sm">{daysLeft}d left</Badge>;
    }},
    { key: "active", label: "Active", render: (r) => r.is_active ? <Badge color="success" size="sm">Yes</Badge> : <Badge color="slate" size="sm">No</Badge> },
  ];

  const evalColumns: Column<BmeVendorEvaluation>[] = [
    { key: "date", label: "Date", render: (r) => <Text size="sm">{fmtDate(r.evaluation_date)}</Text> },
    { key: "period", label: "Period", render: (r) => <Text size="sm">{fmtDate(r.period_from)} — {fmtDate(r.period_to)}</Text> },
    { key: "overall", label: "Overall Score", render: (r) => r.overall_score ? (
      <Group gap={4}><IconStarFilled size={14} color="orange" /><Text size="sm" fw={600}>{Number(r.overall_score).toFixed(1)}/5</Text></Group>
    ) : <Text size="sm">—</Text> },
    { key: "sla", label: "SLA Compliance", render: (r) => r.total_calls ? (
      <Text size="sm">{r.calls_within_sla ?? 0}/{r.total_calls} ({Math.round(((r.calls_within_sla ?? 0) / r.total_calls) * 100)}%)</Text>
    ) : <Text size="sm">—</Text> },
    { key: "comments", label: "Comments", render: (r) => <Text size="sm" lineClamp={1}>{r.comments ?? "—"}</Text> },
  ];

  return (
    <Stack>
      {contractRenewalAlerts.length > 0 && (
        <Alert
          variant="light"
          color={contractRenewalAlerts.some((c) => c.daysLeft < 0) ? "danger" : "warning"}
          title={`${contractRenewalAlerts.length} Contract${contractRenewalAlerts.length > 1 ? "s" : ""} Expiring Soon`}
          icon={<IconAlertTriangle size={20} />}
        >
          <Stack gap={4}>
            {contractRenewalAlerts.map((c) => (
              <Group key={c.id} gap="xs">
                <Text size="sm" fw={500}>{c.equipName}</Text>
                <Badge variant="light" size="sm">{c.contract_type.toUpperCase()}</Badge>
                <Text size="xs" c="dimmed">#{c.contract_number}</Text>
                {c.daysLeft < 0 ? (
                  <Badge color="danger" size="sm" variant="filled">EXPIRED {Math.abs(c.daysLeft)}d ago</Badge>
                ) : (
                  <Badge color="warning" size="sm" leftSection={<IconClock size={12} />}>Expires in {c.daysLeft}d</Badge>
                )}
              </Group>
            ))}
          </Stack>
        </Alert>
      )}

      {costAnalysis.length > 0 && (
        <Card withBorder p="md">
          <Text fw={600} size="lg" mb="sm">Cost vs Contract Value Analysis</Text>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Equipment</Table.Th>
                <Table.Th>Contract #</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th ta="right">Contract Value</Table.Th>
                <Table.Th ta="right">Total WO Cost</Table.Th>
                <Table.Th ta="right">Utilization</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {costAnalysis.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td><Text size="sm" fw={500}>{row.equipName}</Text></Table.Td>
                  <Table.Td><Text size="sm">{row.contractNumber}</Text></Table.Td>
                  <Table.Td>{contractTypeBadge(row.contractType)}</Table.Td>
                  <Table.Td ta="right"><Text size="sm">{`\u20B9${row.contractValue.toLocaleString()}`}</Text></Table.Td>
                  <Table.Td ta="right"><Text size="sm">{`\u20B9${row.totalWoCost.toLocaleString()}`}</Text></Table.Td>
                  <Table.Td ta="right">
                    <Badge color={row.utilization > 100 ? "danger" : row.utilization > 80 ? "warning" : "success"} variant="light" size="sm">
                      {row.utilization}%
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      <Text fw={600} size="lg">Service Contracts</Text>
      <Group justify="flex-end">
        {canManage && <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => { setContractForm({ contract_number: "", equipment_id: "", contract_type: "amc", vendor_id: "", start_date: "", end_date: "" }); openContract(); }}>Add Contract</Button>}
      </Group>
      <DataTable columns={contractColumns} data={contracts} loading={isLoading} rowKey={(r) => r.id} />

      <Text fw={600} size="lg" mt="md">Vendor Evaluations</Text>
      <Group justify="flex-end">
        {canEval && <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => { setEvalForm({ vendor_id: "", evaluation_date: "" }); openEval(); }}>Add Evaluation</Button>}
      </Group>
      <DataTable columns={evalColumns} data={evaluations} loading={loadingEvals} rowKey={(r) => r.id} />

      <Drawer opened={contractOpened} onClose={closeContract} title="Add Contract" position="right" size="lg">
        <Stack>
          <TextInput label="Contract Number" required value={contractForm.contract_number} onChange={(e) => setContractForm({ ...contractForm, contract_number: e.target.value })} />
          <Select label="Equipment" required data={equipOptions} value={contractForm.equipment_id} onChange={(v) => setContractForm({ ...contractForm, equipment_id: v ?? "" })} searchable />
          <Select label="Contract Type" required data={CONTRACT_TYPES} value={contractForm.contract_type} onChange={(v) => setContractForm({ ...contractForm, contract_type: (v ?? "amc") as CreateBmeContractRequest["contract_type"] })} />
          <TextInput label="Vendor ID" required value={contractForm.vendor_id} onChange={(e) => setContractForm({ ...contractForm, vendor_id: e.target.value })} />
          <Group grow>
            <DateInput label="Start Date" required value={contractForm.start_date || null} onChange={(d) => setContractForm({ ...contractForm, start_date: d?.slice(0, 10) ?? "" })} />
            <DateInput label="End Date" required value={contractForm.end_date || null} onChange={(d) => setContractForm({ ...contractForm, end_date: d?.slice(0, 10) ?? "" })} />
          </Group>
          <NumberInput label="Contract Value (₹)" value={contractForm.contract_value ?? ""} onChange={(v) => setContractForm({ ...contractForm, contract_value: typeof v === "number" ? v : undefined })} />
          <Textarea label="Coverage Details" value={contractForm.coverage_details ?? ""} onChange={(e) => setContractForm({ ...contractForm, coverage_details: e.target.value })} />
          <Textarea label="Exclusions" value={contractForm.exclusions ?? ""} onChange={(e) => setContractForm({ ...contractForm, exclusions: e.target.value })} />
          <Group grow>
            <NumberInput label="SLA Response (hrs)" value={contractForm.sla_response_hours ?? ""} onChange={(v) => setContractForm({ ...contractForm, sla_response_hours: typeof v === "number" ? v : undefined })} />
            <NumberInput label="SLA Resolution (hrs)" value={contractForm.sla_resolution_hours ?? ""} onChange={(v) => setContractForm({ ...contractForm, sla_resolution_hours: typeof v === "number" ? v : undefined })} />
          </Group>
          <Button onClick={() => createContractMut.mutate(contractForm)} loading={createContractMut.isPending}>Create</Button>
        </Stack>
      </Drawer>

      <Drawer opened={evalOpened} onClose={closeEval} title="Vendor Evaluation" position="right" size="md">
        <Stack>
          <TextInput label="Vendor ID" required value={evalForm.vendor_id} onChange={(e) => setEvalForm({ ...evalForm, vendor_id: e.target.value })} />
          <DateInput label="Evaluation Date" required value={evalForm.evaluation_date || null} onChange={(d) => setEvalForm({ ...evalForm, evaluation_date: d?.slice(0, 10) ?? "" })} />
          <Group grow>
            <NumberInput label="Response Time (1-5)" min={1} max={5} value={evalForm.response_time_score ?? ""} onChange={(v) => setEvalForm({ ...evalForm, response_time_score: typeof v === "number" ? v : undefined })} />
            <NumberInput label="Resolution Quality (1-5)" min={1} max={5} value={evalForm.resolution_quality_score ?? ""} onChange={(v) => setEvalForm({ ...evalForm, resolution_quality_score: typeof v === "number" ? v : undefined })} />
          </Group>
          <Group grow>
            <NumberInput label="Spare Parts (1-5)" min={1} max={5} value={evalForm.spare_parts_availability_score ?? ""} onChange={(v) => setEvalForm({ ...evalForm, spare_parts_availability_score: typeof v === "number" ? v : undefined })} />
            <NumberInput label="Professionalism (1-5)" min={1} max={5} value={evalForm.professionalism_score ?? ""} onChange={(v) => setEvalForm({ ...evalForm, professionalism_score: typeof v === "number" ? v : undefined })} />
          </Group>
          <NumberInput label="Overall Score" min={1} max={5} decimalScale={1} value={evalForm.overall_score ?? ""} onChange={(v) => setEvalForm({ ...evalForm, overall_score: typeof v === "number" ? v : undefined })} />
          <Group grow>
            <NumberInput label="Total Calls" value={evalForm.total_calls ?? ""} onChange={(v) => setEvalForm({ ...evalForm, total_calls: typeof v === "number" ? v : undefined })} />
            <NumberInput label="Calls within SLA" value={evalForm.calls_within_sla ?? ""} onChange={(v) => setEvalForm({ ...evalForm, calls_within_sla: typeof v === "number" ? v : undefined })} />
          </Group>
          <Textarea label="Comments" value={evalForm.comments ?? ""} onChange={(e) => setEvalForm({ ...evalForm, comments: e.target.value })} />
          <Button onClick={() => createEvalMut.mutate(evalForm)} loading={createEvalMut.isPending}>Save</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Breakdowns Tab
// ══════════════════════════════════════════════════════════

function BreakdownsTab() {
  const canCreate = useHasPermission(P.BME.BREAKDOWNS_CREATE);
  const canManage = useHasPermission(P.BME.BREAKDOWNS_MANAGE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<CreateBmeBreakdownRequest>({ equipment_id: "", description: "" });

  const { data = [], isLoading } = useQuery({
    queryKey: ["bme-breakdowns"],
    queryFn: () => api.listBmeBreakdowns(),
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["bme-equipment"],
    queryFn: () => api.listBmeEquipment(),
  });
  const equipOptions = equipment.map((e) => ({ value: e.id, label: `${e.name} (${e.asset_tag ?? "—"})` }));

  const createMut = useMutation({
    mutationFn: (body: CreateBmeBreakdownRequest) => api.createBmeBreakdown(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bme-breakdowns"] }); qc.invalidateQueries({ queryKey: ["bme-stats"] }); close(); notifications.show({ message: "Breakdown reported" }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateBmeBreakdownStatusRequest }) => api.updateBmeBreakdownStatus(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bme-breakdowns"] }); qc.invalidateQueries({ queryKey: ["bme-stats"] }); notifications.show({ message: "Status updated" }); },
  });

  function nextStatus(current: string): string | null {
    const flow: Record<string, string> = {
      reported: "acknowledged", acknowledged: "in_progress",
      in_progress: "resolved", parts_awaited: "in_progress", resolved: "closed",
    };
    return flow[current] ?? null;
  }

  const columns: Column<BmeBreakdown>[] = [
    { key: "equipment", label: "Equipment", render: (r) => <Text size="sm" fw={500}>{equipment.find((e) => e.id === r.equipment_id)?.name ?? "—"}</Text> },
    { key: "priority", label: "Priority", render: (r) => priorityBadge(r.priority) },
    { key: "status", label: "Status", render: (r) => breakdownStatusBadge(r.status) },
    { key: "description", label: "Description", render: (r) => <Text size="sm" lineClamp={1}>{r.description}</Text> },
    { key: "reported", label: "Reported", render: (r) => <Text size="sm">{fmtDate(r.reported_at)}</Text> },
    { key: "downtime", label: "Downtime (min)", render: (r) => <Text size="sm">{r.downtime_minutes ?? "—"}</Text> },
    { key: "cost", label: "Repair Cost", render: (r) => <Text size="sm">{r.total_repair_cost ? `₹${Number(r.total_repair_cost).toLocaleString()}` : "—"}</Text> },
    { key: "actions", label: "", render: (r) => {
      const ns = nextStatus(r.status);
      if (!canManage || !ns) return null;
      return (
        <Tooltip label={`Move to ${ns.replace(/_/g, " ")}`}>
          <ActionIcon variant="subtle" color="primary" size="sm" onClick={() => updateMut.mutate({ id: r.id, body: { status: ns as UpdateBmeBreakdownStatusRequest["status"] } })}>
            <IconCheck size={16} />
          </ActionIcon>
        </Tooltip>
      );
    }},
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={() => { setForm({ equipment_id: "", description: "" }); open(); }}>Report Breakdown</Button>}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer opened={opened} onClose={close} title="Report Breakdown" position="right" size="md">
        <Stack>
          <Select label="Equipment" required data={equipOptions} value={form.equipment_id} onChange={(v) => setForm({ ...form, equipment_id: v ?? "" })} searchable />
          <Select label="Priority" data={BREAKDOWN_PRIORITIES} value={form.priority ?? "medium"} onChange={(v) => setForm({ ...form, priority: (v ?? "medium") as CreateBmeBreakdownRequest["priority"] })} />
          <Textarea label="Description" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} minRows={3} />
          <Switch label="Vendor Visit Required" checked={form.vendor_visit_required ?? false} onChange={(e) => setForm({ ...form, vendor_visit_required: e.currentTarget.checked })} />
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <Button onClick={() => createMut.mutate(form)} loading={createMut.isPending}>Report</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Analytics Tab
// ══════════════════════════════════════════════════════════

function uptimeColor(pct: number | null): string {
  if (pct == null) return "gray";
  if (pct < 90) return "danger";
  if (pct < 95) return "warning";
  return "success";
}

function AnalyticsTab() {
  const [view, setView] = useState("mtbf");

  const { data: mtbfData = [], isLoading: loadingMtbf } = useQuery({
    queryKey: ["bme-mtbf-analytics"],
    queryFn: () => api.getBmeMtbfAnalytics(),
  });

  const { data: uptimeData = [], isLoading: loadingUptime } = useQuery({
    queryKey: ["bme-uptime-analytics"],
    queryFn: () => api.getBmeUptimeAnalytics(),
  });

  const mtbfColumns: Column<BmeMtbfRow>[] = [
    { key: "equipment_name", label: "Equipment Name", render: (r) => <Text size="sm" fw={500}>{r.equipment_name}</Text> },
    { key: "equipment_id", label: "Equipment ID", render: (r) => <Text size="sm" c="dimmed">{r.equipment_id.slice(0, 8)}</Text> },
    { key: "total_operating_hours", label: "Total Operating Hours", render: (r) => <Text size="sm">{r.total_operating_hours != null ? r.total_operating_hours.toFixed(1) : "—"}</Text> },
    { key: "breakdown_count", label: "Breakdown Count", render: (r) => <Text size="sm" c={r.breakdown_count > 0 ? "orange" : undefined}>{String(r.breakdown_count)}</Text> },
    { key: "mtbf_hours", label: "MTBF (hours)", render: (r) => <Text size="sm" fw={600}>{r.mtbf_hours != null ? r.mtbf_hours.toFixed(1) : "—"}</Text> },
  ];

  const uptimeColumns: Column<BmeUptimeRow>[] = [
    { key: "equipment_name", label: "Equipment Name", render: (r) => <Text size="sm" fw={500}>{r.equipment_name}</Text> },
    { key: "equipment_id", label: "Equipment ID", render: (r) => <Text size="sm" c="dimmed">{r.equipment_id.slice(0, 8)}</Text> },
    { key: "total_days", label: "Total Days", render: (r) => <Text size="sm">{r.total_days != null ? r.total_days.toFixed(1) : "—"}</Text> },
    { key: "downtime_days", label: "Downtime Days", render: (r) => <Text size="sm" c={r.downtime_days != null && r.downtime_days > 0 ? "danger" : undefined}>{r.downtime_days != null ? r.downtime_days.toFixed(1) : "—"}</Text> },
    { key: "uptime_percent", label: "Uptime %", render: (r) => (
      <Badge color={uptimeColor(r.uptime_percent)} variant="light" size="lg">
        {r.uptime_percent != null ? `${r.uptime_percent.toFixed(1)}%` : "—"}
      </Badge>
    )},
  ];

  return (
    <Stack>
      <SegmentedControl
        value={view}
        onChange={setView}
        data={[
          { value: "mtbf", label: "MTBF Analysis" },
          { value: "uptime", label: "Uptime Analysis" },
        ]}
      />

      {view === "mtbf" && (
        <>
          <Text fw={600} size="lg">Mean Time Between Failures (MTBF)</Text>
          <DataTable
            columns={mtbfColumns}
            data={mtbfData}
            loading={loadingMtbf}
            rowKey={(r) => r.equipment_id}
            emptyTitle="No MTBF data available"
          />
        </>
      )}

      {view === "uptime" && (
        <>
          <Text fw={600} size="lg">Equipment Uptime</Text>
          <DataTable
            columns={uptimeColumns}
            data={uptimeData}
            loading={loadingUptime}
            rowKey={(r) => r.equipment_id}
            emptyTitle="No uptime data available"
          />
        </>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function BmePage() {
  useRequirePermission(P.BME.EQUIPMENT_LIST);

  const canPm = useHasPermission(P.BME.PM_LIST);
  const canCal = useHasPermission(P.BME.CALIBRATION_LIST);
  const canContracts = useHasPermission(P.BME.CONTRACTS_LIST);
  const canBreakdowns = useHasPermission(P.BME.BREAKDOWNS_LIST);

  return (
    <div>
      <PageHeader
        title="BME / CMMS"
        subtitle="Biomedical equipment management, maintenance, calibration & contracts"
      />
      <Tabs defaultValue="equipment" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="equipment" leftSection={<IconDeviceDesktopAnalytics size={16} />}>Equipment</Tabs.Tab>
          {canPm && <Tabs.Tab value="pm" leftSection={<IconTool size={16} />}>Preventive Maintenance</Tabs.Tab>}
          {canCal && <Tabs.Tab value="calibration" leftSection={<IconGauge size={16} />}>Calibration</Tabs.Tab>}
          {canContracts && <Tabs.Tab value="contracts" leftSection={<IconFileDescription size={16} />}>Contracts</Tabs.Tab>}
          {canBreakdowns && <Tabs.Tab value="breakdowns" leftSection={<IconAlertTriangle size={16} />}>Breakdowns</Tabs.Tab>}
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>Analytics</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="equipment" pt="md"><EquipmentTab /></Tabs.Panel>
        {canPm && <Tabs.Panel value="pm" pt="md"><PmTab /></Tabs.Panel>}
        {canCal && <Tabs.Panel value="calibration" pt="md"><CalibrationTab /></Tabs.Panel>}
        {canContracts && <Tabs.Panel value="contracts" pt="md"><ContractsTab /></Tabs.Panel>}
        {canBreakdowns && <Tabs.Panel value="breakdowns" pt="md"><BreakdownsTab /></Tabs.Panel>}
        <Tabs.Panel value="analytics" pt="md"><AnalyticsTab /></Tabs.Panel>
      </Tabs>
    </div>
  );
}
