import "@mantine/charts/styles.css";
import { BarChart } from "@mantine/charts";
import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateFmsEnergyReadingRequest,
  CreateFmsWaterScheduleRequest,
  CreateFmsWaterTestRequest,
  CreateFmsWorkOrderRequest,
  EnergyAnalytics as EnergyAnalyticsType,
  FmsEnergyReading,
  FmsWaterSchedule,
  FmsWaterTest,
  FmsWorkOrder,
  SchedulePmRequest,
  UpdateFmsWorkOrderStatusRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconBolt,
  IconBuildingFactory2,
  IconCalendarRepeat,
  IconDroplet,
  IconFlame,
  IconPencil,
  IconPlus,
  IconTool,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { DataTable, IpdContextStrip, ipdContextFromSearchParams, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { facilitiesService } from "@/services/facilities.service";
import { FireSafetyTab } from "./facilities/fire-safety-tab";
import { MgpsTab } from "./facilities/mgps-tab";

// ── Constants ──────────────────────────────────────────

const WATER_SOURCE_TYPES = [
  { value: "municipal", label: "Municipal" },
  { value: "borewell", label: "Borewell" },
  { value: "tanker", label: "Tanker" },
  { value: "ro_plant", label: "RO Plant" },
  { value: "stp_recycled", label: "STP Recycled" },
];

const WATER_TEST_TYPES = [
  { value: "bacteriological", label: "Bacteriological" },
  { value: "chemical", label: "Chemical" },
  { value: "endotoxin", label: "Endotoxin" },
  { value: "conductivity", label: "Conductivity" },
];

const ENERGY_SOURCE_TYPES = [
  { value: "grid", label: "Grid" },
  { value: "dg_set", label: "DG Set" },
  { value: "ups", label: "UPS" },
  { value: "solar", label: "Solar" },
  { value: "inverter", label: "Inverter" },
];

const WO_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const WO_STATUSES = [
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const MAINTENANCE_CATEGORIES = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "hvac", label: "HVAC" },
  { value: "civil", label: "Civil" },
  { value: "carpentry", label: "Carpentry" },
  { value: "painting", label: "Painting" },
  { value: "fire_safety", label: "Fire Safety" },
  { value: "elevator", label: "Elevator" },
  { value: "generator", label: "Generator/DG Set" },
  { value: "medical_gas", label: "Medical Gas" },
  { value: "water_treatment", label: "Water Treatment" },
  { value: "other", label: "Other" },
];

const SCHEDULE_FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annual", label: "Semi-Annual" },
  { value: "annual", label: "Annual" },
];

const WATER_SCHEDULE_TYPES = [
  { value: "tank_cleaning", label: "Tank Cleaning" },
  { value: "legionella_testing", label: "Legionella Testing" },
  { value: "water_quality_test", label: "Water Quality Test" },
  { value: "stp_maintenance", label: "STP Maintenance" },
  { value: "ro_servicing", label: "RO Servicing" },
  { value: "filter_replacement", label: "Filter Replacement" },
  { value: "other", label: "Other" },
];

function priorityColor(p: string): BadgeTone {
  switch (p) {
    case "critical":
      return "danger";
    case "high":
      return "warning";
    case "medium":
      return "primary";
    default:
      return "neutral";
  }
}

function woStatusColor(s: string): BadgeTone {
  switch (s) {
    case "open":
      return "primary";
    case "assigned":
      return "info";
    case "in_progress":
      return "warning";
    case "on_hold":
      return "warning";
    case "completed":
      return "success";
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

// ── Main Page ─────────────────────────────────────────

export function FacilitiesPage() {
  useRequirePermission(P.FACILITIES.GAS_LIST);
  const [searchParams] = useSearchParams();
  const ipdContext = ipdContextFromSearchParams(searchParams);
  const requestedTab = searchParams.get("tab");
  const initialTab =
    requestedTab === "fire" ||
    requestedTab === "water" ||
    requestedTab === "energy" ||
    requestedTab === "work-orders"
      ? requestedTab
      : "mgps";
  const [tab, setTab] = useState<string | null>(initialTab);

  return (
    <div>
      <PageHeader
        title="Facilities Management"
        subtitle="MGPS, Fire Safety, Water Quality, Energy, Work Orders"
      />
      <IpdContextStrip context={ipdContext} />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="mgps" leftSection={<IconBuildingFactory2 size={16} />}>
            MGPS
          </Tabs.Tab>
          <Tabs.Tab value="fire" leftSection={<IconFlame size={16} />}>
            Fire Safety
          </Tabs.Tab>
          <Tabs.Tab value="water" leftSection={<IconDroplet size={16} />}>
            Water Quality
          </Tabs.Tab>
          <Tabs.Tab value="energy" leftSection={<IconBolt size={16} />}>
            Energy
          </Tabs.Tab>
          <Tabs.Tab value="work-orders" leftSection={<IconTool size={16} />}>
            Work Orders
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="mgps" pt="md">
          <MgpsTab />
        </Tabs.Panel>
        <Tabs.Panel value="fire" pt="md">
          <FireSafetyTab />
        </Tabs.Panel>
        <Tabs.Panel value="water" pt="md">
          <WaterQualityTab />
        </Tabs.Panel>
        <Tabs.Panel value="energy" pt="md">
          <EnergyTab />
        </Tabs.Panel>
        <Tabs.Panel value="work-orders" pt="md">
          <WorkOrdersTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab: MGPS (Medical Gas Pipeline System)
// ══════════════════════════════════════════════════════════

function WaterQualityTab() {
  const canManage = useHasPermission(P.FACILITIES.WATER_MANAGE);
  const [testOpen, { open: openTest, close: closeTest }] = useDisclosure(false);
  const [schedOpen, { open: openSched, close: closeSched }] = useDisclosure(false);
  const qc = useQueryClient();

  const tests = useQuery({
    queryKey: ["fms-water-tests"],
    queryFn: () => facilitiesService.listFmsWaterTests(),
  });
  const schedules = useQuery({
    queryKey: ["fms-water-schedules"],
    queryFn: () => facilitiesService.listFmsWaterSchedules(),
  });

  const [testForm, setTestForm] = useState<CreateFmsWaterTestRequest>({
    source_type: "municipal",
    test_type: "bacteriological",
    sample_date: new Date().toISOString().slice(0, 10),
    parameter_name: "",
  });
  const [schedForm, setSchedForm] = useState<CreateFmsWaterScheduleRequest>({
    schedule_type: "",
    frequency: "",
  });

  const createTest = useMutation({
    mutationFn: () => facilitiesService.createFmsWaterTest(testForm),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fms-water-tests"] });
      closeTest();
      notifications.show({ title: "Success", message: "Test result recorded" });
    },
  });
  const createSched = useMutation({
    mutationFn: () => facilitiesService.createFmsWaterSchedule(schedForm),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fms-water-schedules"] });
      closeSched();
      notifications.show({ title: "Success", message: "Schedule created" });
    },
  });

  const testCols: Column<FmsWaterTest>[] = [
    {
      key: "source_type",
      label: "Source",
      render: (r) => <Badge>{r.source_type.replace(/_/g, " ")}</Badge>,
    },
    { key: "test_type", label: "Test", render: (r) => <Text size="sm">{r.test_type}</Text> },
    {
      key: "parameter_name",
      label: "Parameter",
      render: (r) => <Text size="sm">{r.parameter_name}</Text>,
    },
    {
      key: "result_value",
      label: "Result",
      render: (r) => (
        <Text size="sm">
          {r.result_value ?? "—"} {r.unit ?? ""}
        </Text>
      ),
    },
    {
      key: "is_within_limits",
      label: "Status",
      render: (r) =>
        r.is_within_limits === null || r.is_within_limits === undefined ? (
          <Badge tone="neutral">Pending</Badge>
        ) : r.is_within_limits ? (
          <Badge tone="success">Pass</Badge>
        ) : (
          <Badge tone="danger">Fail</Badge>
        ),
    },
    { key: "sample_date", label: "Sampled", render: (r) => <Text size="sm">{r.sample_date}</Text> },
  ];

  const schedCols: Column<FmsWaterSchedule>[] = [
    {
      key: "schedule_type",
      label: "Type",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.schedule_type}
        </Text>
      ),
    },
    { key: "frequency", label: "Frequency", render: (r) => <Text size="sm">{r.frequency}</Text> },
    {
      key: "last_completed_date",
      label: "Last Done",
      render: (r) => <Text size="sm">{r.last_completed_date ?? "—"}</Text>,
    },
    {
      key: "next_due_date",
      label: "Next Due",
      render: (r) => (
        <Text
          size="sm"
          c={r.next_due_date && new Date(r.next_due_date) < new Date() ? "danger" : undefined}
        >
          {r.next_due_date ?? "—"}
        </Text>
      ),
    },
    {
      key: "is_active",
      label: "Active",
      render: (r) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Yes" : "No"}</Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Water Test Results
        </Text>
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openTest}>
            Record Test
          </Button>
        )}
      </Group>
      <DataTable
        columns={testCols}
        data={tests.data ?? []}
        loading={tests.isLoading}
        rowKey={(r) => r.id}
      />

      <Group justify="space-between" mt="lg">
        <Text fw={600} size="lg">
          Cleaning / Testing Schedules
        </Text>
        {canManage && (
          <Button tone="secondary" leftSection={<IconPlus size={16} />} onClick={openSched}>
            Add Schedule
          </Button>
        )}
      </Group>
      <DataTable
        columns={schedCols}
        data={schedules.data ?? []}
        loading={schedules.isLoading}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={testOpen}
        onClose={closeTest}
        title="Record Water Test"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Source"
            data={WATER_SOURCE_TYPES}
            value={testForm.source_type}
            onChange={(v) =>
              setTestForm({
                ...testForm,
                source_type: v as CreateFmsWaterTestRequest["source_type"],
              })
            }
          />
          <Select
            label="Test Type"
            data={WATER_TEST_TYPES}
            value={testForm.test_type}
            onChange={(v) =>
              setTestForm({ ...testForm, test_type: v as CreateFmsWaterTestRequest["test_type"] })
            }
          />
          <TextInput
            label="Parameter"
            required
            value={testForm.parameter_name}
            onChange={(e) => setTestForm({ ...testForm, parameter_name: e.currentTarget.value })}
          />
          <NumberInput
            label="Result Value"
            value={testForm.result_value ?? ""}
            onChange={(v) =>
              setTestForm({ ...testForm, result_value: typeof v === "number" ? v : undefined })
            }
          />
          <TextInput
            label="Unit"
            value={testForm.unit ?? ""}
            onChange={(e) => setTestForm({ ...testForm, unit: e.currentTarget.value })}
          />
          <NumberInput
            label="Min Acceptable"
            value={testForm.acceptable_min ?? ""}
            onChange={(v) =>
              setTestForm({ ...testForm, acceptable_min: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Max Acceptable"
            value={testForm.acceptable_max ?? ""}
            onChange={(v) =>
              setTestForm({ ...testForm, acceptable_max: typeof v === "number" ? v : undefined })
            }
          />
          <TextInput
            label="Lab Name"
            value={testForm.lab_name ?? ""}
            onChange={(e) => setTestForm({ ...testForm, lab_name: e.currentTarget.value })}
          />
          <Textarea
            label="Notes"
            value={testForm.notes ?? ""}
            onChange={(e) => setTestForm({ ...testForm, notes: e.currentTarget.value })}
          />
          <Button tone="primary" onClick={() => createTest.mutate()} loading={createTest.isPending}>
            Save
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={schedOpen}
        onClose={closeSched}
        title="Add Water Schedule"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Schedule Type"
            required
            data={WATER_SCHEDULE_TYPES}
            value={schedForm.schedule_type || null}
            onChange={(v) => setSchedForm({ ...schedForm, schedule_type: v ?? "" })}
            searchable
          />
          <Select
            label="Frequency"
            required
            data={SCHEDULE_FREQUENCIES}
            value={schedForm.frequency || null}
            onChange={(v) => setSchedForm({ ...schedForm, frequency: v ?? "" })}
            searchable
          />
          <Textarea
            label="Notes"
            value={schedForm.notes ?? ""}
            onChange={(e) => setSchedForm({ ...schedForm, notes: e.currentTarget.value })}
          />
          <Button
            tone="primary"
            onClick={() => createSched.mutate()}
            loading={createSched.isPending}
          >
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab: Energy
// ══════════════════════════════════════════════════════════

function EnergyTab() {
  const canManage = useHasPermission(P.FACILITIES.ENERGY_MANAGE);
  const [readingOpen, { open: openReading, close: closeReading }] = useDisclosure(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const qc = useQueryClient();

  const readings = useQuery({
    queryKey: ["fms-energy-readings"],
    queryFn: () => facilitiesService.listFmsEnergyReadings(),
  });

  const [form, setForm] = useState<CreateFmsEnergyReadingRequest>({ source_type: "grid" });

  const createReading = useMutation({
    mutationFn: () => facilitiesService.createFmsEnergyReading(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fms-energy-readings"] });
      closeReading();
      notifications.show({ title: "Success", message: "Reading recorded" });
    },
  });

  const cols: Column<FmsEnergyReading>[] = [
    {
      key: "source_type",
      label: "Source",
      render: (r) => <Badge>{r.source_type.replace(/_/g, " ").toUpperCase()}</Badge>,
    },
    {
      key: "equipment_name",
      label: "Equipment",
      render: (r) => <Text size="sm">{r.equipment_name ?? "—"}</Text>,
    },
    { key: "voltage", label: "Voltage", render: (r) => <Text size="sm">{r.voltage ?? "—"}</Text> },
    {
      key: "power_kw",
      label: "Power (kW)",
      render: (r) => <Text size="sm">{r.power_kw ?? "—"}</Text>,
    },
    {
      key: "load_percent",
      label: "Load %",
      render: (r) => <Text size="sm">{r.load_percent ?? "—"}</Text>,
    },
    {
      key: "fuel_level_percent",
      label: "Fuel %",
      render: (r) => <Text size="sm">{r.fuel_level_percent ?? "—"}</Text>,
    },
    {
      key: "battery_health_percent",
      label: "Battery %",
      render: (r) => <Text size="sm">{r.battery_health_percent ?? "—"}</Text>,
    },
    {
      key: "is_alarm",
      label: "Alarm",
      render: (r) =>
        r.is_alarm ? <Badge tone="danger">ALARM</Badge> : <Badge tone="success">OK</Badge>,
    },
    {
      key: "reading_at",
      label: "Time",
      render: (r) => <Text size="sm">{new Date(r.reading_at).toLocaleString()}</Text>,
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Energy Readings
        </Text>
        <Group gap="xs">
          {canManage && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openReading}>
              Record Reading
            </Button>
          )}
          <Button tone="secondary" onClick={() => setShowAnalytics(!showAnalytics)}>
            {showAnalytics ? "Hide Analytics" : "Show Analytics"}
          </Button>
        </Group>
      </Group>
      <DataTable
        columns={cols}
        data={readings.data ?? []}
        loading={readings.isLoading}
        rowKey={(r) => r.id}
      />

      {showAnalytics && <EnergyAnalyticsView />}

      <Drawer
        opened={readingOpen}
        onClose={closeReading}
        title="Record Energy Reading"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Source"
            data={ENERGY_SOURCE_TYPES}
            value={form.source_type}
            onChange={(v) =>
              setForm({ ...form, source_type: v as CreateFmsEnergyReadingRequest["source_type"] })
            }
          />
          <TextInput
            label="Equipment Name"
            value={form.equipment_name ?? ""}
            onChange={(e) => setForm({ ...form, equipment_name: e.currentTarget.value })}
          />
          <NumberInput
            label="Voltage"
            value={form.voltage ?? ""}
            onChange={(v) => setForm({ ...form, voltage: typeof v === "number" ? v : undefined })}
          />
          <NumberInput
            label="Current (A)"
            value={form.current_amps ?? ""}
            onChange={(v) =>
              setForm({ ...form, current_amps: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Power (kW)"
            value={form.power_kw ?? ""}
            onChange={(v) => setForm({ ...form, power_kw: typeof v === "number" ? v : undefined })}
          />
          <NumberInput
            label="Load %"
            value={form.load_percent ?? ""}
            onChange={(v) =>
              setForm({ ...form, load_percent: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Fuel %"
            value={form.fuel_level_percent ?? ""}
            onChange={(v) =>
              setForm({ ...form, fuel_level_percent: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Runtime (hrs)"
            value={form.runtime_hours ?? ""}
            onChange={(v) =>
              setForm({ ...form, runtime_hours: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Battery Voltage"
            value={form.battery_voltage ?? ""}
            onChange={(v) =>
              setForm({ ...form, battery_voltage: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Battery Health %"
            value={form.battery_health_percent ?? ""}
            onChange={(v) =>
              setForm({ ...form, battery_health_percent: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Backup (min)"
            value={form.backup_minutes ?? ""}
            onChange={(v) =>
              setForm({ ...form, backup_minutes: typeof v === "number" ? v : undefined })
            }
          />
          <Switch
            label="Alarm"
            checked={form.is_alarm ?? false}
            onChange={(e) => setForm({ ...form, is_alarm: e.currentTarget.checked })}
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })}
          />
          <Button
            tone="primary"
            onClick={() => createReading.mutate()}
            loading={createReading.isPending}
          >
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Energy Analytics Sub-View ────────────────────────────

function EnergyAnalyticsView() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["energy-analytics", from, to],
    queryFn: () =>
      facilitiesService.energyAnalytics({ from: from || undefined, to: to || undefined }),
  });

  const analytics = data as EnergyAnalyticsType | undefined;

  const bySourceChart = analytics
    ? analytics.by_source.map((s) => ({
        source: s.source_type.replace(/_/g, " ").toUpperCase(),
        kWh: s.total_kwh,
        cost: s.total_cost,
      }))
    : [];

  return (
    <Card withBorder p="md" mt="md">
      <Stack>
        <Text fw={600} size="lg">
          Energy Analytics
        </Text>
        <Group>
          <TextInput
            placeholder="From date"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.currentTarget.value)}
            w={160}
          />
          <TextInput
            placeholder="To date"
            type="date"
            value={to}
            onChange={(e) => setTo(e.currentTarget.value)}
            w={160}
          />
        </Group>

        {isLoading && (
          <Text size="sm" c="dimmed">
            Loading analytics...
          </Text>
        )}

        {analytics && (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Card withBorder p="sm">
              <Text fw={600} size="sm" mb="sm">
                Consumption by Source
              </Text>
              {bySourceChart.length > 0 ? (
                <BarChart
                  h={200}
                  data={bySourceChart}
                  dataKey="source"
                  series={[
                    { name: "kWh", color: "warning" },
                    { name: "cost", color: "primary" },
                  ]}
                />
              ) : (
                <Text size="sm" c="dimmed">
                  No data
                </Text>
              )}
            </Card>
            <Card withBorder p="sm">
              <Text fw={600} size="sm" mb="sm">
                Monthly Trend
              </Text>
              {analytics.monthly_trend.length > 0 ? (
                <BarChart
                  h={200}
                  data={analytics.monthly_trend.map((m) => ({
                    month: m.month,
                    kWh: m.total_kwh,
                    cost: m.total_cost,
                  }))}
                  dataKey="month"
                  series={[
                    { name: "kWh", color: "orange" },
                    { name: "cost", color: "success" },
                  ]}
                />
              ) : (
                <Text size="sm" c="dimmed">
                  No data
                </Text>
              )}
            </Card>
          </SimpleGrid>
        )}
      </Stack>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab: Work Orders
// ══════════════════════════════════════════════════════════

function WorkOrdersTab() {
  const canCreate = useHasPermission(P.FACILITIES.WORK_ORDERS_CREATE);
  const canManage = useHasPermission(P.FACILITIES.WORK_ORDERS_MANAGE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [statusOpen, { open: openStatus, close: closeStatus }] = useDisclosure(false);
  const [pmOpen, { open: openPm, close: closePm }] = useDisclosure(false);
  const [selectedWo, setSelectedWo] = useState<FmsWorkOrder | null>(null);
  const qc = useQueryClient();

  const orders = useQuery({
    queryKey: ["fms-work-orders"],
    queryFn: () => facilitiesService.listFmsWorkOrders(),
  });

  const [form, setForm] = useState<CreateFmsWorkOrderRequest>({ description: "" });
  const [statusForm, setStatusForm] = useState<UpdateFmsWorkOrderStatusRequest>({
    status: "assigned",
  });
  const [pmForm, setPmForm] = useState<SchedulePmRequest>({
    frequency: "monthly",
    start_date: new Date().toISOString().slice(0, 10),
  });

  const createWo = useMutation({
    mutationFn: () => facilitiesService.createFmsWorkOrder(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fms-work-orders"] });
      closeCreate();
      notifications.show({ title: "Success", message: "Work order created" });
    },
  });
  const updateStatus = useMutation({
    mutationFn: () => {
      if (!selectedWo) return Promise.reject(new Error("No WO selected"));
      return facilitiesService.updateFmsWorkOrderStatus(selectedWo.id, statusForm);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fms-work-orders"] });
      closeStatus();
      notifications.show({ title: "Success", message: "Status updated" });
    },
  });
  const schedulePm = useMutation({
    mutationFn: () => facilitiesService.schedulePm(pmForm),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["fms-work-orders"] });
      closePm();
      notifications.show({
        title: "PM Scheduled",
        message: `${(res as { created: number }).created} work order(s) created`,
      });
    },
  });

  const cols: Column<FmsWorkOrder>[] = [
    {
      key: "work_order_number",
      label: "WO #",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.work_order_number}
        </Text>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (r) => <Text size="sm">{r.category ?? "—"}</Text>,
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => <Badge tone={priorityColor(r.priority)}>{r.priority}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge tone={woStatusColor(r.status)}>{r.status.replace(/_/g, " ")}</Badge>,
    },
    {
      key: "description",
      label: "Description",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.description}
        </Text>
      ),
    },
    {
      key: "total_cost",
      label: "Cost",
      render: (r) => <Text size="sm">{r.total_cost != null ? `${r.total_cost}` : "—"}</Text>,
    },
    {
      key: "requested_at",
      label: "Requested",
      render: (r) => <Text size="sm">{new Date(r.requested_at).toLocaleDateString()}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canManage && r.status !== "completed" && r.status !== "cancelled" ? (
          <Tooltip label="Update Status">
            <IconButton
              onClick={() => {
                setSelectedWo(r);
                setStatusForm({ status: r.status === "open" ? "assigned" : "in_progress" });
                openStatus();
              }}
              aria-label="Edit"
            >
              <IconPencil size={16} />
            </IconButton>
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Infrastructure Work Orders
        </Text>
        <Group gap="xs">
          {canManage && (
            <Button
              tone="secondary"
              leftSection={<IconCalendarRepeat size={16} />}
              onClick={openPm}
            >
              Schedule PM
            </Button>
          )}
          {canCreate && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
              Create Work Order
            </Button>
          )}
        </Group>
      </Group>
      <DataTable
        columns={cols}
        data={orders.data ?? []}
        loading={orders.isLoading}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Create Work Order"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Category"
            data={MAINTENANCE_CATEGORIES}
            placeholder="Select category"
            value={form.category ?? null}
            onChange={(v) => setForm({ ...form, category: v || undefined })}
            clearable
            searchable
          />
          <Select
            label="Priority"
            data={WO_PRIORITIES}
            value={form.priority ?? "medium"}
            onChange={(v) => setForm({ ...form, priority: v ?? "medium" })}
          />
          <Textarea
            label="Description"
            required
            minRows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })}
          />
          <Button tone="primary" onClick={() => createWo.mutate()} loading={createWo.isPending}>
            Submit
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={statusOpen}
        onClose={closeStatus}
        title={`Update WO: ${selectedWo?.work_order_number ?? ""}`}
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Status"
            data={WO_STATUSES}
            value={statusForm.status}
            onChange={(v) =>
              setStatusForm({
                ...statusForm,
                status: (v ?? "assigned") as UpdateFmsWorkOrderStatusRequest["status"],
              })
            }
          />
          <Textarea
            label="Findings"
            value={statusForm.findings ?? ""}
            onChange={(e) => setStatusForm({ ...statusForm, findings: e.currentTarget.value })}
          />
          <Textarea
            label="Actions Taken"
            value={statusForm.actions_taken ?? ""}
            onChange={(e) => setStatusForm({ ...statusForm, actions_taken: e.currentTarget.value })}
          />
          <NumberInput
            label="Vendor Cost"
            value={statusForm.vendor_cost ?? ""}
            onChange={(v) =>
              setStatusForm({ ...statusForm, vendor_cost: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Material Cost"
            value={statusForm.material_cost ?? ""}
            onChange={(v) =>
              setStatusForm({ ...statusForm, material_cost: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Labor Cost"
            value={statusForm.labor_cost ?? ""}
            onChange={(v) =>
              setStatusForm({ ...statusForm, labor_cost: typeof v === "number" ? v : undefined })
            }
          />
          <Textarea
            label="Notes"
            value={statusForm.notes ?? ""}
            onChange={(e) => setStatusForm({ ...statusForm, notes: e.currentTarget.value })}
          />
          <Button
            tone="primary"
            onClick={() => updateStatus.mutate()}
            loading={updateStatus.isPending}
          >
            Update
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={pmOpen}
        onClose={closePm}
        title="Schedule Preventive Maintenance"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Equipment IDs (comma-separated)"
            placeholder="e.g. id1, id2, id3"
            onChange={(e) => {
              const ids = e.currentTarget.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              setPmForm({ ...pmForm, equipment_ids: ids.length > 0 ? ids : undefined });
            }}
          />
          <Select
            label="Frequency"
            data={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "biweekly", label: "Bi-Weekly" },
              { value: "monthly", label: "Monthly" },
              { value: "quarterly", label: "Quarterly" },
              { value: "semi_annual", label: "Semi-Annual" },
              { value: "annual", label: "Annual" },
            ]}
            value={pmForm.frequency}
            onChange={(v) => setPmForm({ ...pmForm, frequency: v ?? "monthly" })}
          />
          <TextInput
            label="Start Date"
            type="date"
            value={pmForm.start_date}
            onChange={(e) => setPmForm({ ...pmForm, start_date: e.currentTarget.value })}
          />
          <Button
            tone="primary"
            onClick={() => schedulePm.mutate()}
            loading={schedulePm.isPending}
            disabled={!pmForm.start_date || !pmForm.frequency}
          >
            Schedule
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
