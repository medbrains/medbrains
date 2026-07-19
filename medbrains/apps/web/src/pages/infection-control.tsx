import "@mantine/charts/styles.css";
import { BarChart, LineChart } from "@mantine/charts";
import {
  Card,
  Drawer,
  Grid,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Timeline,
  Title,
  Tooltip,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  AntimicrobialConsumptionRow,
  CreateExposureRequest,
  CreateHygieneAuditRequest,
  CreateIcMeetingRequest,
  CreateOutbreakRequest,
  CultureSensitivityRow,
  CultureSurveillance,
  DeviceUtilizationRow,
  HandHygieneAudit,
  IcMeeting,
  NeedleStickIncident,
  OutbreakContact,
  OutbreakEvent,
  OutbreakStatusType,
  SurgicalProphylaxisRow,
  UpdateOutbreakRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconBiohazard,
  IconBug,
  IconChartBar,
  IconEye,
  IconHandStop,
  IconNeedleThread,
  IconPill,
  IconPlus,
  IconShieldCheck,
  IconTemperature,
  IconUsers,
  IconVirusSearch,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { DataTable, IpdContextStrip, ipdContextFromSearchParams, PageHeader } from "@/components";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, IconButton, Table } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { InvasiveDevicesPanel } from "@/pages/infection-control/InvasiveDevicesPanel";
import { infectionControlService } from "@/services/infectionControl.service";
import { BiowasteTab } from "./infection-control/biowaste-tab";
import { statusColorTone } from "./infection-control/shared";
import { StewardshipTab } from "./infection-control/stewardship-tab";
import { SurveillanceTab } from "./infection-control/surveillance-tab";

// ── Color Maps ──────────────────────────────────────────

// Dropdown options for categorical fields

const STAFF_CATEGORIES = [
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "technician", label: "Technician" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "paramedic", label: "Paramedic" },
  { value: "admin", label: "Administrative" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
];

const INFECTION_CONTROL_PAGE_PERMISSIONS = [
  P.INFECTION_CONTROL.SURVEILLANCE_LIST,
  P.INFECTION_CONTROL.STEWARDSHIP_LIST,
  P.INFECTION_CONTROL.BIOWASTE_LIST,
  P.INFECTION_CONTROL.HYGIENE_LIST,
  P.INFECTION_CONTROL.OUTBREAK_LIST,
] as const;

// ── HAI Surveillance Tab ────────────────────────────────

function HygieneTab() {
  const canCreate = useHasPermission(P.INFECTION_CONTROL.HYGIENE_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [subView, setSubView] = useState<string>("audits");

  const { data: audits = [], isLoading } = useQuery({
    queryKey: ["ic-hygiene"],
    queryFn: () => infectionControlService.listHygieneAudits(),
  });

  const { data: cultures = [], isLoading: culturesLoading } = useQuery({
    queryKey: ["ic-cultures"],
    queryFn: () => infectionControlService.listCultureSurveillance(),
  });

  // Feature 2: Bundle compliance stats
  const { data: deviceDays = [] } = useQuery({
    queryKey: ["ic-device-days"],
    queryFn: () => infectionControlService.listDeviceDays(),
  });

  // Feature 3: Hand hygiene audit bar chart by department
  const hygieneChartData = useMemo(() => {
    const byDept: Record<string, { total: number; compliant: number; count: number }> = {};
    audits.forEach((a) => {
      const dept = a.department_id;
      if (!dept) return;
      if (!byDept[dept]) byDept[dept] = { total: 0, compliant: 0, count: 0 };
      byDept[dept].total += a.observations;
      byDept[dept].compliant += a.compliant;
      byDept[dept].count++;
    });
    return Object.entries(byDept).map(([dept, data]) => ({
      department: dept,
      compliance: data.total > 0 ? Math.round((data.compliant / data.total) * 100) : 0,
    }));
  }, [audits]);

  // Feature 6: Environmental monitoring pass/fail
  const envMonitoringSummary = useMemo(() => {
    const byLocation: Record<string, { pass: number; fail: number }> = {};
    cultures.forEach((c) => {
      const loc = c.sample_site;
      if (!byLocation[loc]) byLocation[loc] = { pass: 0, fail: 0 };
      if (c.acceptable === true) byLocation[loc].pass++;
      else if (c.acceptable === false) byLocation[loc].fail++;
    });
    const totalPass = Object.values(byLocation).reduce((sum, d) => sum + d.pass, 0);
    const totalFail = Object.values(byLocation).reduce((sum, d) => sum + d.fail, 0);
    const total = totalPass + totalFail;
    return {
      passRate: total > 0 ? ((totalPass / total) * 100).toFixed(1) : "0.0",
      total,
      totalPass,
      totalFail,
    };
  }, [cultures]);

  const [form, setForm] = useState<CreateHygieneAuditRequest>({
    audit_date: "",
    department_id: "",
    observations: 0,
    compliant: 0,
    non_compliant: 0,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateHygieneAuditRequest) =>
      infectionControlService.createHygieneAudit(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ic-hygiene"] });
      notifications.show({ title: "Audit recorded", message: "", color: "success" });
      close();
    },
  });

  const auditColumns = [
    {
      key: "audit_date" as const,
      label: "Date",
      render: (r: HandHygieneAudit) => new Date(r.audit_date).toLocaleDateString(),
    },
    {
      key: "observations" as const,
      label: "Observations",
      render: (r: HandHygieneAudit) => String(r.observations),
    },
    {
      key: "compliant" as const,
      label: "Compliant",
      render: (r: HandHygieneAudit) => <Badge tone="success">{r.compliant}</Badge>,
    },
    {
      key: "non_compliant" as const,
      label: "Non-Compliant",
      render: (r: HandHygieneAudit) => <Badge tone="danger">{r.non_compliant}</Badge>,
    },
    {
      key: "compliance_rate" as const,
      label: "Rate",
      render: (r: HandHygieneAudit) =>
        r.compliance_rate != null ? `${Number(r.compliance_rate).toFixed(1)}%` : "---",
    },
    {
      key: "staff_category" as const,
      label: "Staff Category",
      render: (r: HandHygieneAudit) => r.staff_category ?? "---",
    },
    {
      key: "findings" as const,
      label: "Findings",
      render: (r: HandHygieneAudit) => r.findings ?? "---",
    },
  ];

  const cultureColumns = [
    {
      key: "culture_type" as const,
      label: "Type",
      render: (r: CultureSurveillance) => r.culture_type,
    },
    {
      key: "sample_site" as const,
      label: "Site",
      render: (r: CultureSurveillance) => r.sample_site,
    },
    {
      key: "collection_date" as const,
      label: "Date",
      render: (r: CultureSurveillance) => new Date(r.collection_date).toLocaleDateString(),
    },
    {
      key: "organism" as const,
      label: "Organism",
      render: (r: CultureSurveillance) => r.organism ?? "---",
    },
    {
      key: "acceptable" as const,
      label: "Status",
      render: (r: CultureSurveillance) =>
        r.acceptable == null ? (
          <Badge tone="neutral">Pending</Badge>
        ) : r.acceptable ? (
          <Badge tone="success">Pass</Badge>
        ) : (
          <Badge tone="danger">Fail</Badge>
        ),
    },
    {
      key: "action_taken" as const,
      label: "Action",
      render: (r: CultureSurveillance) => r.action_taken ?? "---",
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <SegmentedControl
          value={subView}
          onChange={setSubView}
          data={[
            { value: "audits", label: "Hand Hygiene" },
            { value: "bundles", label: "Bundle Compliance" },
            { value: "cultures", label: "Environmental" },
          ]}
        />
        {canCreate && subView === "audits" && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            New Audit
          </Button>
        )}
      </Group>

      {subView === "audits" && (
        <>
          <DataTable
            columns={auditColumns}
            data={audits}
            loading={isLoading}
            rowKey={(r) => r.id}
            emptyTitle="No hygiene audits"
          />
          {hygieneChartData.length > 0 && (
            <Paper p="md" withBorder mt="md">
              <Title order={5} mb="md">
                Compliance Rate by Department
              </Title>
              <BarChart
                h={300}
                data={hygieneChartData}
                dataKey="department"
                series={[{ name: "compliance", label: "Compliance %", color: "teal" }]}
                tickLine="y"
              />
            </Paper>
          )}
        </>
      )}

      {subView === "bundles" && (
        <Stack>
          <Card withBorder p="md">
            <Text size="sm" c="dimmed" mb="xs">
              Bundle Compliance Summary
            </Text>
            <Text size="sm">
              Based on device-day records. Individual bundle compliance tracking requires structured
              bundle_compliance field in device day records.
            </Text>
          </Card>
          <Grid>
            <Grid.Col span={4}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Total Device Days
                </Text>
                <Text size="xl" fw={600}>
                  {deviceDays.length}
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={4}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Central Line Days
                </Text>
                <Text size="xl" fw={600}>
                  {deviceDays.reduce((sum, d) => sum + d.central_line_days, 0)}
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={4}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Ventilator Days
                </Text>
                <Text size="xl" fw={600}>
                  {deviceDays.reduce((sum, d) => sum + d.ventilator_days, 0)}
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={4}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Catheter Days
                </Text>
                <Text size="xl" fw={600}>
                  {deviceDays.reduce((sum, d) => sum + d.urinary_catheter_days, 0)}
                </Text>
              </Card>
            </Grid.Col>
          </Grid>
        </Stack>
      )}

      {subView === "cultures" && (
        <>
          <Grid>
            <Grid.Col span={3}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Pass Rate
                </Text>
                <Text size="xl" fw={600} c="teal">
                  {envMonitoringSummary.passRate}%
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={3}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Total Samples
                </Text>
                <Text size="xl" fw={600}>
                  {envMonitoringSummary.total}
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={3}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Passed
                </Text>
                <Text size="xl" fw={600} c="success">
                  {envMonitoringSummary.totalPass}
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={3}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Failed
                </Text>
                <Text size="xl" fw={600} c="danger">
                  {envMonitoringSummary.totalFail}
                </Text>
              </Card>
            </Grid.Col>
          </Grid>
          <DataTable
            columns={cultureColumns}
            data={cultures}
            loading={culturesLoading}
            rowKey={(r) => r.id}
            emptyTitle="No culture records"
          />
        </>
      )}

      <Drawer opened={opened} onClose={close} title="Hand Hygiene Audit" position="right" size="xl">
        <Stack>
          <TextInput
            label="Audit Date"
            type="datetime-local"
            required
            value={form.audit_date}
            onChange={(e) => setForm({ ...form, audit_date: e.currentTarget.value })}
          />
          <DepartmentSelect
            value={form.department_id}
            onChange={(id) => setForm({ ...form, department_id: id })}
            required
          />
          <NumberInput
            label="Total Observations"
            required
            value={form.observations}
            onChange={(v) => setForm({ ...form, observations: Number(v) })}
          />
          <NumberInput
            label="Compliant"
            required
            value={form.compliant}
            onChange={(v) => setForm({ ...form, compliant: Number(v) })}
          />
          <NumberInput
            label="Non-Compliant"
            required
            value={form.non_compliant}
            onChange={(v) => setForm({ ...form, non_compliant: Number(v) })}
          />
          <Select
            label="Staff Category"
            data={STAFF_CATEGORIES}
            value={form.staff_category ?? null}
            onChange={(v) => setForm({ ...form, staff_category: v || undefined })}
            clearable
            searchable
          />
          <Textarea
            label="Findings"
            value={form.findings ?? ""}
            onChange={(e) => setForm({ ...form, findings: e.currentTarget.value || undefined })}
          />
          <Button
            tone="primary"
            loading={createMut.isPending}
            onClick={() => createMut.mutate(form)}
          >
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Outbreak Tab ────────────────────────────────────────

function OutbreakTab() {
  const canCreate = useHasPermission(P.INFECTION_CONTROL.OUTBREAK_CREATE);
  const canUpdate = useHasPermission(P.INFECTION_CONTROL.OUTBREAK_UPDATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<OutbreakEvent | null>(null);

  const { data: outbreaks = [], isLoading } = useQuery({
    queryKey: ["ic-outbreaks", statusFilter],
    queryFn: () =>
      infectionControlService.listOutbreaks({ outbreak_status: statusFilter ?? undefined }),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["ic-outbreak-contacts", selected?.id],
    queryFn: () =>
      selected ? infectionControlService.listOutbreakContacts(selected.id) : Promise.resolve([]),
    enabled: !!selected,
  });

  // Feature 5: Outbreak timeline chart
  const timelineChartData = useMemo(() => {
    if (!selected) return [];
    const data: { date: string; cases: number }[] = [];
    data.push({
      date: new Date(selected.detected_date).toLocaleDateString(),
      cases: selected.initial_cases,
    });
    if (selected.total_cases > selected.initial_cases) {
      data.push({
        date: new Date(selected.created_at).toLocaleDateString(),
        cases: selected.total_cases,
      });
    }
    return data;
  }, [selected]);

  const [form, setForm] = useState<CreateOutbreakRequest>({
    organism: "",
    detected_date: "",
    initial_cases: 1,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateOutbreakRequest) => infectionControlService.createOutbreak(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ic-outbreaks"] });
      notifications.show({ title: "Outbreak reported", message: "", color: "success" });
      close();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOutbreakRequest }) =>
      infectionControlService.updateOutbreak(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ic-outbreaks"] });
      notifications.show({ title: "Outbreak updated", message: "", color: "success" });
    },
  });

  const statusTransitions: Record<string, string[]> = {
    suspected: ["confirmed"],
    confirmed: ["contained"],
    contained: ["closed"],
  };

  const columns = [
    {
      key: "outbreak_number" as const,
      label: "Number",
      render: (r: OutbreakEvent) => <Text fw={500}>{r.outbreak_number}</Text>,
    },
    { key: "organism" as const, label: "Organism", render: (r: OutbreakEvent) => r.organism },
    {
      key: "outbreak_status" as const,
      label: "Status",
      render: (r: OutbreakEvent) => (
        <Badge tone={statusColorTone(r.outbreak_status)}>{r.outbreak_status}</Badge>
      ),
    },
    {
      key: "total_cases" as const,
      label: "Cases",
      render: (r: OutbreakEvent) => String(r.total_cases),
    },
    {
      key: "detected_date" as const,
      label: "Detected",
      render: (r: OutbreakEvent) => new Date(r.detected_date).toLocaleDateString(),
    },
    {
      key: "hicc_notified" as const,
      label: "HICC",
      render: (r: OutbreakEvent) =>
        r.hicc_notified ? (
          <Badge tone="success" size="sm">
            Notified
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            No
          </Badge>
        ),
    },
    {
      key: "actions" as const,
      label: "Actions",
      render: (r: OutbreakEvent) => (
        <Group gap="xs">
          <Tooltip label="View details">
            <IconButton
              onClick={() => {
                setSelected(r);
                openDetail();
              }}
              aria-label="View details"
            >
              <IconEye size={16} />
            </IconButton>
          </Tooltip>
          {canUpdate &&
            (statusTransitions[r.outbreak_status] ?? []).map((next) => (
              <Button
                tone="secondary"
                key={next}
                size="compact-xs"
                onClick={() =>
                  updateMut.mutate({
                    id: r.id,
                    data: { outbreak_status: next as OutbreakStatusType },
                  })
                }
              >
                {next}
              </Button>
            ))}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Status"
            data={["suspected", "confirmed", "contained", "closed"]}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={160}
          />
          <Text c="dimmed" size="sm">
            {outbreaks.length} outbreak(s)
          </Text>
        </Group>
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Report Outbreak
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={outbreaks}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No outbreaks"
      />

      <Drawer opened={opened} onClose={close} title="Report Outbreak" position="right" size="xl">
        <Stack>
          <TextInput
            label="Organism"
            required
            value={form.organism}
            onChange={(e) => setForm({ ...form, organism: e.currentTarget.value })}
          />
          <TextInput
            label="Detected Date"
            type="datetime-local"
            required
            value={form.detected_date}
            onChange={(e) => setForm({ ...form, detected_date: e.currentTarget.value })}
          />
          <NumberInput
            label="Initial Cases"
            value={form.initial_cases ?? 1}
            onChange={(v) => setForm({ ...form, initial_cases: Number(v) })}
          />
          <Textarea
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value || undefined })}
          />
          <Button
            tone="primary"
            loading={createMut.isPending}
            onClick={() => createMut.mutate(form)}
          >
            Report
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title={`Outbreak: ${selected?.outbreak_number ?? ""}`}
        position="right"
        size="lg"
      >
        {selected && (
          <Stack>
            <Text fw={600}>{selected.organism}</Text>
            <Group>
              <Badge tone={statusColorTone(selected.outbreak_status)}>
                {selected.outbreak_status}
              </Badge>
              <Text size="sm">Cases: {selected.total_cases}</Text>
            </Group>
            {selected.description && <Text size="sm">{selected.description}</Text>}
            {selected.root_cause && <Text size="sm">Root Cause: {selected.root_cause}</Text>}

            {timelineChartData.length > 0 && (
              <Paper p="md" withBorder mt="md">
                <Title order={6} mb="md">
                  Outbreak Progression
                </Title>
                <Timeline active={timelineChartData.length - 1} bulletSize={24} lineWidth={2}>
                  <Timeline.Item title="Detection">
                    <Text size="sm" c="dimmed">
                      Detected: {new Date(selected.detected_date).toLocaleDateString()}
                    </Text>
                    <Text size="sm">Initial cases: {selected.initial_cases}</Text>
                  </Timeline.Item>
                  {selected.total_cases > selected.initial_cases && (
                    <Timeline.Item title="Escalation">
                      <Text size="sm">Total cases: {selected.total_cases}</Text>
                    </Timeline.Item>
                  )}
                  {selected.containment_date && (
                    <Timeline.Item title="Containment">
                      <Text size="sm" c="dimmed">
                        {new Date(selected.containment_date).toLocaleDateString()}
                      </Text>
                    </Timeline.Item>
                  )}
                  {selected.closure_date && (
                    <Timeline.Item title="Closure">
                      <Text size="sm" c="dimmed">
                        {new Date(selected.closure_date).toLocaleDateString()}
                      </Text>
                    </Timeline.Item>
                  )}
                </Timeline>
              </Paper>
            )}

            <Text fw={600} mt="md">
              Contacts ({contacts.length})
            </Text>
            {contacts.map((c: OutbreakContact) => (
              <Group
                key={c.id}
                p="xs"
                style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 0 }}
              >
                <Text size="sm">{c.contact_type}</Text>
                {c.quarantine_required && (
                  <Badge tone="danger" size="sm">
                    Quarantine
                  </Badge>
                )}
                {c.screening_result && <Text size="sm">Screen: {c.screening_result}</Text>}
              </Group>
            ))}
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}

// ── Sharps Safety Tab ───────────────────────────────────

function SharpsSafetyTab() {
  const canCreate = useHasPermission(P.INFECTION_CONTROL.SURVEILLANCE_CREATE);
  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["ic-needlestick"],
    queryFn: () => infectionControlService.listNeedleStickIncidents(),
  });

  const columns = [
    {
      key: "incident_number" as const,
      label: "Incident #",
      render: (r: NeedleStickIncident) => <Text fw={500}>{r.incident_number}</Text>,
    },
    {
      key: "incident_date" as const,
      label: "Date",
      render: (r: NeedleStickIncident) => new Date(r.incident_date).toLocaleDateString(),
    },
    {
      key: "device_type" as const,
      label: "Device Type",
      render: (r: NeedleStickIncident) => r.device_type,
    },
    {
      key: "body_part" as const,
      label: "Body Location",
      render: (r: NeedleStickIncident) => r.body_part ?? "---",
    },
    { key: "depth" as const, label: "Depth", render: (r: NeedleStickIncident) => r.depth ?? "---" },
    {
      key: "procedure_during" as const,
      label: "Procedure",
      render: (r: NeedleStickIncident) => r.procedure_during ?? "---",
    },
    {
      key: "pep_initiated" as const,
      label: "PEP Status",
      render: (r: NeedleStickIncident) => (
        <Badge tone={r.pep_initiated ? "success" : "danger"}>
          {r.pep_initiated ? "Initiated" : "Not Initiated"}
        </Badge>
      ),
    },
    {
      key: "source_status" as const,
      label: "Source Status",
      render: (r: NeedleStickIncident) => {
        const statuses = [];
        if (r.hiv_status) statuses.push(`HIV:${r.hiv_status}`);
        if (r.hbv_status) statuses.push(`HBV:${r.hbv_status}`);
        if (r.hcv_status) statuses.push(`HCV:${r.hcv_status}`);
        return statuses.length > 0 ? statuses.join(", ") : "---";
      },
    },
    {
      key: "outcome" as const,
      label: "Outcome",
      render: (r: NeedleStickIncident) => r.outcome ?? "---",
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text c="dimmed" size="sm">
          {incidents.length} incident(s)
        </Text>
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} disabled>
            Report Incident
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={incidents}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No needle-stick incidents"
      />
    </Stack>
  );
}

// ── IC Analytics Tab ─────────────────────────────────────

function AnalyticsTab() {
  const [subView, setSubView] = useState<string>("hai-rates");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const dateParams = {
    from: from ? from.slice(0, 10) : undefined,
    to: to ? to.slice(0, 10) : undefined,
  };

  const { data: haiRates = [], isLoading: haiLoading } = useQuery({
    queryKey: ["ic-hai-rates", dateParams],
    queryFn: () => infectionControlService.icHaiRates(dateParams),
    enabled: subView === "hai-rates",
  });

  const { data: deviceUtil = [], isLoading: deviceLoading } = useQuery({
    queryKey: ["ic-device-util", dateParams],
    queryFn: () => infectionControlService.icDeviceUtilization(dateParams),
    enabled: subView === "device-util",
  });

  const { data: amConsumption = [], isLoading: amLoading } = useQuery({
    queryKey: ["ic-am-consumption", dateParams],
    queryFn: () => infectionControlService.icAntimicrobialConsumption(dateParams),
    enabled: subView === "am-consumption",
  });

  const { data: prophylaxis = [], isLoading: prophLoading } = useQuery({
    queryKey: ["ic-prophylaxis", dateParams],
    queryFn: () => infectionControlService.icSurgicalProphylaxis(dateParams),
    enabled: subView === "prophylaxis",
  });

  const { data: cultureSens = [], isLoading: csLoading } = useQuery({
    queryKey: ["ic-culture-sens", dateParams],
    queryFn: () => infectionControlService.icCultureSensitivityReport(dateParams),
    enabled: subView === "culture-sens",
  });

  const { data: mdro = [], isLoading: mdroLoading } = useQuery({
    queryKey: ["ic-mdro", dateParams],
    queryFn: () => infectionControlService.icMdroTracking(dateParams),
    enabled: subView === "mdro",
  });

  // Build culture sensitivity matrix: rows = organisms, columns = antibiotics
  const csMatrix = useMemo(() => {
    const orgMap: Record<string, Record<string, CultureSensitivityRow>> = {};
    const antibiotics = new Set<string>();
    cultureSens.forEach((r) => {
      if (!orgMap[r.organism]) orgMap[r.organism] = {};
      const orgEntry = orgMap[r.organism];
      if (orgEntry) {
        orgEntry[r.antibiotic] = r;
      }
      antibiotics.add(r.antibiotic);
    });
    return { orgMap, antibiotics: Array.from(antibiotics).sort() };
  }, [cultureSens]);

  // Build MDRO line chart data: x = month, series per organism
  const mdroChartData = useMemo(() => {
    const months = [...new Set(mdro.map((r) => r.month))].sort();
    const organisms = [...new Set(mdro.map((r) => r.organism))];
    return months.map((m) => {
      const point: Record<string, string | number> = { month: m };
      organisms.forEach((org) => {
        const row = mdro.find((r) => r.month === m && r.organism === org);
        point[org] = row ? row.rate_per_1000 : 0;
      });
      return point;
    });
  }, [mdro]);

  const mdroSeries = useMemo(() => {
    const organisms = [...new Set(mdro.map((r) => r.organism))];
    const colors = ["red", "orange", "violet", "blue", "teal", "grape", "cyan", "pink"];
    return organisms.map((org, i) => ({
      name: org,
      color: colors[i % colors.length],
    }));
  }, [mdro]);

  const deviceUtilColumns = [
    { key: "unit_name" as const, label: "Unit", render: (r: DeviceUtilizationRow) => r.unit_name },
    {
      key: "device_type" as const,
      label: "Device",
      render: (r: DeviceUtilizationRow) => r.device_type,
    },
    {
      key: "device_days" as const,
      label: "Device Days",
      render: (r: DeviceUtilizationRow) => String(r.device_days),
    },
    {
      key: "patient_days" as const,
      label: "Patient Days",
      render: (r: DeviceUtilizationRow) => String(r.patient_days),
    },
    {
      key: "utilization_ratio" as const,
      label: "Utilization Ratio",
      render: (r: DeviceUtilizationRow) => r.utilization_ratio.toFixed(3),
    },
  ];

  const amColumns = [
    {
      key: "drug_name" as const,
      label: "Drug",
      render: (r: AntimicrobialConsumptionRow) => <Text fw={500}>{r.drug_name}</Text>,
    },
    {
      key: "atc_code" as const,
      label: "ATC Code",
      render: (r: AntimicrobialConsumptionRow) => r.atc_code ?? "---",
    },
    {
      key: "total_ddd" as const,
      label: "Total DDD",
      render: (r: AntimicrobialConsumptionRow) => r.total_ddd.toFixed(2),
    },
    {
      key: "patient_days" as const,
      label: "Patient Days",
      render: (r: AntimicrobialConsumptionRow) => String(r.patient_days),
    },
    {
      key: "ddd_per_1000" as const,
      label: "DDD/1000",
      render: (r: AntimicrobialConsumptionRow) => r.ddd_per_1000.toFixed(2),
    },
  ];

  const prophColumns = [
    {
      key: "procedure_type" as const,
      label: "Procedure",
      render: (r: SurgicalProphylaxisRow) => r.procedure_type,
    },
    {
      key: "total_cases" as const,
      label: "Total Cases",
      render: (r: SurgicalProphylaxisRow) => String(r.total_cases),
    },
    {
      key: "timely_count" as const,
      label: "Timely",
      render: (r: SurgicalProphylaxisRow) => String(r.timely_count),
    },
    {
      key: "compliance_pct" as const,
      label: "Compliance %",
      render: (r: SurgicalProphylaxisRow) => (
        <Badge
          tone={r.compliance_pct >= 90 ? "success" : r.compliance_pct >= 70 ? "warning" : "danger"}
        >
          {r.compliance_pct.toFixed(1)}%
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <SegmentedControl
          value={subView}
          onChange={setSubView}
          data={[
            { value: "hai-rates", label: "HAI Rates" },
            { value: "device-util", label: "Device Utilization" },
            { value: "am-consumption", label: "Antimicrobial" },
            { value: "prophylaxis", label: "Prophylaxis" },
            { value: "culture-sens", label: "Culture Sensitivity" },
            { value: "mdro", label: "MDRO" },
          ]}
        />
        <Group>
          <DateInput
            value={from}
            onChange={(d) => setFrom(d)}
            placeholder="From"
            clearable
            w={140}
          />
          <DateInput value={to} onChange={(d) => setTo(d)} placeholder="To" clearable w={140} />
        </Group>
      </Group>

      {subView === "hai-rates" && (
        <Paper p="md" withBorder>
          <Title order={5} mb="md">
            HAI Rates per 1000 Patient Days
          </Title>
          {haiLoading ? (
            <Text c="dimmed">Loading...</Text>
          ) : haiRates.length === 0 ? (
            <Text c="dimmed">No data</Text>
          ) : (
            <BarChart
              h={350}
              data={haiRates.map((r) => ({
                infection_type: r.infection_type,
                rate: r.rate_per_1000,
              }))}
              dataKey="infection_type"
              series={[{ name: "rate", label: "Rate / 1000", color: "danger" }]}
              tickLine="y"
            />
          )}
        </Paper>
      )}

      {subView === "device-util" && (
        <DataTable
          columns={deviceUtilColumns}
          data={deviceUtil}
          loading={deviceLoading}
          rowKey={(r) => `${r.unit_name}-${r.device_type}`}
          emptyTitle="No device utilization data"
        />
      )}

      {subView === "am-consumption" && (
        <DataTable
          columns={amColumns}
          data={amConsumption}
          loading={amLoading}
          rowKey={(r) => r.drug_name}
          emptyTitle="No antimicrobial consumption data"
        />
      )}

      {subView === "prophylaxis" && (
        <DataTable
          columns={prophColumns}
          data={prophylaxis}
          loading={prophLoading}
          rowKey={(r) => r.procedure_type}
          emptyTitle="No surgical prophylaxis data"
        />
      )}

      {subView === "culture-sens" && (
        <Paper p="md" withBorder>
          <Title order={5} mb="md">
            Culture Sensitivity Matrix
          </Title>
          {csLoading ? (
            <Text c="dimmed">Loading...</Text>
          ) : csMatrix.antibiotics.length === 0 ? (
            <Text c="dimmed">No culture sensitivity data</Text>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <Table striped withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Organism</Table.Th>
                    {csMatrix.antibiotics.map((ab) => (
                      <Table.Th key={ab}>{ab}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {Object.entries(csMatrix.orgMap).map(([org, abMap]) => (
                    <Table.Tr key={org}>
                      <Table.Td fw={500}>{org}</Table.Td>
                      {csMatrix.antibiotics.map((ab) => {
                        const row = abMap[ab];
                        if (!row) return <Table.Td key={ab}>---</Table.Td>;
                        const pct = row.sensitivity_pct;
                        const color = pct >= 70 ? "success" : pct >= 40 ? "warning" : "danger";
                        return (
                          <Table.Td key={ab}>
                            <Tooltip
                              label={`S:${row.sensitive_count} I:${row.intermediate_count} R:${row.resistant_count} (n=${row.total_tests})`}
                            >
                              <Badge tone={color} size="sm">
                                {pct.toFixed(0)}%
                              </Badge>
                            </Tooltip>
                          </Table.Td>
                        );
                      })}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          )}
        </Paper>
      )}

      {subView === "mdro" && (
        <Paper p="md" withBorder>
          <Title order={5} mb="md">
            MDRO Tracking (Rate per 1000 Patient Days)
          </Title>
          {mdroLoading ? (
            <Text c="dimmed">Loading...</Text>
          ) : mdroChartData.length === 0 ? (
            <Text c="dimmed">No MDRO data</Text>
          ) : (
            <LineChart
              h={350}
              data={mdroChartData}
              dataKey="month"
              series={mdroSeries}
              curveType="monotone"
              withLegend
              withTooltip
            />
          )}
        </Paper>
      )}
    </Stack>
  );
}

// ── IC Meetings Tab ──────────────────────────────────────

function MeetingsTab() {
  const canCreate = useHasPermission(P.INFECTION_CONTROL.SURVEILLANCE_CREATE);
  const qc = useQueryClient();
  const [subView, setSubView] = useState<string>("meetings");
  const [meetingOpened, { open: openMeeting, close: closeMeeting }] = useDisclosure(false);
  const [exposureOpened, { open: openExposure, close: closeExposure }] = useDisclosure(false);

  // Monthly report state
  const now = new Date();
  const [reportMonth, setReportMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [reportYear, setReportYear] = useState(String(now.getFullYear()));
  const monthParam = `${reportYear}-${reportMonth}`;

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery({
    queryKey: ["ic-meetings"],
    queryFn: () => infectionControlService.listIcMeetings(),
    enabled: subView === "meetings",
  });

  const { data: monthlyReport, isLoading: reportLoading } = useQuery({
    queryKey: ["ic-monthly-report", monthParam],
    queryFn: () => infectionControlService.icMonthlySurveillance({ month: monthParam }),
    enabled: subView === "monthly",
  });

  const [meetingForm, setMeetingForm] = useState<CreateIcMeetingRequest>({
    meeting_date: "",
    meeting_type: "regular",
  });

  const createMeetingMut = useMutation({
    mutationFn: (data: CreateIcMeetingRequest) => infectionControlService.createIcMeeting(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ic-meetings"] });
      notifications.show({ title: "Meeting created", message: "", color: "success" });
      closeMeeting();
      setMeetingForm({ meeting_date: "", meeting_type: "regular" });
    },
  });

  const [exposureForm, setExposureForm] = useState<CreateExposureRequest>({
    event_type: "",
    exposure_date: "",
    exposure_type: "",
    pep_initiated: false,
  });

  const createExposureMut = useMutation({
    mutationFn: (data: CreateExposureRequest) => infectionControlService.createIcExposure(data),
    onSuccess: () => {
      notifications.show({ title: "Exposure recorded", message: "", color: "success" });
      closeExposure();
      setExposureForm({
        event_type: "",
        exposure_date: "",
        exposure_type: "",
        pep_initiated: false,
      });
    },
  });

  const meetingColumns = [
    {
      key: "meeting_date" as const,
      label: "Date",
      render: (r: IcMeeting) => new Date(r.meeting_date).toLocaleDateString(),
    },
    {
      key: "meeting_type" as const,
      label: "Type",
      render: (r: IcMeeting) => <Badge tone="neutral">{r.meeting_type}</Badge>,
    },
    { key: "agenda" as const, label: "Agenda", render: (r: IcMeeting) => r.agenda ?? "---" },
    {
      key: "attendees" as const,
      label: "Attendees",
      render: (r: IcMeeting) => (
        <Badge tone="neutral" size="sm">
          {Array.isArray(r.attendees) ? r.attendees.length : 0}
        </Badge>
      ),
    },
    {
      key: "minutes" as const,
      label: "Minutes",
      render: (r: IcMeeting) =>
        r.minutes ? (
          <Text size="sm" lineClamp={1}>
            {r.minutes}
          </Text>
        ) : (
          "---"
        ),
    },
    {
      key: "action_items" as const,
      label: "Actions",
      render: (r: IcMeeting) => (
        <Badge size="sm" tone="warning">
          {Array.isArray(r.action_items) ? r.action_items.length : 0}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <SegmentedControl
          value={subView}
          onChange={setSubView}
          data={[
            { value: "meetings", label: "IC Meetings" },
            { value: "exposures", label: "Exposures" },
            { value: "monthly", label: "Monthly Report" },
          ]}
        />
        <Group>
          {canCreate && subView === "meetings" && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openMeeting}>
              New Meeting
            </Button>
          )}
          {canCreate && subView === "exposures" && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openExposure}>
              Record Exposure
            </Button>
          )}
        </Group>
      </Group>

      {subView === "meetings" && (
        <DataTable
          columns={meetingColumns}
          data={meetings}
          loading={meetingsLoading}
          rowKey={(r) => r.id}
          emptyTitle="No IC meetings"
        />
      )}

      {subView === "exposures" && (
        <Paper p="md" withBorder>
          <Text fw={600} mb="md">
            Exposure Recording
          </Text>
          <Text c="dimmed" size="sm">
            Use the "Record Exposure" button to log an occupational exposure event (needlestick,
            blood/body fluid contact, etc.).
          </Text>
        </Paper>
      )}

      {subView === "monthly" && (
        <Stack>
          <Group>
            <Select
              label="Month"
              value={reportMonth}
              onChange={(v) => setReportMonth(v ?? reportMonth)}
              data={Array.from({ length: 12 }, (_, i) => ({
                value: String(i + 1).padStart(2, "0"),
                label: new Date(2024, i, 1).toLocaleDateString("en-US", { month: "long" }),
              }))}
              w={160}
            />
            <Select
              label="Year"
              value={reportYear}
              onChange={(v) => setReportYear(v ?? reportYear)}
              data={Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 2 + i))}
              w={120}
            />
          </Group>
          {reportLoading ? (
            <Text c="dimmed">Loading monthly report...</Text>
          ) : monthlyReport ? (
            <Grid>
              <Grid.Col span={{ base: 6, md: 3 }}>
                <Card withBorder p="md">
                  <Text size="sm" c="dimmed">
                    HAI Count
                  </Text>
                  <Text size="xl" fw={600} c="danger">
                    {monthlyReport.hai_count}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Rate: {monthlyReport.hai_rate.toFixed(2)}/1000
                  </Text>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, md: 3 }}>
                <Card withBorder p="md">
                  <Text size="sm" c="dimmed">
                    Hand Hygiene
                  </Text>
                  <Text size="xl" fw={600} c="teal">
                    {monthlyReport.hand_hygiene_compliance.toFixed(1)}%
                  </Text>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, md: 3 }}>
                <Card withBorder p="md">
                  <Text size="sm" c="dimmed">
                    BMW Total (kg)
                  </Text>
                  <Text size="xl" fw={600}>
                    {monthlyReport.bmw_total_kg.toFixed(1)}
                  </Text>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, md: 3 }}>
                <Card withBorder p="md">
                  <Text size="sm" c="dimmed">
                    Cultures / MDRO / Outbreaks
                  </Text>
                  <Text size="xl" fw={600}>
                    {monthlyReport.culture_count} / {monthlyReport.mdro_count} /{" "}
                    {monthlyReport.outbreak_count}
                  </Text>
                </Card>
              </Grid.Col>
            </Grid>
          ) : (
            <Text c="dimmed">No data for the selected month</Text>
          )}
        </Stack>
      )}

      {/* Create Meeting Drawer */}
      <Drawer
        opened={meetingOpened}
        onClose={closeMeeting}
        title="New IC Meeting"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Meeting Date"
            type="datetime-local"
            required
            value={meetingForm.meeting_date}
            onChange={(e) =>
              setMeetingForm({ ...meetingForm, meeting_date: e.currentTarget.value })
            }
          />
          <Select
            label="Meeting Type"
            data={["regular", "emergency", "ad_hoc", "orientation"]}
            value={meetingForm.meeting_type ?? "regular"}
            onChange={(v) => setMeetingForm({ ...meetingForm, meeting_type: v ?? "regular" })}
          />
          <Textarea
            label="Agenda"
            value={meetingForm.agenda ?? ""}
            onChange={(e) =>
              setMeetingForm({ ...meetingForm, agenda: e.currentTarget.value || undefined })
            }
          />
          <Textarea
            label="Minutes"
            value={meetingForm.minutes ?? ""}
            onChange={(e) =>
              setMeetingForm({ ...meetingForm, minutes: e.currentTarget.value || undefined })
            }
          />
          <Button
            tone="primary"
            loading={createMeetingMut.isPending}
            onClick={() => createMeetingMut.mutate(meetingForm)}
          >
            Create
          </Button>
        </Stack>
      </Drawer>

      {/* Exposure Drawer */}
      <Drawer
        opened={exposureOpened}
        onClose={closeExposure}
        title="Record Exposure"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Event Type"
            required
            data={["needlestick", "splash", "cut", "bite", "other"]}
            value={exposureForm.event_type || null}
            onChange={(v) => setExposureForm({ ...exposureForm, event_type: v ?? "" })}
          />
          <TextInput
            label="Exposure Date"
            type="datetime-local"
            required
            value={exposureForm.exposure_date}
            onChange={(e) =>
              setExposureForm({ ...exposureForm, exposure_date: e.currentTarget.value })
            }
          />
          <Select
            label="Exposure Type"
            required
            data={["percutaneous", "mucocutaneous", "intact_skin", "other"]}
            value={exposureForm.exposure_type || null}
            onChange={(v) => setExposureForm({ ...exposureForm, exposure_type: v ?? "" })}
          />
          <PatientSearchSelect
            label="Source Patient"
            value={exposureForm.source_patient_id ?? ""}
            onChange={(id) =>
              setExposureForm({ ...exposureForm, source_patient_id: id || undefined })
            }
          />
          <EmployeeSearchSelect
            label="Exposed Staff"
            value={exposureForm.exposed_staff_id ?? ""}
            onChange={(id) =>
              setExposureForm({ ...exposureForm, exposed_staff_id: id || undefined })
            }
          />
          <Switch
            label="PEP Initiated"
            checked={exposureForm.pep_initiated}
            onChange={(e) =>
              setExposureForm({ ...exposureForm, pep_initiated: e.currentTarget.checked })
            }
          />
          <Textarea
            label="Notes"
            value={exposureForm.notes ?? ""}
            onChange={(e) =>
              setExposureForm({ ...exposureForm, notes: e.currentTarget.value || undefined })
            }
          />
          <Button
            tone="primary"
            loading={createExposureMut.isPending}
            onClick={() => createExposureMut.mutate(exposureForm)}
          >
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Main Infection Control Page
// ══════════════════════════════════════════════════════════

export function InfectionControlPage() {
  useRequirePermission(INFECTION_CONTROL_PAGE_PERMISSIONS);
  const [searchParams, setSearchParams] = useSearchParams();
  const ipdContext = ipdContextFromSearchParams(searchParams);
  const canViewSurveillance = useHasPermission(P.INFECTION_CONTROL.SURVEILLANCE_LIST);
  const canViewStewardship = useHasPermission(P.INFECTION_CONTROL.STEWARDSHIP_LIST);
  const canViewBiowaste = useHasPermission(P.INFECTION_CONTROL.BIOWASTE_LIST);
  const canViewHygiene = useHasPermission(P.INFECTION_CONTROL.HYGIENE_LIST);
  const canViewOutbreaks = useHasPermission(P.INFECTION_CONTROL.OUTBREAK_LIST);
  const canViewAnalytics = canViewSurveillance && canViewStewardship && canViewHygiene;
  const visibleTabs = [
    ...(canViewSurveillance ? ["surveillance", "devices"] : []),
    ...(canViewStewardship ? ["stewardship"] : []),
    ...(canViewBiowaste ? ["biowaste", "sharps"] : []),
    ...(canViewHygiene ? ["hygiene"] : []),
    ...(canViewOutbreaks ? ["outbreaks"] : []),
    ...(canViewAnalytics ? ["analytics"] : []),
    ...(canViewSurveillance ? ["meetings"] : []),
  ];
  const requestedTab = searchParams.get("tab");
  const selectedTab =
    requestedTab && visibleTabs.includes(requestedTab) ? requestedTab : (visibleTabs[0] ?? null);
  const handleTabChange = (value: string | null) => {
    if (!value) return;
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    setSearchParams(params, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="Infection Control"
        subtitle="HAI surveillance, antibiotic stewardship, bio-waste, hand hygiene, outbreak management, and sharps safety"
        icon={<IconShieldCheck size={20} stroke={1.5} />}
        color="danger"
      />
      <IpdContextStrip context={ipdContext} />

      <Tabs value={selectedTab} onChange={handleTabChange} keepMounted={false} mt="md">
        <Tabs.List>
          {canViewSurveillance && (
            <Tabs.Tab value="surveillance" leftSection={<IconBug size={16} />}>
              HAI Surveillance
            </Tabs.Tab>
          )}
          {canViewStewardship && (
            <Tabs.Tab value="stewardship" leftSection={<IconPill size={16} />}>
              Stewardship & Antibiogram
            </Tabs.Tab>
          )}
          {canViewBiowaste && (
            <Tabs.Tab value="biowaste" leftSection={<IconBiohazard size={16} />}>
              Bio-Waste
            </Tabs.Tab>
          )}
          {canViewHygiene && (
            <Tabs.Tab value="hygiene" leftSection={<IconHandStop size={16} />}>
              Hygiene & Bundles
            </Tabs.Tab>
          )}
          {canViewSurveillance && (
            <Tabs.Tab value="devices" leftSection={<IconTemperature size={16} />}>
              Invasive Devices
            </Tabs.Tab>
          )}
          {canViewOutbreaks && (
            <Tabs.Tab value="outbreaks" leftSection={<IconVirusSearch size={16} />}>
              Outbreaks
            </Tabs.Tab>
          )}
          {canViewBiowaste && (
            <Tabs.Tab value="sharps" leftSection={<IconNeedleThread size={16} />}>
              Sharps Safety
            </Tabs.Tab>
          )}
          {canViewAnalytics && (
            <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
              Analytics
            </Tabs.Tab>
          )}
          {canViewSurveillance && (
            <Tabs.Tab value="meetings" leftSection={<IconUsers size={16} />}>
              Meetings
            </Tabs.Tab>
          )}
        </Tabs.List>

        {canViewSurveillance && (
          <Tabs.Panel value="surveillance" pt="md">
            <SurveillanceTab />
          </Tabs.Panel>
        )}
        {canViewStewardship && (
          <Tabs.Panel value="stewardship" pt="md">
            <StewardshipTab />
          </Tabs.Panel>
        )}
        {canViewBiowaste && (
          <Tabs.Panel value="biowaste" pt="md">
            <BiowasteTab />
          </Tabs.Panel>
        )}
        {canViewSurveillance && (
          <Tabs.Panel value="devices" pt="md">
            <InvasiveDevicesPanel />
          </Tabs.Panel>
        )}
        {canViewHygiene && (
          <Tabs.Panel value="hygiene" pt="md">
            <HygieneTab />
          </Tabs.Panel>
        )}
        {canViewOutbreaks && (
          <Tabs.Panel value="outbreaks" pt="md">
            <OutbreakTab />
          </Tabs.Panel>
        )}
        {canViewBiowaste && (
          <Tabs.Panel value="sharps" pt="md">
            <SharpsSafetyTab />
          </Tabs.Panel>
        )}
        {canViewAnalytics && (
          <Tabs.Panel value="analytics" pt="md">
            <AnalyticsTab />
          </Tabs.Panel>
        )}
        {canViewSurveillance && (
          <Tabs.Panel value="meetings" pt="md">
            <MeetingsTab />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}
