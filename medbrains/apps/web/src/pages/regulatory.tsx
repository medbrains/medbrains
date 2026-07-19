import "@mantine/charts/styles.css";
import { BarChart } from "@mantine/charts";
import {
  Box,
  Drawer,
  Grid,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  ComplianceCalendarEvent,
  ComplianceChecklist,
  ComplianceDashboard,
  CreateCalendarEventRequest,
  CreateChecklistRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconCalendarEvent,
  IconChecklist,
  IconDashboard,
  IconDownload,
  IconFileAlert,
  IconFlask,
  IconLicense,
  IconPlus,
  IconScale,
  IconUpload,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { Badge, type BadgeTone, Button, IconButton, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { regulatoryService } from "@/services/regulatory.service";
import { AdrTab } from "./regulatory/adr-tab";
import { DashboardTab } from "./regulatory/dashboard-tab";
import { LicenseDashboardTab } from "./regulatory/license-dashboard-tab";
import { MockSurveysTab } from "./regulatory/mock-surveys-tab";
import { NablDocumentsTab } from "./regulatory/nabl-documents-tab";
import { PcpndtTab } from "./regulatory/pcpndt-tab";
import { checklistStatusColors } from "./regulatory/shared";
import { StaffCredentialsTab } from "./regulatory/staff-credentials-tab";
import { SubmissionsTab } from "./regulatory/submissions-tab";

const calendarStatusColors: Record<string, BadgeTone> = {
  upcoming: "primary",
  overdue: "danger",
  completed: "success",
  cancelled: "neutral",
};

export function RegulatoryPage() {
  useRequirePermission(P.REGULATORY.DASHBOARD_VIEW);

  return (
    <Tabs defaultValue="dashboard">
      <Tabs.List>
        <Tabs.Tab value="dashboard" leftSection={<IconDashboard size={16} />}>
          Dashboard
        </Tabs.Tab>
        <Tabs.Tab value="checklists" leftSection={<IconChecklist size={16} />}>
          Checklists
        </Tabs.Tab>
        <Tabs.Tab value="adr" leftSection={<IconFileAlert size={16} />}>
          ADR & Device Reports
        </Tabs.Tab>
        <Tabs.Tab value="pcpndt" leftSection={<IconScale size={16} />}>
          PCPNDT Forms
        </Tabs.Tab>
        <Tabs.Tab value="calendar" leftSection={<IconCalendarEvent size={16} />}>
          Compliance Calendar
        </Tabs.Tab>
        <Tabs.Tab value="submissions" leftSection={<IconUpload size={16} />}>
          Submissions
        </Tabs.Tab>
        <Tabs.Tab value="mock-surveys" leftSection={<IconChecklist size={16} />}>
          Mock Surveys
        </Tabs.Tab>
        <Tabs.Tab value="staff-credentials" leftSection={<IconUsers size={16} />}>
          Staff Credentials
        </Tabs.Tab>
        <Tabs.Tab value="licenses" leftSection={<IconLicense size={16} />}>
          License Dashboard
        </Tabs.Tab>
        <Tabs.Tab value="nabl" leftSection={<IconFlask size={16} />}>
          NABL Documents
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="dashboard" pt="md">
        <DashboardTab />
      </Tabs.Panel>
      <Tabs.Panel value="checklists" pt="md">
        <ChecklistsTab />
      </Tabs.Panel>
      <Tabs.Panel value="adr" pt="md">
        <AdrTab />
      </Tabs.Panel>
      <Tabs.Panel value="pcpndt" pt="md">
        <PcpndtTab />
      </Tabs.Panel>
      <Tabs.Panel value="calendar" pt="md">
        <CalendarTab />
      </Tabs.Panel>
      <Tabs.Panel value="submissions" pt="md">
        <SubmissionsTab />
      </Tabs.Panel>
      <Tabs.Panel value="mock-surveys" pt="md">
        <MockSurveysTab />
      </Tabs.Panel>
      <Tabs.Panel value="staff-credentials" pt="md">
        <StaffCredentialsTab />
      </Tabs.Panel>
      <Tabs.Panel value="licenses" pt="md">
        <LicenseDashboardTab />
      </Tabs.Panel>
      <Tabs.Panel value="nabl" pt="md">
        <NablDocumentsTab />
      </Tabs.Panel>
    </Tabs>
  );
}

// ══════════════════════════════════════════════════════════
//  Dashboard Tab
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Checklists Tab
// ══════════════════════════════════════════════════════════

function ChecklistsTab() {
  const [checklistView, setChecklistView] = useState("list");
  const canCreate = useHasPermission(P.REGULATORY.CHECKLISTS_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [bodyFilter, setBodyFilter] = useState<string | null>(null);

  const { data: checklists = [], isLoading } = useQuery<ComplianceChecklist[]>({
    queryKey: ["regulatory-checklists", bodyFilter],
    queryFn: () =>
      regulatoryService.listChecklists(bodyFilter ? { accreditation_body: bodyFilter } : undefined),
  });

  const [form, setForm] = useState<CreateChecklistRequest>({
    accreditation_body: "nabh",
    standard_code: "",
    name: "",
    assessment_period_start: "",
    assessment_period_end: "",
  });

  const createMut = useMutation({
    mutationFn: (data: CreateChecklistRequest) => regulatoryService.createChecklist(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["regulatory-checklists"] });
      toast.success("", { title: "Checklist created" });
      close();
    },
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="Compliance Checklists"
        subtitle="Department-wise regulatory compliance assessments"
        actions={
          canCreate ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
              New Checklist
            </Button>
          ) : undefined
        }
      />

      <SegmentedControl
        value={checklistView}
        onChange={setChecklistView}
        data={[
          { value: "list", label: "Checklist List" },
          { value: "gap-analysis", label: "Gap Analysis" },
        ]}
      />

      {checklistView === "list" ? (
        <ChecklistListView
          checklists={checklists}
          isLoading={isLoading}
          bodyFilter={bodyFilter}
          setBodyFilter={setBodyFilter}
        />
      ) : (
        <GapAnalysisView checklists={checklists} isLoading={isLoading} />
      )}

      <Drawer
        opened={opened}
        onClose={close}
        title="New Compliance Checklist"
        position="right"
        size="xl"
      >
        <Stack gap="sm">
          <TextInput
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
          />
          <Select
            label="Accreditation Body"
            required
            value={form.accreditation_body}
            onChange={(v) => setForm({ ...form, accreditation_body: v ?? "nabh" })}
            data={[
              { value: "nabh", label: "NABH" },
              { value: "nmc", label: "NMC" },
              { value: "nabl", label: "NABL" },
              { value: "jci", label: "JCI" },
              { value: "abdm", label: "ABDM" },
              { value: "other", label: "Other" },
            ]}
          />
          <TextInput
            label="Standard Code"
            required
            value={form.standard_code}
            onChange={(e) => setForm({ ...form, standard_code: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
          />
          <DateInput
            label="Assessment Start"
            required
            value={form.assessment_period_start ? new Date(form.assessment_period_start) : null}
            onChange={(d) =>
              setForm({
                ...form,
                assessment_period_start: d ? new Date(d).toISOString().slice(0, 10) : "",
              })
            }
          />
          <DateInput
            label="Assessment End"
            required
            value={form.assessment_period_end ? new Date(form.assessment_period_end) : null}
            onChange={(d) =>
              setForm({
                ...form,
                assessment_period_end: d ? new Date(d).toISOString().slice(0, 10) : "",
              })
            }
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate(form)}
            loading={createMut.isPending}
          >
            Create Checklist
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

function ChecklistListView({
  checklists,
  isLoading,
  bodyFilter,
  setBodyFilter,
}: {
  checklists: ComplianceChecklist[];
  isLoading: boolean;
  bodyFilter: string | null;
  setBodyFilter: (v: string | null) => void;
}) {
  const canUpdate = useHasPermission(P.REGULATORY.CHECKLISTS_UPDATE);
  const qc = useQueryClient();

  const autoPopulateMut = useMutation({
    mutationFn: (id: string) => regulatoryService.autoPopulateChecklist(id),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["regulatory-checklists"] });
      toast.success(`${result.updated} item(s) updated`, { title: "Auto-populated" });
    },
    onError: () => {
      toast.error("Could not auto-populate checklist", { title: "Auto-populate failed" });
    },
  });

  return (
    <Stack gap="md">
      <Group>
        <Select
          placeholder="Filter by body"
          clearable
          value={bodyFilter}
          onChange={setBodyFilter}
          data={[
            { value: "nabh", label: "NABH" },
            { value: "nmc", label: "NMC" },
            { value: "nabl", label: "NABL" },
            { value: "jci", label: "JCI" },
            { value: "abdm", label: "ABDM" },
          ]}
        />
      </Group>

      <DataTable
        data={checklists}
        rowKey={(r) => r.id}
        loading={isLoading}
        columns={[
          {
            key: "name",
            label: "Name",
            render: (r) => (
              <Text size="sm" fw={500}>
                {r.name}
              </Text>
            ),
          },
          {
            key: "accreditation_body",
            label: "Body",
            render: (r) => (
              <Badge tone="neutral" size="sm" tt="uppercase">
                {r.accreditation_body}
              </Badge>
            ),
          },
          {
            key: "standard_code",
            label: "Standard",
            render: (r) => <Text size="sm">{r.standard_code}</Text>,
          },
          {
            key: "overall_status",
            label: "Status",
            render: (r) => (
              <Badge tone={checklistStatusColors[r.overall_status]}>
                {r.overall_status.replace(/_/g, " ")}
              </Badge>
            ),
          },
          {
            key: "compliance_score",
            label: "Score",
            render: (r) =>
              r.compliance_score != null ? (
                <Badge
                  tone={
                    r.compliance_score >= 80
                      ? "success"
                      : r.compliance_score >= 60
                        ? "warning"
                        : "danger"
                  }
                >
                  {r.compliance_score}%
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">
                  -
                </Text>
              ),
          },
          {
            key: "items",
            label: "Items",
            render: (r) => (
              <Text size="sm">
                {r.compliant_items}/{r.total_items}
              </Text>
            ),
          },
          {
            key: "period",
            label: "Period",
            render: (r) => (
              <Text size="sm">
                {r.assessment_period_start} — {r.assessment_period_end}
              </Text>
            ),
          },
          {
            key: "actions",
            label: "Actions",
            render: (r) =>
              canUpdate ? (
                <Tooltip label="Auto-populate from system data">
                  <Button
                    tone="secondary"
                    size="compact-xs"
                    loading={autoPopulateMut.isPending}
                    onClick={() => autoPopulateMut.mutate(r.id)}
                  >
                    Auto-Populate
                  </Button>
                </Tooltip>
              ) : null,
          },
        ]}
      />
    </Stack>
  );
}

function GapAnalysisView({
  checklists,
  isLoading,
}: {
  checklists: ComplianceChecklist[];
  isLoading: boolean;
}) {
  const chartData = useMemo(() => {
    return checklists.map((c) => {
      const partialItems = c.total_items - c.compliant_items - c.non_compliant_items;
      return {
        name: c.name.length > 30 ? `${c.name.slice(0, 27)}...` : c.name,
        met: c.compliant_items,
        partial: partialItems,
        unmet: c.non_compliant_items,
      };
    });
  }, [checklists]);

  const summaryData = useMemo(() => {
    return checklists.map((c) => {
      const partialItems = c.total_items - c.compliant_items - c.non_compliant_items;
      const metPercent =
        c.total_items > 0 ? Math.round((c.compliant_items / c.total_items) * 100) : 0;
      const partialPercent =
        c.total_items > 0 ? Math.round((partialItems / c.total_items) * 100) : 0;
      const unmetPercent =
        c.total_items > 0 ? Math.round((c.non_compliant_items / c.total_items) * 100) : 0;

      return {
        id: c.id,
        name: c.name,
        body: c.accreditation_body,
        total: c.total_items,
        met: c.compliant_items,
        partial: partialItems,
        unmet: c.non_compliant_items,
        metPercent,
        partialPercent,
        unmetPercent,
      };
    });
  }, [checklists]);

  if (isLoading) {
    return <Text>Loading gap analysis...</Text>;
  }

  return (
    <Stack gap="lg">
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text fw={600}>Gap Analysis Visual Report</Text>
          <Button tone="secondary" leftSection={<IconDownload size={16} />} size="sm">
            Export Report
          </Button>
        </Group>

        {chartData.length > 0 ? (
          <BarChart
            h={400}
            data={chartData}
            dataKey="name"
            series={[
              { name: "met", label: "Met", color: "success" },
              { name: "partial", label: "Partial", color: "warning" },
              { name: "unmet", label: "Unmet", color: "danger" },
            ]}
            type="stacked"
            orientation="horizontal"
          />
        ) : (
          <Text c="dimmed">No checklists available for analysis</Text>
        )}
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={600} mb="md">
          Detailed Gap Breakdown
        </Text>
        <DataTable
          data={summaryData}
          rowKey={(r) => r.id}
          loading={false}
          columns={[
            {
              key: "name",
              label: "Checklist",
              render: (r) => (
                <Text size="sm" fw={500}>
                  {r.name}
                </Text>
              ),
            },
            {
              key: "body",
              label: "Body",
              render: (r) => (
                <Badge tone="neutral" size="sm" tt="uppercase">
                  {r.body}
                </Badge>
              ),
            },
            { key: "total", label: "Total", render: (r) => <Text size="sm">{r.total}</Text> },
            {
              key: "met",
              label: "Met",
              render: (r) => (
                <Group gap={4}>
                  <Text size="sm" c="success" fw={600}>
                    {r.met}
                  </Text>
                  <Text size="xs" c="dimmed">
                    ({r.metPercent}%)
                  </Text>
                </Group>
              ),
            },
            {
              key: "partial",
              label: "Partial",
              render: (r) => (
                <Group gap={4}>
                  <Text size="sm" c="warning" fw={600}>
                    {r.partial}
                  </Text>
                  <Text size="xs" c="dimmed">
                    ({r.partialPercent}%)
                  </Text>
                </Group>
              ),
            },
            {
              key: "unmet",
              label: "Unmet",
              render: (r) => (
                <Group gap={4}>
                  <Text size="sm" c="danger" fw={600}>
                    {r.unmet}
                  </Text>
                  <Text size="xs" c="dimmed">
                    ({r.unmetPercent}%)
                  </Text>
                </Group>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => (
                <Badge
                  tone={r.metPercent >= 80 ? "success" : r.metPercent >= 50 ? "warning" : "danger"}
                >
                  {r.metPercent >= 80 ? "Good" : r.metPercent >= 50 ? "Fair" : "Critical"}
                </Badge>
              ),
            },
          ]}
        />
      </Paper>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  ADR & Device Reports Tab
// ══════════════════════════════════════════════════════════

function CalendarTab() {
  const [calendarView, setCalendarView] = useState("list");
  const canManage = useHasPermission(P.REGULATORY.CALENDAR_MANAGE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: events = [], isLoading } = useQuery<ComplianceCalendarEvent[]>({
    queryKey: ["regulatory-calendar", statusFilter],
    queryFn: () =>
      regulatoryService.listCalendarEvents(statusFilter ? { status: statusFilter } : undefined),
  });

  const { data: overdue = [] } = useQuery<ComplianceCalendarEvent[]>({
    queryKey: ["regulatory-calendar-overdue"],
    queryFn: () => regulatoryService.getOverdueCalendarEvents(),
  });

  const { data: dashboard } = useQuery<ComplianceDashboard>({
    queryKey: ["regulatory-dashboard"],
    queryFn: () => regulatoryService.getRegulatoryDashboard(),
  });

  const [form, setForm] = useState<CreateCalendarEventRequest>({
    title: "",
    event_type: "custom",
    due_date: "",
  });

  const createMut = useMutation({
    mutationFn: (data: CreateCalendarEventRequest) => regulatoryService.createCalendarEvent(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["regulatory-calendar"] });
      toast.success("", { title: "Calendar event created" });
      close();
    },
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => regulatoryService.updateCalendarEvent(id, { status: "completed" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["regulatory-calendar"] });
      toast.success("", { title: "Marked complete" });
    },
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="Compliance Calendar"
        subtitle="Unified regulatory deadline tracking"
        actions={
          canManage ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
              New Event
            </Button>
          ) : undefined
        }
      />

      <SegmentedControl
        value={calendarView}
        onChange={setCalendarView}
        data={[
          { value: "list", label: "Calendar List" },
          { value: "license-alerts", label: "License Alerts" },
          { value: "timeline", label: "Timeline View" },
        ]}
      />

      {calendarView === "list" ? (
        <CalendarListView
          events={events}
          overdue={overdue}
          isLoading={isLoading}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          completeMut={completeMut}
          canManage={canManage}
        />
      ) : calendarView === "license-alerts" ? (
        <LicenseAlertsView dashboard={dashboard} />
      ) : (
        <TimelineView events={events} isLoading={isLoading} />
      )}

      <Drawer opened={opened} onClose={close} title="New Calendar Event" position="right" size="xl">
        <Stack gap="sm">
          <TextInput
            label="Title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
          />
          <Select
            label="Event Type"
            required
            value={form.event_type}
            onChange={(v) => setForm({ ...form, event_type: v ?? "custom" })}
            data={[
              { value: "license_renewal", label: "License Renewal" },
              { value: "inspection", label: "Inspection" },
              { value: "audit", label: "Audit" },
              { value: "report_due", label: "Report Due" },
              { value: "training", label: "Training" },
              { value: "review", label: "Review" },
              { value: "custom", label: "Custom" },
            ]}
          />
          <DateInput
            label="Due Date"
            required
            value={form.due_date ? new Date(form.due_date) : null}
            onChange={(d) =>
              setForm({ ...form, due_date: d ? new Date(d).toISOString().slice(0, 10) : "" })
            }
          />
          <Select
            label="Recurrence"
            value={form.recurrence ?? "once"}
            onChange={(v) => setForm({ ...form, recurrence: v ?? "once" })}
            data={[
              { value: "once", label: "One-time" },
              { value: "monthly", label: "Monthly" },
              { value: "quarterly", label: "Quarterly" },
              { value: "semi_annual", label: "Semi-Annual" },
              { value: "annual", label: "Annual" },
            ]}
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate(form)}
            loading={createMut.isPending}
          >
            Create Event
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

function CalendarListView({
  events,
  overdue,
  isLoading,
  statusFilter,
  setStatusFilter,
  completeMut,
  canManage,
}: {
  events: ComplianceCalendarEvent[];
  overdue: ComplianceCalendarEvent[];
  isLoading: boolean;
  statusFilter: string | null;
  setStatusFilter: (v: string | null) => void;
  completeMut: { mutate: (id: string) => void };
  canManage: boolean;
}) {
  return (
    <Stack gap="md">
      {overdue.length > 0 && (
        <Paper p="sm" withBorder bg="red.0">
          <Text size="sm" c="red.8" fw={600}>
            {overdue.length} overdue compliance deadline(s) require immediate attention
          </Text>
        </Paper>
      )}

      <Group>
        <Select
          placeholder="Filter by status"
          clearable
          value={statusFilter}
          onChange={setStatusFilter}
          data={[
            { value: "upcoming", label: "Upcoming" },
            { value: "overdue", label: "Overdue" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
      </Group>

      <DataTable
        data={events}
        rowKey={(r) => r.id}
        loading={isLoading}
        columns={[
          {
            key: "title",
            label: "Title",
            render: (r) => (
              <Text size="sm" fw={500}>
                {r.title}
              </Text>
            ),
          },
          {
            key: "event_type",
            label: "Type",
            render: (r) => (
              <Badge tone="neutral" size="sm">
                {r.event_type.replace(/_/g, " ")}
              </Badge>
            ),
          },
          {
            key: "due_date",
            label: "Due Date",
            render: (r) => (
              <Text
                size="sm"
                c={r.status === "overdue" ? "danger" : undefined}
                fw={r.status === "overdue" ? 600 : undefined}
              >
                {r.due_date}
              </Text>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r) => <Badge tone={calendarStatusColors[r.status]}>{r.status}</Badge>,
          },
          {
            key: "recurrence",
            label: "Recurrence",
            render: (r) => (
              <Text size="sm" tt="capitalize">
                {r.recurrence}
              </Text>
            ),
          },
          {
            key: "actions",
            label: "Actions",
            render: (r) =>
              r.status !== "completed" && canManage ? (
                <Group gap={4}>
                  <IconButton
                    tone="success"
                    onClick={() => completeMut.mutate(r.id)}
                    title="Mark complete"
                    aria-label="Checklist"
                  >
                    <IconChecklist size={14} />
                  </IconButton>
                </Group>
              ) : null,
          },
        ]}
      />
    </Stack>
  );
}

function LicenseAlertsView({ dashboard }: { dashboard?: ComplianceDashboard }) {
  if (!dashboard) {
    return <Text>Loading license data...</Text>;
  }

  const getDaysUntilExpiry = (dueDate: string): number => {
    const due = new Date(dueDate);
    const now = new Date();
    const diff = due.getTime() - now.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getLicenseColor = (days: number): string => {
    if (days < 0) return "danger";
    if (days < 30) return "danger";
    if (days < 60) return "orange";
    if (days < 90) return "warning";
    return "success";
  };

  const licenseTone = (days: number): BadgeTone => {
    const c = getLicenseColor(days);
    return c === "orange" ? "warning" : (c as BadgeTone);
  };

  const licenseRenewalEvents = dashboard.upcoming_deadlines.filter(
    (e) => e.event_type === "license_renewal",
  );

  return (
    <Stack gap="lg">
      <Paper p="md" withBorder>
        <Group justify="space-between">
          <div>
            <Text fw={600} size="lg">
              License Renewal Tracking
            </Text>
            <Text size="sm" c="dimmed">
              Licenses expiring within 90 days
            </Text>
          </div>
          <Paper
            p="md"
            withBorder
            bg={dashboard.license_expiring_soon > 0 ? "orange.0" : "green.0"}
          >
            <Text size="xs" c="dimmed">
              Expiring Soon
            </Text>
            <Title order={2} c={dashboard.license_expiring_soon > 0 ? "orange" : "success"}>
              {dashboard.license_expiring_soon}
            </Title>
          </Paper>
        </Group>
      </Paper>

      {licenseRenewalEvents.length > 0 ? (
        <Paper p="md" withBorder>
          <Text fw={600} mb="md">
            License Renewal Schedule
          </Text>
          <DataTable
            data={licenseRenewalEvents}
            rowKey={(r) => r.id}
            loading={false}
            columns={[
              {
                key: "title",
                label: "License",
                render: (r) => (
                  <Text size="sm" fw={500}>
                    {r.title}
                  </Text>
                ),
              },
              {
                key: "description",
                label: "Description",
                render: (r) => (
                  <Text size="sm" lineClamp={1}>
                    {r.description || "-"}
                  </Text>
                ),
              },
              {
                key: "due_date",
                label: "Expiry Date",
                render: (r) => {
                  const days = getDaysUntilExpiry(r.due_date);
                  return (
                    <div>
                      <Text size="sm" c={getLicenseColor(days)} fw={600}>
                        {r.due_date}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {days >= 0 ? `${days} days left` : `${Math.abs(days)} days overdue`}
                      </Text>
                    </div>
                  );
                },
              },
              {
                key: "urgency",
                label: "Urgency",
                render: (r) => {
                  const days = getDaysUntilExpiry(r.due_date);
                  return (
                    <Badge tone={licenseTone(days)} size="lg">
                      {days < 0
                        ? "EXPIRED"
                        : days < 30
                          ? "CRITICAL"
                          : days < 60
                            ? "HIGH"
                            : days < 90
                              ? "MEDIUM"
                              : "LOW"}
                    </Badge>
                  );
                },
              },
              {
                key: "status",
                label: "Status",
                render: (r) => <Badge tone={calendarStatusColors[r.status]}>{r.status}</Badge>,
              },
            ]}
          />
        </Paper>
      ) : (
        <Paper p="xl" withBorder>
          <Stack align="center" gap="xs">
            <Text size="lg" c="dimmed">
              No license renewals due within 90 days
            </Text>
            <Text size="sm" c="success">
              All licenses are current
            </Text>
          </Stack>
        </Paper>
      )}

      <Paper p="md" withBorder bg="blue.0">
        <Text size="sm" fw={600} mb="xs">
          Alert Thresholds
        </Text>
        <Grid>
          <Grid.Col span={3}>
            <Badge tone="danger" size="lg" fullWidth>
              Critical: Less than 30 days
            </Badge>
          </Grid.Col>
          <Grid.Col span={3}>
            <Badge tone="warning" size="lg" fullWidth>
              High: 30-60 days
            </Badge>
          </Grid.Col>
          <Grid.Col span={3}>
            <Badge tone="warning" size="lg" fullWidth>
              Medium: 60-90 days
            </Badge>
          </Grid.Col>
          <Grid.Col span={3}>
            <Badge tone="success" size="lg" fullWidth>
              Low: More than 90 days
            </Badge>
          </Grid.Col>
        </Grid>
      </Paper>
    </Stack>
  );
}

function TimelineView({
  events,
  isLoading,
}: {
  events: ComplianceCalendarEvent[];
  isLoading: boolean;
}) {
  const timelineData = useMemo(() => {
    const monthsMap: Record<string, ComplianceCalendarEvent[]> = {};

    events.forEach((event) => {
      const eventDate = new Date(event.due_date);
      const monthKey = eventDate.toLocaleDateString("en-US", { year: "numeric", month: "short" });

      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = [];
      }
      monthsMap[monthKey].push(event);
    });

    return Object.entries(monthsMap)
      .sort((a, b) => {
        const aFirstEvent = a[1][0];
        const bFirstEvent = b[1][0];
        if (!aFirstEvent || !bFirstEvent) return 0;
        return new Date(aFirstEvent.due_date).getTime() - new Date(bFirstEvent.due_date).getTime();
      })
      .map(([month, evts]) => ({ month, events: evts }));
  }, [events]);

  if (isLoading) {
    return <Text>Loading timeline...</Text>;
  }

  return (
    <Stack gap="lg">
      <Paper p="md" withBorder>
        <Text fw={600} mb="md">
          Compliance Calendar Timeline
        </Text>
        <Text size="sm" c="dimmed" mb="lg">
          Horizontal view of all compliance deadlines grouped by month
        </Text>

        {timelineData.length > 0 ? (
          <Stack gap="xl">
            {timelineData.map(({ month, events: monthEvents }) => (
              <div key={month}>
                <Text fw={600} size="sm" mb="xs" c="primary">
                  {month}
                </Text>
                <Stack gap="xs">
                  {monthEvents.map((event) => {
                    const startDate = new Date(event.due_date);
                    startDate.setDate(startDate.getDate() - 14);
                    const daysFromStart = Math.max(
                      0,
                      Math.floor(
                        (new Date(event.due_date).getTime() - startDate.getTime()) /
                          (1000 * 60 * 60 * 24),
                      ),
                    );
                    const barColor =
                      event.status === "overdue"
                        ? "danger"
                        : event.status === "completed"
                          ? "success"
                          : "warning";

                    return (
                      <Box key={event.id} pos="relative">
                        <Group gap="xs" wrap="nowrap">
                          <Box
                            style={{
                              width: "100%",
                              height: "32px",
                              background: `linear-gradient(to right, transparent ${daysFromStart * 3}%, var(--mantine-color-${barColor}-4) ${daysFromStart * 3}%, var(--mantine-color-${barColor}-4) 100%)`,
                              borderRadius: "0",
                              border: `1px solid var(--mantine-color-${barColor}-6)`,
                              display: "flex",
                              alignItems: "center",
                              paddingLeft: "8px",
                            }}
                          >
                            <Text size="xs" fw={600} c={barColor === "warning" ? "dark" : "white"}>
                              {event.title.length > 50
                                ? `${event.title.slice(0, 47)}...`
                                : event.title}
                            </Text>
                          </Box>
                          <Badge tone={barColor} size="sm" style={{ minWidth: "80px" }}>
                            {event.due_date}
                          </Badge>
                        </Group>
                      </Box>
                    );
                  })}
                </Stack>
              </div>
            ))}
          </Stack>
        ) : (
          <Text c="dimmed">No events to display on timeline</Text>
        )}
      </Paper>

      <Paper p="md" withBorder bg="gray.0">
        <Text size="sm" fw={600} mb="xs">
          Timeline Legend
        </Text>
        <Group gap="md">
          <Group gap="xs">
            <Box w={20} h={20} bg="green.4" style={{ borderRadius: 0 }} />
            <Text size="sm">Completed</Text>
          </Group>
          <Group gap="xs">
            <Box w={20} h={20} bg="yellow.4" style={{ borderRadius: 0 }} />
            <Text size="sm">Upcoming</Text>
          </Group>
          <Group gap="xs">
            <Box w={20} h={20} bg="red.4" style={{ borderRadius: 0 }} />
            <Text size="sm">Overdue</Text>
          </Group>
        </Group>
      </Paper>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Submissions Tab
// ══════════════════════════════════════════════════════════
