import "@mantine/charts/styles.css";
import { BarChart, DonutChart } from "@mantine/charts";
import {
  Card,
  Drawer,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateDrugScreenRequest,
  CreateOccHealthHazardRequest,
  OccHealthDrugScreen,
  OccHealthHazard,
  ReturnToWorkClearanceRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBiohazard,
  IconCertificate,
  IconChartBar,
  IconChecklist,
  IconPencil,
  IconPlus,
  IconReportMedical,
  IconShieldCheck,
  IconVaccine,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { ExposuresPanel } from "@/pages/occupational-health/ExposuresPanel";
import { occupationalHealthService } from "@/services/occupationalHealth.service";
import { InjuriesPanel } from "./occupational-health/injuries-panel";
import { ScreeningsPanel } from "./occupational-health/screenings-panel";
import {
  FITNESS_STATUS_COLORS,
  SCREENING_TYPES,
  statusColorTone,
} from "./occupational-health/shared";
import { VaccinationsPanel } from "./occupational-health/vaccinations-panel";

// ── Constants ──────────────────────────────────────────

const DRUG_SCREEN_STATUS_OPTIONS = [
  { value: "ordered", label: "Ordered" },
  { value: "collected", label: "Collected" },
  { value: "sent_to_lab", label: "Sent to Lab" },
  { value: "mro_review", label: "MRO Review" },
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Negative" },
  { value: "inconclusive", label: "Inconclusive" },
  { value: "cancelled", label: "Cancelled" },
];

const DRUG_SCREEN_STATUS_COLORS: Record<string, BadgeTone> = {
  ordered: "neutral",
  collected: "primary",
  sent_to_lab: "info",
  mro_review: "warning",
  positive: "danger",
  negative: "success",
  inconclusive: "warning",
  cancelled: "neutral",
};

const DRUG_PANEL_OPTIONS = [
  { value: "standard_5", label: "Standard 5-Panel" },
  { value: "extended_10", label: "Extended 10-Panel" },
  { value: "custom", label: "Custom" },
];

// ── Main Page ──────────────────────────────────────────

export function OccupationalHealthPage() {
  useRequirePermission(P.OCC_HEALTH.SCREENINGS_LIST);
  const [activeTab, setActiveTab] = useState<string | null>("screenings");

  return (
    <div>
      <PageHeader
        title="Occupational Health"
        subtitle="Employee health screenings, vaccinations, and injury tracking"
      />
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="screenings" leftSection={<IconShieldCheck size={16} />}>
            Health Screenings
          </Tabs.Tab>
          <Tabs.Tab value="drug-screens" leftSection={<IconReportMedical size={16} />}>
            Drug Screening
          </Tabs.Tab>
          <Tabs.Tab value="vaccinations" leftSection={<IconVaccine size={16} />}>
            Vaccinations
          </Tabs.Tab>
          <Tabs.Tab value="injuries" leftSection={<IconAlertTriangle size={16} />}>
            Injuries & RTW
          </Tabs.Tab>
          <Tabs.Tab value="exposures" leftSection={<IconBiohazard size={16} />}>
            Sharps & Exposures
          </Tabs.Tab>
          <Tabs.Tab value="hazards" leftSection={<IconChecklist size={16} />}>
            Hazard Registry
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
            Analytics
          </Tabs.Tab>
          <Tabs.Tab value="rtw-clearance" leftSection={<IconCertificate size={16} />}>
            RTW Clearance
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="screenings" pt="md">
          <ScreeningsPanel />
        </Tabs.Panel>
        <Tabs.Panel value="drug-screens" pt="md">
          <DrugScreensPanel />
        </Tabs.Panel>
        <Tabs.Panel value="vaccinations" pt="md">
          <VaccinationsPanel />
        </Tabs.Panel>
        <Tabs.Panel value="injuries" pt="md">
          <InjuriesPanel />
        </Tabs.Panel>
        <Tabs.Panel value="exposures" pt="md">
          <ExposuresPanel />
        </Tabs.Panel>
        <Tabs.Panel value="hazards" pt="md">
          <HazardRegistryPanel />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <OccHealthAnalyticsPanel />
        </Tabs.Panel>
        <Tabs.Panel value="rtw-clearance" pt="md">
          <ReturnToWorkPanel />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 1 — Health Screenings
// ══════════════════════════════════════════════════════════

function DrugScreensPanel() {
  const canManage = useHasPermission(P.OCC_HEALTH.DRUG_SCREENS_MANAGE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [editOpen, editHandlers] = useDisclosure(false);
  const [selected, setSelected] = useState<OccHealthDrugScreen | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: screens = [], isLoading } = useQuery({
    queryKey: ["occ-drug-screens", statusFilter],
    queryFn: () =>
      occupationalHealthService.listDrugScreens(
        statusFilter ? { status: statusFilter } : undefined,
      ),
  });

  const [form, setForm] = useState<CreateDrugScreenRequest>({
    employee_id: "",
  });

  const [editForm, setEditForm] = useState<{
    status?: string;
    mro_decision?: string;
  }>({});

  const createMut = useMutation({
    mutationFn: () => occupationalHealthService.createDrugScreen(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occ-drug-screens"] });
      createHandlers.close();
      setForm({ employee_id: "" });
      notifications.show({
        title: "Drug Screen Created",
        message: "Drug screening order created successfully",
        color: "success",
      });
    },
  });

  const updateMut = useMutation({
    mutationFn: () => {
      if (!selected) return Promise.reject(new Error("No drug screen selected"));
      return occupationalHealthService.updateDrugScreen(selected.id, {
        status: editForm.status as OccHealthDrugScreen["status"],
        mro_decision: editForm.mro_decision,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occ-drug-screens"] });
      editHandlers.close();
      setSelected(null);
      notifications.show({
        title: "Drug Screen Updated",
        message: "Drug screen status updated successfully",
        color: "success",
      });
    },
  });

  const columns: Column<OccHealthDrugScreen>[] = [
    {
      key: "employee_id",
      label: "Employee",
      render: (r) => (
        <Text size="sm" truncate style={{ maxWidth: 120 }}>
          {r.employee_id}
        </Text>
      ),
    },
    {
      key: "specimen_id",
      label: "Specimen ID",
      render: (r) => r.specimen_id ?? "---",
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={DRUG_SCREEN_STATUS_COLORS[r.status] ?? "neutral"} variant="filled" size="sm">
          {DRUG_SCREEN_STATUS_OPTIONS.find((s) => s.value === r.status)?.label ?? r.status}
        </Badge>
      ),
    },
    {
      key: "panel",
      label: "Panel",
      render: (r) => DRUG_PANEL_OPTIONS.find((p) => p.value === r.panel)?.label ?? r.panel,
    },
    {
      key: "mro_decision",
      label: "MRO Decision",
      render: (r) => r.mro_decision ?? "---",
    },
    {
      key: "collected_at",
      label: "Collected",
      render: (r) => r.collected_at ?? "---",
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          {canManage && (
            <IconButton
              tone="default"
              size="sm"
              onClick={() => {
                setSelected(r);
                setEditForm({
                  status: r.status,
                  mro_decision: r.mro_decision ?? "",
                });
                editHandlers.open();
              }}
              aria-label="Edit"
            >
              <IconPencil size={14} />
            </IconButton>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Filter by status"
          clearable
          data={DRUG_SCREEN_STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
          w={200}
        />
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            New Drug Screen
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={screens} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Drawer */}
      <Drawer
        opened={createOpen}
        onClose={createHandlers.close}
        title="New Drug Screening"
        position="right"
        size="md"
      >
        <Stack>
          <EmployeeSearchSelect
            label="Employee"
            required
            value={form.employee_id}
            onChange={(employeeId) => setForm({ ...form, employee_id: employeeId })}
          />
          <TextInput
            label="Screening ID"
            description="Link to a health screening (optional)"
            value={form.screening_id ?? ""}
            onChange={(e) => setForm({ ...form, screening_id: e.currentTarget.value || undefined })}
          />
          <Select
            label="Panel"
            data={DRUG_PANEL_OPTIONS}
            value={form.panel ?? "standard_5"}
            onChange={(v) => setForm({ ...form, panel: v ?? undefined })}
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!form.employee_id}
          >
            Create Drug Screen
          </Button>
        </Stack>
      </Drawer>

      {/* Update Status Drawer */}
      <Drawer
        opened={editOpen}
        onClose={editHandlers.close}
        title="Update Drug Screen"
        position="right"
        size="md"
      >
        <Stack>
          <Select
            label="Status"
            data={DRUG_SCREEN_STATUS_OPTIONS}
            value={editForm.status ?? ""}
            onChange={(v) => setEditForm({ ...editForm, status: v ?? undefined })}
          />
          <TextInput
            label="MRO Decision"
            value={editForm.mro_decision ?? ""}
            onChange={(e) =>
              setEditForm({ ...editForm, mro_decision: e.currentTarget.value || undefined })
            }
          />
          <Button tone="primary" onClick={() => updateMut.mutate()} loading={updateMut.isPending}>
            Update Drug Screen
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 3 — Vaccinations
// ══════════════════════════════════════════════════════════

const HAZARD_TYPES = [
  { value: "biological", label: "Biological" },
  { value: "chemical", label: "Chemical" },
  { value: "physical", label: "Physical" },
  { value: "ergonomic", label: "Ergonomic" },
  { value: "psychosocial", label: "Psychosocial" },
  { value: "radiation", label: "Radiation" },
  { value: "other", label: "Other" },
];

function HazardRegistryPanel() {
  const canCreate = useHasPermission(P.OCC_HEALTH.SCREENINGS_CREATE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);

  const { data: hazards = [], isLoading } = useQuery({
    queryKey: ["occ-health-hazards"],
    queryFn: () => occupationalHealthService.listOccHealthHazards(),
  });

  const [form, setForm] = useState<CreateOccHealthHazardRequest>({
    hazard_type: "biological",
    location: "",
    risk_level: "low",
    assessed_date: new Date().toISOString().slice(0, 10),
  });

  const createMut = useMutation({
    mutationFn: () => occupationalHealthService.createOccHealthHazard(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occ-health-hazards"] });
      createHandlers.close();
      setForm({
        hazard_type: "biological",
        location: "",
        risk_level: "low",
        assessed_date: new Date().toISOString().slice(0, 10),
      });
      notifications.show({
        title: "Hazard Created",
        message: "Hazard registry entry created successfully",
        color: "success",
      });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  const columns: Column<OccHealthHazard>[] = [
    {
      key: "hazard_type",
      label: "Type",
      render: (r) => (
        <Badge tone="neutral" size="sm">
          {HAZARD_TYPES.find((t) => t.value === r.hazard_type)?.label ?? r.hazard_type}
        </Badge>
      ),
    },
    {
      key: "location",
      label: "Location",
      render: (r) => <Text size="sm">{r.location}</Text>,
    },
    {
      key: "risk_level",
      label: "Risk Level",
      render: (r) => (
        <Badge tone={statusColorTone(r.risk_level)} variant="filled" size="sm">
          {r.risk_level}
        </Badge>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (r) => (
        <Text size="sm" lineClamp={2}>
          {r.description ?? "---"}
        </Text>
      ),
    },
    {
      key: "mitigation",
      label: "Mitigation",
      render: (r) => (
        <Text size="sm" lineClamp={2}>
          {r.mitigation ?? "---"}
        </Text>
      ),
    },
    {
      key: "assessed_date",
      label: "Assessed",
      render: (r) => <Text size="sm">{r.assessed_date}</Text>,
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            Add Hazard
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={hazards}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No hazards registered"
        emptyDescription="Add workplace hazards to build a comprehensive registry"
      />

      <Drawer
        opened={createOpen}
        onClose={createHandlers.close}
        title="Register Workplace Hazard"
        position="right"
        size="md"
      >
        <Stack gap="md">
          <Select
            label="Hazard Type"
            required
            data={HAZARD_TYPES}
            value={form.hazard_type}
            onChange={(v) => setForm({ ...form, hazard_type: v ?? "biological" })}
          />
          <TextInput
            label="Location"
            required
            placeholder="e.g. ICU Ward 3, Radiology Lab"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.currentTarget.value })}
          />
          <Select
            label="Risk Level"
            required
            data={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
              { value: "critical", label: "Critical" },
            ]}
            value={form.risk_level}
            onChange={(v) => setForm({ ...form, risk_level: v ?? "low" })}
          />
          <Textarea
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value || undefined })}
          />
          <Textarea
            label="Mitigation Measures"
            value={form.mitigation ?? ""}
            onChange={(e) => setForm({ ...form, mitigation: e.currentTarget.value || undefined })}
          />
          <DateInput
            label="Assessment Date"
            required
            value={form.assessed_date ? new Date(form.assessed_date) : null}
            onChange={(d) =>
              setForm({ ...form, assessed_date: d ? new Date(d).toISOString().slice(0, 10) : "" })
            }
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!form.location || !form.assessed_date}
          >
            Register Hazard
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 6 — Analytics
// ══════════════════════════════════════════════════════════

function OccHealthAnalyticsPanel() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["occ-health-analytics"],
    queryFn: () => occupationalHealthService.occHealthAnalytics(),
  });

  if (isLoading) {
    return (
      <Text c="dimmed" size="sm">
        Loading analytics...
      </Text>
    );
  }

  if (!analytics) {
    return (
      <Text c="dimmed" size="sm">
        No analytics data available
      </Text>
    );
  }

  const byTypeData = Object.entries(analytics.by_type ?? {}).map(([type, count]) => ({
    type: SCREENING_TYPES.find((t) => t.value === type)?.label ?? type,
    count,
  }));

  const fitnessData = Object.entries(analytics.fitness_rates ?? {}).map(([status, rate]) => ({
    name: status,
    value: Math.round((rate as number) * 100),
    color: FITNESS_STATUS_COLORS[status] ?? "gray",
  }));

  const byDeptData = Object.entries(analytics.by_department ?? {}).map(([dept, count]) => ({
    department: dept,
    count,
  }));

  return (
    <Stack gap="lg">
      {/* Summary Stats */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        <Card withBorder p="md">
          <Text size="xs" c="dimmed">
            Total Screenings
          </Text>
          <Text fw={700} size="xl" c="primary">
            {analytics.total_screenings ?? 0}
          </Text>
        </Card>
        <Card withBorder p="md">
          <Text size="xs" c="dimmed">
            Screening Types
          </Text>
          <Text fw={700} size="xl">
            {Object.keys(analytics.by_type ?? {}).length}
          </Text>
        </Card>
        <Card withBorder p="md">
          <Text size="xs" c="dimmed">
            Departments Covered
          </Text>
          <Text fw={700} size="xl">
            {Object.keys(analytics.by_department ?? {}).length}
          </Text>
        </Card>
        <Card withBorder p="md">
          <Text size="xs" c="dimmed">
            Fitness Statuses Tracked
          </Text>
          <Text fw={700} size="xl">
            {Object.keys(analytics.fitness_rates ?? {}).length}
          </Text>
        </Card>
      </SimpleGrid>

      {/* Charts */}
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {byTypeData.length > 0 && (
          <Card withBorder p="md">
            <Text fw={600} size="sm" mb="md">
              Screenings by Type
            </Text>
            <BarChart
              h={250}
              data={byTypeData}
              dataKey="type"
              series={[{ name: "count", label: "Count", color: "primary" }]}
            />
          </Card>
        )}
        {fitnessData.length > 0 && (
          <Card withBorder p="md">
            <Text fw={600} size="sm" mb="md">
              Fitness Rate Distribution (%)
            </Text>
            <DonutChart
              data={fitnessData}
              size={200}
              thickness={30}
              paddingAngle={4}
              withLabelsLine
              withLabels
            />
          </Card>
        )}
      </SimpleGrid>

      {byDeptData.length > 0 && (
        <Card withBorder p="md">
          <Text fw={600} size="sm" mb="md">
            Screenings by Department
          </Text>
          <BarChart
            h={300}
            data={byDeptData}
            dataKey="department"
            series={[{ name: "count", label: "Count", color: "teal" }]}
          />
        </Card>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 7 — Return-to-Work Clearance
// ══════════════════════════════════════════════════════════

function ReturnToWorkPanel() {
  const canCreate = useHasPermission(P.OCC_HEALTH.SCREENINGS_CREATE);
  const qc = useQueryClient();

  const [form, setForm] = useState<ReturnToWorkClearanceRequest>({
    employee_id: "",
    clearance_date: new Date().toISOString().slice(0, 10),
  });

  const clearanceMut = useMutation({
    mutationFn: () => occupationalHealthService.returnToWorkClearance(form),
    onSuccess: () => {
      notifications.show({
        title: "Clearance Issued",
        message:
          "Return-to-work clearance issued successfully. A screening record has been created.",
        color: "success",
      });
      void qc.invalidateQueries({ queryKey: ["occ-screenings"] });
      setForm({
        employee_id: "",
        clearance_date: new Date().toISOString().slice(0, 10),
      });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  return (
    <Stack gap="md" maw={600}>
      <Card withBorder p="lg">
        <Text fw={600} size="lg" mb="sm">
          Issue Return-to-Work Clearance
        </Text>
        <Text size="sm" c="dimmed" mb="md">
          This form creates a fitness clearance for an employee returning from injury or extended
          medical absence. A screening record will be automatically generated.
        </Text>
        <Stack gap="sm">
          <EmployeeSearchSelect
            label="Employee"
            required
            value={form.employee_id}
            onChange={(employeeId) => setForm({ ...form, employee_id: employeeId })}
          />
          <DateInput
            label="Clearance Date"
            required
            value={form.clearance_date ? new Date(form.clearance_date) : null}
            onChange={(d) =>
              setForm({
                ...form,
                clearance_date: d ? new Date(d).toISOString().slice(0, 10) : "",
              })
            }
          />
          <Textarea
            label="Restrictions"
            placeholder="e.g. No heavy lifting for 4 weeks"
            value={form.restrictions ?? ""}
            onChange={(e) => setForm({ ...form, restrictions: e.currentTarget.value || undefined })}
          />
          <DateInput
            label="Follow-up Date"
            value={form.follow_up_date ? new Date(form.follow_up_date) : null}
            onChange={(d) =>
              setForm({
                ...form,
                follow_up_date: d ? new Date(d).toISOString().slice(0, 10) : undefined,
              })
            }
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })}
          />
          {canCreate && (
            <Button
              tone="primary"
              onClick={() => clearanceMut.mutate()}
              loading={clearanceMut.isPending}
              disabled={!form.employee_id || !form.clearance_date}
            >
              Issue RTW Clearance
            </Button>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
