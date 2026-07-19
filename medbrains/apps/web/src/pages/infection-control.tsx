import "@mantine/charts/styles.css";
import { BarChart, LineChart } from "@mantine/charts";
import {
  Card,
  Drawer,
  Grid,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
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
  CreateIcMeetingRequest,
  CultureSensitivityRow,
  DeviceUtilizationRow,
  IcMeeting,
  NeedleStickIncident,
  SurgicalProphylaxisRow,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconBiohazard,
  IconBug,
  IconChartBar,
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
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, Table } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { InvasiveDevicesPanel } from "@/pages/infection-control/InvasiveDevicesPanel";
import { infectionControlService } from "@/services/infectionControl.service";
import { BiowasteTab } from "./infection-control/biowaste-tab";
import { HygieneTab } from "./infection-control/hygiene-tab";
import { OutbreakTab } from "./infection-control/outbreak-tab";
import { StewardshipTab } from "./infection-control/stewardship-tab";
import { SurveillanceTab } from "./infection-control/surveillance-tab";

// ── Color Maps ──────────────────────────────────────────

// Dropdown options for categorical fields

const INFECTION_CONTROL_PAGE_PERMISSIONS = [
  P.INFECTION_CONTROL.SURVEILLANCE_LIST,
  P.INFECTION_CONTROL.STEWARDSHIP_LIST,
  P.INFECTION_CONTROL.BIOWASTE_LIST,
  P.INFECTION_CONTROL.HYGIENE_LIST,
  P.INFECTION_CONTROL.OUTBREAK_LIST,
] as const;

// ── HAI Surveillance Tab ────────────────────────────────

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
