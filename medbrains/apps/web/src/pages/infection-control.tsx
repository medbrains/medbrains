import { useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
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
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Timeline,
  Title,
  Tooltip,
} from "@mantine/core";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
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
  IconUsers,
  IconVirusSearch,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart, LineChart } from "@mantine/charts";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  InfectionSurveillanceEvent,
  AntibioticStewardshipRequest,
  BiowasteRecord,
  HandHygieneAudit,
  CultureSurveillance,
  OutbreakEvent,
  OutbreakContact,
  NeedleStickIncident,
  CreateBiowasteRecordRequest,
  CreateHygieneAuditRequest,
  CreateOutbreakRequest,
  UpdateOutbreakRequest,
  HaiType,
  WasteCategoryType,
  OutbreakStatusType,
  AntibioticRequestStatusType,
  DeviceUtilizationRow,
  AntimicrobialConsumptionRow,
  SurgicalProphylaxisRow,
  CultureSensitivityRow,
  IcMeeting,
  CreateIcMeetingRequest,
  CreateExposureRequest,
} from "@medbrains/types";
import { DateInput } from "@mantine/dates";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";

// ── Color Maps ──────────────────────────────────────────

const haiColors: Record<string, string> = {
  clabsi: "danger",
  cauti: "orange",
  vap: "violet",
  ssi: "warning",
  cdiff: "danger",
  mrsa: "violet",
  other: "slate",
};

const infectionStatusColors: Record<string, string> = {
  suspected: "warning",
  confirmed: "danger",
  ruled_out: "success",
};

const requestStatusColors: Record<string, string> = {
  pending: "warning",
  approved: "success",
  denied: "danger",
  expired: "slate",
};

const wasteColors: Record<string, string> = {
  yellow: "warning",
  red: "danger",
  white_translucent: "slate",
  blue: "primary",
  cytotoxic: "violet",
  chemical: "orange",
  radioactive: "violet",
};

const outbreakStatusColors: Record<string, string> = {
  suspected: "warning",
  confirmed: "danger",
  contained: "teal",
  closed: "success",
};

// Dropdown options for categorical fields
const DEVICE_TYPES = [
  { value: "central_line", label: "Central Line" },
  { value: "urinary_catheter", label: "Urinary Catheter" },
  { value: "ventilator", label: "Ventilator" },
  { value: "peripheral_iv", label: "Peripheral IV" },
  { value: "feeding_tube", label: "Feeding Tube" },
  { value: "tracheostomy", label: "Tracheostomy" },
  { value: "drain", label: "Drain" },
  { value: "other", label: "Other" },
];

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

// ── HAI Surveillance Tab ────────────────────────────────

function SurveillanceTab() {
  const canCreate = useHasPermission(P.INFECTION_CONTROL.SURVEILLANCE_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [haiFilter, setHaiFilter] = useState<string | null>(null);
  const [subView, setSubView] = useState<string>("all");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["ic-surveillance", haiFilter],
    queryFn: () => api.listSurveillanceEvents({ hai_type: haiFilter ?? undefined }),
  });

  // Feature 1: SSI-specific tracking
  const ssiEvents = useMemo(() => events.filter((e) => e.hai_type === "ssi"), [events]);

  const [form, setForm] = useState({
    patient_id: "",
    hai_type: "clabsi" as HaiType,
    infection_date: "",
    organism: "",
    device_type: "",
    department_id: "",
    notes: "",
  });

  const createMut = useMutation({
    mutationFn: () =>
      api.createSurveillanceEvent({
        patient_id: form.patient_id,
        hai_type: form.hai_type,
        infection_date: form.infection_date,
        organism: form.organism || undefined,
        device_type: form.device_type || undefined,
        department_id: form.department_id || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ic-surveillance"] });
      notifications.show({ title: "Event recorded", message: "", color: "success" });
      close();
    },
  });

  const columns = [
    { key: "hai_type" as const, label: "HAI Type", render: (r: InfectionSurveillanceEvent) => <Badge color={haiColors[r.hai_type] ?? "slate"}>{r.hai_type.toUpperCase()}</Badge> },
    { key: "infection_status" as const, label: "Status", render: (r: InfectionSurveillanceEvent) => <Badge color={infectionStatusColors[r.infection_status] ?? "slate"}>{r.infection_status.replace(/_/g, " ")}</Badge> },
    { key: "organism" as const, label: "Organism", render: (r: InfectionSurveillanceEvent) => r.organism ?? "---" },
    { key: "device_type" as const, label: "Device", render: (r: InfectionSurveillanceEvent) => r.device_type ?? "---" },
    { key: "infection_date" as const, label: "Date", render: (r: InfectionSurveillanceEvent) => new Date(r.infection_date).toLocaleDateString() },
    { key: "notes" as const, label: "Notes", render: (r: InfectionSurveillanceEvent) => r.notes ?? "---" },
  ];

  const ssiColumns = [
    { key: "infection_status" as const, label: "Status", render: (r: InfectionSurveillanceEvent) => <Badge color={infectionStatusColors[r.infection_status] ?? "slate"}>{r.infection_status.replace(/_/g, " ")}</Badge> },
    { key: "organism" as const, label: "Organism", render: (r: InfectionSurveillanceEvent) => r.organism ?? "---" },
    { key: "device_type" as const, label: "Procedure Type", render: (r: InfectionSurveillanceEvent) => r.device_type ?? "---" },
    { key: "infection_date" as const, label: "Infection Date", render: (r: InfectionSurveillanceEvent) => new Date(r.infection_date).toLocaleDateString() },
    {
      key: "days_post_op" as const,
      label: "Days Post-Op",
      render: (r: InfectionSurveillanceEvent) => {
        if (!r.insertion_date) return "---";
        const insertDate = new Date(r.insertion_date);
        const infectDate = new Date(r.infection_date);
        const days = Math.floor((infectDate.getTime() - insertDate.getTime()) / (1000 * 60 * 60 * 24));
        return String(days);
      }
    },
    { key: "notes" as const, label: "Notes", render: (r: InfectionSurveillanceEvent) => r.notes ?? "---" },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <SegmentedControl
            value={subView}
            onChange={setSubView}
            data={[
              { value: "all", label: "All HAI" },
              { value: "ssi", label: "SSI Tracking" },
            ]}
          />
          {subView === "all" && (
            <Select placeholder="HAI Type" data={["clabsi", "cauti", "vap", "ssi", "cdiff", "mrsa", "other"]} value={haiFilter} onChange={setHaiFilter} clearable w={160} />
          )}
          <Text c="dimmed" size="sm">{subView === "all" ? events.length : ssiEvents.length} event(s)</Text>
        </Group>
        {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={open}>Report HAI</Button>}
      </Group>

      {subView === "all" ? (
        <DataTable columns={columns} data={events} loading={isLoading} rowKey={(r) => r.id} emptyTitle="No HAI events" />
      ) : (
        <DataTable columns={ssiColumns} data={ssiEvents} loading={isLoading} rowKey={(r) => r.id} emptyTitle="No SSI events" />
      )}

      <Drawer opened={opened} onClose={close} title="Report HAI Event" position="right" size="md">
        <Stack>
          <PatientSearchSelect value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} required />
          <Select label="HAI Type" required data={["clabsi", "cauti", "vap", "ssi", "cdiff", "mrsa", "other"]} value={form.hai_type} onChange={(v) => setForm({ ...form, hai_type: (v ?? "other") as HaiType })} />
          <TextInput label="Infection Date" type="date" required value={form.infection_date} onChange={(e) => setForm({ ...form, infection_date: e.currentTarget.value })} />
          <TextInput label="Organism" value={form.organism} onChange={(e) => setForm({ ...form, organism: e.currentTarget.value })} />
          <Select label="Device Type" data={DEVICE_TYPES} value={form.device_type || null} onChange={(v) => setForm({ ...form, device_type: v ?? "" })} clearable searchable />
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })} />
          <Button loading={createMut.isPending} onClick={() => createMut.mutate()}>Save</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Stewardship Tab ─────────────────────────────────────

function StewardshipTab() {
  const canCreate = useHasPermission(P.INFECTION_CONTROL.STEWARDSHIP_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [subView, setSubView] = useState<string>("requests");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["ic-stewardship", statusFilter],
    queryFn: () => api.listStewardshipRequests({ request_status: statusFilter ?? undefined }),
  });

  // Feature 4: Antibiogram display
  const { data: cultures = [] } = useQuery({
    queryKey: ["ic-cultures"],
    queryFn: () => api.listCultureSurveillance(),
  });

  // Build antibiogram matrix
  const antibiogramData = useMemo(() => {
    const matrix: Record<string, Record<string, { total: number; resistant: number; intermediate: number; sensitive: number }>> = {};
    cultures.forEach((c) => {
      if (!c.organism || !c.result) return;
      const org = c.organism;
      if (!matrix[org]) matrix[org] = {};
      // Parse result as "drug:susceptibility" pattern
      const parts = c.result.split(":");
      if (parts.length === 2) {
        const drug = parts[0];
        const susceptibility = parts[1];
        if (drug && susceptibility) {
          if (!matrix[org][drug]) matrix[org][drug] = { total: 0, resistant: 0, intermediate: 0, sensitive: 0 };
          matrix[org][drug].total++;
          if (susceptibility.toLowerCase().includes("resist")) matrix[org][drug].resistant++;
          else if (susceptibility.toLowerCase().includes("inter")) matrix[org][drug].intermediate++;
          else if (susceptibility.toLowerCase().includes("sens")) matrix[org][drug].sensitive++;
        }
      }
    });
    return matrix;
  }, [cultures]);

  const [form, setForm] = useState({
    patient_id: "",
    antibiotic_name: "",
    dose: "",
    route: "",
    indication: "",
    culture_sent: false,
    duration_days: undefined as number | undefined,
  });

  const createMut = useMutation({
    mutationFn: () =>
      api.createStewardshipRequest({
        patient_id: form.patient_id,
        antibiotic_name: form.antibiotic_name,
        dose: form.dose || undefined,
        route: form.route || undefined,
        indication: form.indication,
        culture_sent: form.culture_sent,
        duration_days: form.duration_days,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ic-stewardship"] });
      notifications.show({ title: "Request created", message: "", color: "success" });
      close();
    },
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.reviewStewardshipRequest(id, { request_status: status as AntibioticRequestStatusType, review_notes: undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ic-stewardship"] });
      notifications.show({ title: "Request reviewed", message: "", color: "success" });
    },
  });

  const columns = [
    { key: "antibiotic_name" as const, label: "Antibiotic", render: (r: AntibioticStewardshipRequest) => <Text fw={500}>{r.antibiotic_name}</Text> },
    { key: "indication" as const, label: "Indication", render: (r: AntibioticStewardshipRequest) => r.indication },
    { key: "dose" as const, label: "Dose", render: (r: AntibioticStewardshipRequest) => r.dose ?? "---" },
    { key: "request_status" as const, label: "Status", render: (r: AntibioticStewardshipRequest) => <Badge color={requestStatusColors[r.request_status] ?? "slate"}>{r.request_status}</Badge> },
    { key: "culture_sent" as const, label: "Culture", render: (r: AntibioticStewardshipRequest) => r.culture_sent ? <Badge color="success" size="sm">Sent</Badge> : <Badge color="slate" size="sm">No</Badge> },
    { key: "requested_at" as const, label: "Requested", render: (r: AntibioticStewardshipRequest) => new Date(r.requested_at).toLocaleDateString() },
    {
      key: "actions" as const,
      label: "Actions",
      render: (r: AntibioticStewardshipRequest) =>
        r.request_status === "pending" && canCreate ? (
          <Group gap="xs">
            <Button size="compact-xs" variant="light" color="success" onClick={() => reviewMut.mutate({ id: r.id, status: "approved" })}>Approve</Button>
            <Button size="compact-xs" variant="light" color="danger" onClick={() => reviewMut.mutate({ id: r.id, status: "denied" })}>Deny</Button>
          </Group>
        ) : null,
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <SegmentedControl
            value={subView}
            onChange={setSubView}
            data={[
              { value: "requests", label: "Requests" },
              { value: "antibiogram", label: "Antibiogram" },
            ]}
          />
          {subView === "requests" && (
            <Select placeholder="Status" data={["pending", "approved", "denied", "expired"]} value={statusFilter} onChange={setStatusFilter} clearable w={160} />
          )}
          {subView === "requests" && <Text c="dimmed" size="sm">{requests.length} request(s)</Text>}
        </Group>
        {canCreate && subView === "requests" && <Button leftSection={<IconPlus size={16} />} onClick={open}>New Request</Button>}
      </Group>

      {subView === "requests" ? (
        <DataTable columns={columns} data={requests} loading={isLoading} rowKey={(r) => r.id} emptyTitle="No stewardship requests" />
      ) : (
        <Paper p="md" withBorder>
          <Title order={5} mb="md">Antibiogram Matrix</Title>
          {Object.keys(antibiogramData).length === 0 ? (
            <Text c="dimmed">No culture surveillance data available</Text>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <Table striped withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Organism</Table.Th>
                    {Array.from(new Set(Object.values(antibiogramData).flatMap((org) => Object.keys(org)))).map((drug) => (
                      <Table.Th key={drug}>{drug}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {Object.entries(antibiogramData).map(([organism, drugs]) => (
                    <Table.Tr key={organism}>
                      <Table.Td fw={500}>{organism}</Table.Td>
                      {Array.from(new Set(Object.values(antibiogramData).flatMap((org) => Object.keys(org)))).map((drug) => {
                        const data = drugs[drug];
                        if (!data || data.total === 0) return <Table.Td key={drug}>---</Table.Td>;
                        const sensPercent = Math.round((data.sensitive / data.total) * 100);
                        const interPercent = Math.round((data.intermediate / data.total) * 100);
                        const resPercent = Math.round((data.resistant / data.total) * 100);
                        let color = "slate";
                        if (sensPercent >= 70) color = "success";
                        else if (sensPercent >= 40) color = "warning";
                        else color = "danger";
                        return (
                          <Table.Td key={drug}>
                            <Badge color={color} size="sm" style={{ cursor: "help" }} title={`S:${sensPercent}% I:${interPercent}% R:${resPercent}% (n=${data.total})`}>
                              {sensPercent}%
                            </Badge>
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

      <Drawer opened={opened} onClose={close} title="Antibiotic Stewardship Request" position="right" size="md">
        <Stack>
          <PatientSearchSelect value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} required />
          <TextInput label="Antibiotic Name" required value={form.antibiotic_name} onChange={(e) => setForm({ ...form, antibiotic_name: e.currentTarget.value })} />
          <TextInput label="Dose" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.currentTarget.value })} />
          <TextInput label="Route" value={form.route} onChange={(e) => setForm({ ...form, route: e.currentTarget.value })} />
          <TextInput label="Indication" required value={form.indication} onChange={(e) => setForm({ ...form, indication: e.currentTarget.value })} />
          <NumberInput label="Duration (days)" value={form.duration_days ?? ""} onChange={(v) => setForm({ ...form, duration_days: v === "" ? undefined : Number(v) })} />
          <Switch label="Culture Sent" checked={form.culture_sent} onChange={(e) => setForm({ ...form, culture_sent: e.currentTarget.checked })} />
          <Button loading={createMut.isPending} onClick={() => createMut.mutate()}>Submit</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Bio-waste Tab ───────────────────────────────────────

function BiowasteTab() {
  const canCreate = useHasPermission(P.INFECTION_CONTROL.BIOWASTE_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [subView, setSubView] = useState<string>("records");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["ic-biowaste", catFilter],
    queryFn: () => api.listBiowasteRecords({ waste_category: catFilter ?? undefined }),
  });

  // Feature 7: BMW monthly report
  const monthlyReport = useMemo(() => {
    const filtered = records.filter((r) => r.record_date.startsWith(selectedMonth));
    const byCategory: Record<string, { weight: number; containers: number; count: number }> = {};
    filtered.forEach((r) => {
      const cat = r.waste_category;
      if (!byCategory[cat]) byCategory[cat] = { weight: 0, containers: 0, count: 0 };
      byCategory[cat].weight += Number(r.weight_kg);
      byCategory[cat].containers += r.container_count;
      byCategory[cat].count++;
    });
    return byCategory;
  }, [records, selectedMonth]);

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    records.forEach((r) => {
      const ym = r.record_date.substring(0, 7);
      months.add(ym);
    });
    return Array.from(months).sort().reverse().map((m) => ({ value: m, label: new Date(m + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" }) }));
  }, [records]);

  const [form, setForm] = useState<CreateBiowasteRecordRequest>({
    department_id: "",
    waste_category: "yellow" as WasteCategoryType,
    weight_kg: 0,
    record_date: "",
    container_count: 1,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateBiowasteRecordRequest) => api.createBiowasteRecord(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ic-biowaste"] });
      notifications.show({ title: "Record added", message: "", color: "success" });
      close();
    },
  });

  const columns = [
    { key: "waste_category" as const, label: "Category", render: (r: BiowasteRecord) => <Badge color={wasteColors[r.waste_category] ?? "slate"}>{r.waste_category.replace(/_/g, " ")}</Badge> },
    { key: "weight_kg" as const, label: "Weight (kg)", render: (r: BiowasteRecord) => String(r.weight_kg) },
    { key: "container_count" as const, label: "Containers", render: (r: BiowasteRecord) => String(r.container_count) },
    { key: "record_date" as const, label: "Date", render: (r: BiowasteRecord) => new Date(r.record_date).toLocaleDateString() },
    { key: "disposal_vendor" as const, label: "Vendor", render: (r: BiowasteRecord) => r.disposal_vendor ?? "---" },
    { key: "manifest_number" as const, label: "Manifest #", render: (r: BiowasteRecord) => r.manifest_number ?? "---" },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <SegmentedControl
            value={subView}
            onChange={setSubView}
            data={[
              { value: "records", label: "Records" },
              { value: "monthly", label: "Monthly Report" },
            ]}
          />
          {subView === "records" && (
            <Select placeholder="Category" data={["yellow", "red", "white_translucent", "blue", "cytotoxic", "chemical", "radioactive"]} value={catFilter} onChange={setCatFilter} clearable w={180} />
          )}
          {subView === "monthly" && monthOptions.length > 0 && (
            <Select value={selectedMonth} onChange={(v) => setSelectedMonth(v ?? selectedMonth)} data={monthOptions} w={200} />
          )}
          {subView === "records" && <Text c="dimmed" size="sm">{records.length} record(s)</Text>}
        </Group>
        {canCreate && subView === "records" && <Button leftSection={<IconPlus size={16} />} onClick={open}>Add Record</Button>}
      </Group>

      {subView === "records" ? (
        <DataTable columns={columns} data={records} loading={isLoading} rowKey={(r) => r.id} emptyTitle="No bio-waste records" />
      ) : (
        <Paper p="md" withBorder>
          <Title order={5} mb="md">Monthly BMW Summary: {new Date(selectedMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</Title>
          {Object.keys(monthlyReport).length === 0 ? (
            <Text c="dimmed">No records for this month</Text>
          ) : (
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Total Weight (kg)</Table.Th>
                  <Table.Th>Total Containers</Table.Th>
                  <Table.Th>Record Count</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {Object.entries(monthlyReport).map(([cat, data]) => (
                  <Table.Tr key={cat}>
                    <Table.Td>
                      <Badge color={wasteColors[cat] ?? "slate"}>{cat.replace(/_/g, " ")}</Badge>
                    </Table.Td>
                    <Table.Td>{data.weight.toFixed(2)}</Table.Td>
                    <Table.Td>{data.containers}</Table.Td>
                    <Table.Td>{data.count}</Table.Td>
                  </Table.Tr>
                ))}
                <Table.Tr style={{ fontWeight: 600 }}>
                  <Table.Td>Total</Table.Td>
                  <Table.Td>{Object.values(monthlyReport).reduce((sum, d) => sum + d.weight, 0).toFixed(2)}</Table.Td>
                  <Table.Td>{Object.values(monthlyReport).reduce((sum, d) => sum + d.containers, 0)}</Table.Td>
                  <Table.Td>{Object.values(monthlyReport).reduce((sum, d) => sum + d.count, 0)}</Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      )}

      <Drawer opened={opened} onClose={close} title="Bio-waste Record" position="right" size="md">
        <Stack>
          <TextInput label="Department ID" required value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.currentTarget.value })} />
          <Select label="Waste Category" required data={["yellow", "red", "white_translucent", "blue", "cytotoxic", "chemical", "radioactive"]} value={form.waste_category} onChange={(v) => setForm({ ...form, waste_category: (v ?? "yellow") as WasteCategoryType })} />
          <NumberInput label="Weight (kg)" required decimalScale={3} value={form.weight_kg} onChange={(v) => setForm({ ...form, weight_kg: Number(v) })} />
          <TextInput label="Record Date" type="date" required value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.currentTarget.value })} />
          <NumberInput label="Container Count" value={form.container_count} onChange={(v) => setForm({ ...form, container_count: Number(v) })} />
          <TextInput label="Disposal Vendor" value={form.disposal_vendor ?? ""} onChange={(e) => setForm({ ...form, disposal_vendor: e.currentTarget.value || undefined })} />
          <TextInput label="Manifest Number" value={form.manifest_number ?? ""} onChange={(e) => setForm({ ...form, manifest_number: e.currentTarget.value || undefined })} />
          <Button loading={createMut.isPending} onClick={() => createMut.mutate(form)}>Save</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Hand Hygiene Tab ────────────────────────────────────

function HygieneTab() {
  const canCreate = useHasPermission(P.INFECTION_CONTROL.HYGIENE_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [subView, setSubView] = useState<string>("audits");

  const { data: audits = [], isLoading } = useQuery({
    queryKey: ["ic-hygiene"],
    queryFn: () => api.listHygieneAudits(),
  });

  const { data: cultures = [], isLoading: culturesLoading } = useQuery({
    queryKey: ["ic-cultures"],
    queryFn: () => api.listCultureSurveillance(),
  });

  // Feature 2: Bundle compliance stats
  const { data: deviceDays = [] } = useQuery({
    queryKey: ["ic-device-days"],
    queryFn: () => api.listDeviceDays(),
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
    return { passRate: total > 0 ? ((totalPass / total) * 100).toFixed(1) : "0.0", total, totalPass, totalFail };
  }, [cultures]);

  const [form, setForm] = useState<CreateHygieneAuditRequest>({
    audit_date: "",
    department_id: "",
    observations: 0,
    compliant: 0,
    non_compliant: 0,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateHygieneAuditRequest) => api.createHygieneAudit(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ic-hygiene"] });
      notifications.show({ title: "Audit recorded", message: "", color: "success" });
      close();
    },
  });

  const auditColumns = [
    { key: "audit_date" as const, label: "Date", render: (r: HandHygieneAudit) => new Date(r.audit_date).toLocaleDateString() },
    { key: "observations" as const, label: "Observations", render: (r: HandHygieneAudit) => String(r.observations) },
    { key: "compliant" as const, label: "Compliant", render: (r: HandHygieneAudit) => <Badge color="success">{r.compliant}</Badge> },
    { key: "non_compliant" as const, label: "Non-Compliant", render: (r: HandHygieneAudit) => <Badge color="danger">{r.non_compliant}</Badge> },
    { key: "compliance_rate" as const, label: "Rate", render: (r: HandHygieneAudit) => r.compliance_rate != null ? `${Number(r.compliance_rate).toFixed(1)}%` : "---" },
    { key: "staff_category" as const, label: "Staff Category", render: (r: HandHygieneAudit) => r.staff_category ?? "---" },
    { key: "findings" as const, label: "Findings", render: (r: HandHygieneAudit) => r.findings ?? "---" },
  ];

  const cultureColumns = [
    { key: "culture_type" as const, label: "Type", render: (r: CultureSurveillance) => r.culture_type },
    { key: "sample_site" as const, label: "Site", render: (r: CultureSurveillance) => r.sample_site },
    { key: "collection_date" as const, label: "Date", render: (r: CultureSurveillance) => new Date(r.collection_date).toLocaleDateString() },
    { key: "organism" as const, label: "Organism", render: (r: CultureSurveillance) => r.organism ?? "---" },
    { key: "acceptable" as const, label: "Status", render: (r: CultureSurveillance) => r.acceptable == null ? <Badge color="slate">Pending</Badge> : r.acceptable ? <Badge color="success">Pass</Badge> : <Badge color="danger">Fail</Badge> },
    { key: "action_taken" as const, label: "Action", render: (r: CultureSurveillance) => r.action_taken ?? "---" },
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
        {canCreate && subView === "audits" && <Button leftSection={<IconPlus size={16} />} onClick={open}>New Audit</Button>}
      </Group>

      {subView === "audits" && (
        <>
          <DataTable columns={auditColumns} data={audits} loading={isLoading} rowKey={(r) => r.id} emptyTitle="No hygiene audits" />
          {hygieneChartData.length > 0 && (
            <Paper p="md" withBorder mt="md">
              <Title order={5} mb="md">Compliance Rate by Department</Title>
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
            <Text size="sm" c="dimmed" mb="xs">Bundle Compliance Summary</Text>
            <Text size="sm">Based on device-day records. Individual bundle compliance tracking requires structured bundle_compliance field in device day records.</Text>
          </Card>
          <Grid>
            <Grid.Col span={4}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">Total Device Days</Text>
                <Text size="xl" fw={600}>{deviceDays.length}</Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={4}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">Central Line Days</Text>
                <Text size="xl" fw={600}>{deviceDays.reduce((sum, d) => sum + d.central_line_days, 0)}</Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={4}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">Ventilator Days</Text>
                <Text size="xl" fw={600}>{deviceDays.reduce((sum, d) => sum + d.ventilator_days, 0)}</Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={4}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">Catheter Days</Text>
                <Text size="xl" fw={600}>{deviceDays.reduce((sum, d) => sum + d.urinary_catheter_days, 0)}</Text>
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
                <Text size="sm" c="dimmed">Pass Rate</Text>
                <Text size="xl" fw={600} c="teal">{envMonitoringSummary.passRate}%</Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={3}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">Total Samples</Text>
                <Text size="xl" fw={600}>{envMonitoringSummary.total}</Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={3}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">Passed</Text>
                <Text size="xl" fw={600} c="success">{envMonitoringSummary.totalPass}</Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={3}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">Failed</Text>
                <Text size="xl" fw={600} c="danger">{envMonitoringSummary.totalFail}</Text>
              </Card>
            </Grid.Col>
          </Grid>
          <DataTable columns={cultureColumns} data={cultures} loading={culturesLoading} rowKey={(r) => r.id} emptyTitle="No culture records" />
        </>
      )}

      <Drawer opened={opened} onClose={close} title="Hand Hygiene Audit" position="right" size="md">
        <Stack>
          <TextInput label="Audit Date" type="datetime-local" required value={form.audit_date} onChange={(e) => setForm({ ...form, audit_date: e.currentTarget.value })} />
          <TextInput label="Department ID" required value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.currentTarget.value })} />
          <NumberInput label="Total Observations" required value={form.observations} onChange={(v) => setForm({ ...form, observations: Number(v) })} />
          <NumberInput label="Compliant" required value={form.compliant} onChange={(v) => setForm({ ...form, compliant: Number(v) })} />
          <NumberInput label="Non-Compliant" required value={form.non_compliant} onChange={(v) => setForm({ ...form, non_compliant: Number(v) })} />
          <Select label="Staff Category" data={STAFF_CATEGORIES} value={form.staff_category ?? null} onChange={(v) => setForm({ ...form, staff_category: v || undefined })} clearable searchable />
          <Textarea label="Findings" value={form.findings ?? ""} onChange={(e) => setForm({ ...form, findings: e.currentTarget.value || undefined })} />
          <Button loading={createMut.isPending} onClick={() => createMut.mutate(form)}>Save</Button>
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
    queryFn: () => api.listOutbreaks({ outbreak_status: statusFilter ?? undefined }),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["ic-outbreak-contacts", selected?.id],
    queryFn: () => (selected ? api.listOutbreakContacts(selected.id) : Promise.resolve([])),
    enabled: !!selected,
  });

  // Feature 5: Outbreak timeline chart
  const timelineChartData = useMemo(() => {
    if (!selected) return [];
    const data: { date: string; cases: number }[] = [];
    data.push({ date: new Date(selected.detected_date).toLocaleDateString(), cases: selected.initial_cases });
    if (selected.total_cases > selected.initial_cases) {
      data.push({ date: new Date(selected.created_at).toLocaleDateString(), cases: selected.total_cases });
    }
    return data;
  }, [selected]);

  const [form, setForm] = useState<CreateOutbreakRequest>({
    organism: "",
    detected_date: "",
    initial_cases: 1,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateOutbreakRequest) => api.createOutbreak(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ic-outbreaks"] });
      notifications.show({ title: "Outbreak reported", message: "", color: "success" });
      close();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOutbreakRequest }) => api.updateOutbreak(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ic-outbreaks"] });
      notifications.show({ title: "Outbreak updated", message: "", color: "success" });
    },
  });

  const statusTransitions: Record<string, string[]> = {
    suspected: ["confirmed"],
    confirmed: ["contained"],
    contained: ["closed"],
  };

  const columns = [
    { key: "outbreak_number" as const, label: "Number", render: (r: OutbreakEvent) => <Text fw={500}>{r.outbreak_number}</Text> },
    { key: "organism" as const, label: "Organism", render: (r: OutbreakEvent) => r.organism },
    { key: "outbreak_status" as const, label: "Status", render: (r: OutbreakEvent) => <Badge color={outbreakStatusColors[r.outbreak_status] ?? "slate"}>{r.outbreak_status}</Badge> },
    { key: "total_cases" as const, label: "Cases", render: (r: OutbreakEvent) => String(r.total_cases) },
    { key: "detected_date" as const, label: "Detected", render: (r: OutbreakEvent) => new Date(r.detected_date).toLocaleDateString() },
    { key: "hicc_notified" as const, label: "HICC", render: (r: OutbreakEvent) => r.hicc_notified ? <Badge color="success" size="sm">Notified</Badge> : <Badge color="slate" size="sm">No</Badge> },
    {
      key: "actions" as const,
      label: "Actions",
      render: (r: OutbreakEvent) => (
        <Group gap="xs">
          <Tooltip label="View details">
            <ActionIcon variant="subtle" onClick={() => { setSelected(r); openDetail(); }}>
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          {canUpdate && (statusTransitions[r.outbreak_status] ?? []).map((next) => (
            <Button key={next} size="compact-xs" variant="light" color={outbreakStatusColors[next] ?? "slate"} onClick={() => updateMut.mutate({ id: r.id, data: { outbreak_status: next as OutbreakStatusType } })}>
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
          <Select placeholder="Status" data={["suspected", "confirmed", "contained", "closed"]} value={statusFilter} onChange={setStatusFilter} clearable w={160} />
          <Text c="dimmed" size="sm">{outbreaks.length} outbreak(s)</Text>
        </Group>
        {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={open}>Report Outbreak</Button>}
      </Group>

      <DataTable columns={columns} data={outbreaks} loading={isLoading} rowKey={(r) => r.id} emptyTitle="No outbreaks" />

      <Drawer opened={opened} onClose={close} title="Report Outbreak" position="right" size="md">
        <Stack>
          <TextInput label="Organism" required value={form.organism} onChange={(e) => setForm({ ...form, organism: e.currentTarget.value })} />
          <TextInput label="Detected Date" type="datetime-local" required value={form.detected_date} onChange={(e) => setForm({ ...form, detected_date: e.currentTarget.value })} />
          <NumberInput label="Initial Cases" value={form.initial_cases ?? 1} onChange={(v) => setForm({ ...form, initial_cases: Number(v) })} />
          <Textarea label="Description" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.currentTarget.value || undefined })} />
          <Button loading={createMut.isPending} onClick={() => createMut.mutate(form)}>Report</Button>
        </Stack>
      </Drawer>

      <Drawer opened={detailOpened} onClose={closeDetail} title={`Outbreak: ${selected?.outbreak_number ?? ""}`} position="right" size="lg">
        {selected && (
          <Stack>
            <Text fw={600}>{selected.organism}</Text>
            <Group>
              <Badge color={outbreakStatusColors[selected.outbreak_status] ?? "slate"}>{selected.outbreak_status}</Badge>
              <Text size="sm">Cases: {selected.total_cases}</Text>
            </Group>
            {selected.description && <Text size="sm">{selected.description}</Text>}
            {selected.root_cause && <Text size="sm">Root Cause: {selected.root_cause}</Text>}

            {timelineChartData.length > 0 && (
              <Paper p="md" withBorder mt="md">
                <Title order={6} mb="md">Outbreak Progression</Title>
                <Timeline active={timelineChartData.length - 1} bulletSize={24} lineWidth={2}>
                  <Timeline.Item title="Detection">
                    <Text size="sm" c="dimmed">Detected: {new Date(selected.detected_date).toLocaleDateString()}</Text>
                    <Text size="sm">Initial cases: {selected.initial_cases}</Text>
                  </Timeline.Item>
                  {selected.total_cases > selected.initial_cases && (
                    <Timeline.Item title="Escalation">
                      <Text size="sm">Total cases: {selected.total_cases}</Text>
                    </Timeline.Item>
                  )}
                  {selected.containment_date && (
                    <Timeline.Item title="Containment">
                      <Text size="sm" c="dimmed">{new Date(selected.containment_date).toLocaleDateString()}</Text>
                    </Timeline.Item>
                  )}
                  {selected.closure_date && (
                    <Timeline.Item title="Closure">
                      <Text size="sm" c="dimmed">{new Date(selected.closure_date).toLocaleDateString()}</Text>
                    </Timeline.Item>
                  )}
                </Timeline>
              </Paper>
            )}

            <Text fw={600} mt="md">Contacts ({contacts.length})</Text>
            {contacts.map((c: OutbreakContact) => (
              <Group key={c.id} p="xs" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}>
                <Text size="sm">{c.contact_type}</Text>
                {c.quarantine_required && <Badge color="danger" size="sm">Quarantine</Badge>}
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
    queryFn: () => api.listNeedleStickIncidents(),
  });

  const columns = [
    { key: "incident_number" as const, label: "Incident #", render: (r: NeedleStickIncident) => <Text fw={500}>{r.incident_number}</Text> },
    { key: "incident_date" as const, label: "Date", render: (r: NeedleStickIncident) => new Date(r.incident_date).toLocaleDateString() },
    { key: "device_type" as const, label: "Device Type", render: (r: NeedleStickIncident) => r.device_type },
    { key: "body_part" as const, label: "Body Location", render: (r: NeedleStickIncident) => r.body_part ?? "---" },
    { key: "depth" as const, label: "Depth", render: (r: NeedleStickIncident) => r.depth ?? "---" },
    { key: "procedure_during" as const, label: "Procedure", render: (r: NeedleStickIncident) => r.procedure_during ?? "---" },
    {
      key: "pep_initiated" as const,
      label: "PEP Status",
      render: (r: NeedleStickIncident) => (
        <Badge color={r.pep_initiated ? "success" : "danger"}>
          {r.pep_initiated ? "Initiated" : "Not Initiated"}
        </Badge>
      )
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
      }
    },
    { key: "outcome" as const, label: "Outcome", render: (r: NeedleStickIncident) => r.outcome ?? "---" },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text c="dimmed" size="sm">{incidents.length} incident(s)</Text>
        {canCreate && (
          <Button leftSection={<IconPlus size={16} />} disabled>
            Report Incident
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={incidents} loading={isLoading} rowKey={(r) => r.id} emptyTitle="No needle-stick incidents" />
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
    queryFn: () => api.icHaiRates(dateParams),
    enabled: subView === "hai-rates",
  });

  const { data: deviceUtil = [], isLoading: deviceLoading } = useQuery({
    queryKey: ["ic-device-util", dateParams],
    queryFn: () => api.icDeviceUtilization(dateParams),
    enabled: subView === "device-util",
  });

  const { data: amConsumption = [], isLoading: amLoading } = useQuery({
    queryKey: ["ic-am-consumption", dateParams],
    queryFn: () => api.icAntimicrobialConsumption(dateParams),
    enabled: subView === "am-consumption",
  });

  const { data: prophylaxis = [], isLoading: prophLoading } = useQuery({
    queryKey: ["ic-prophylaxis", dateParams],
    queryFn: () => api.icSurgicalProphylaxis(dateParams),
    enabled: subView === "prophylaxis",
  });

  const { data: cultureSens = [], isLoading: csLoading } = useQuery({
    queryKey: ["ic-culture-sens", dateParams],
    queryFn: () => api.icCultureSensitivityReport(dateParams),
    enabled: subView === "culture-sens",
  });

  const { data: mdro = [], isLoading: mdroLoading } = useQuery({
    queryKey: ["ic-mdro", dateParams],
    queryFn: () => api.icMdroTracking(dateParams),
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
    { key: "device_type" as const, label: "Device", render: (r: DeviceUtilizationRow) => r.device_type },
    { key: "device_days" as const, label: "Device Days", render: (r: DeviceUtilizationRow) => String(r.device_days) },
    { key: "patient_days" as const, label: "Patient Days", render: (r: DeviceUtilizationRow) => String(r.patient_days) },
    { key: "utilization_ratio" as const, label: "Utilization Ratio", render: (r: DeviceUtilizationRow) => r.utilization_ratio.toFixed(3) },
  ];

  const amColumns = [
    { key: "drug_name" as const, label: "Drug", render: (r: AntimicrobialConsumptionRow) => <Text fw={500}>{r.drug_name}</Text> },
    { key: "atc_code" as const, label: "ATC Code", render: (r: AntimicrobialConsumptionRow) => r.atc_code ?? "---" },
    { key: "total_ddd" as const, label: "Total DDD", render: (r: AntimicrobialConsumptionRow) => r.total_ddd.toFixed(2) },
    { key: "patient_days" as const, label: "Patient Days", render: (r: AntimicrobialConsumptionRow) => String(r.patient_days) },
    { key: "ddd_per_1000" as const, label: "DDD/1000", render: (r: AntimicrobialConsumptionRow) => r.ddd_per_1000.toFixed(2) },
  ];

  const prophColumns = [
    { key: "procedure_type" as const, label: "Procedure", render: (r: SurgicalProphylaxisRow) => r.procedure_type },
    { key: "total_cases" as const, label: "Total Cases", render: (r: SurgicalProphylaxisRow) => String(r.total_cases) },
    { key: "timely_count" as const, label: "Timely", render: (r: SurgicalProphylaxisRow) => String(r.timely_count) },
    { key: "compliance_pct" as const, label: "Compliance %", render: (r: SurgicalProphylaxisRow) => (
      <Badge color={r.compliance_pct >= 90 ? "success" : r.compliance_pct >= 70 ? "warning" : "danger"}>
        {r.compliance_pct.toFixed(1)}%
      </Badge>
    )},
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
          <DateInput value={from} onChange={(d) => setFrom(d)} placeholder="From" clearable w={140} />
          <DateInput value={to} onChange={(d) => setTo(d)} placeholder="To" clearable w={140} />
        </Group>
      </Group>

      {subView === "hai-rates" && (
        <Paper p="md" withBorder>
          <Title order={5} mb="md">HAI Rates per 1000 Patient Days</Title>
          {haiLoading ? <Text c="dimmed">Loading...</Text> : haiRates.length === 0 ? <Text c="dimmed">No data</Text> : (
            <BarChart
              h={350}
              data={haiRates.map((r) => ({ infection_type: r.infection_type, rate: r.rate_per_1000 }))}
              dataKey="infection_type"
              series={[{ name: "rate", label: "Rate / 1000", color: "danger" }]}
              tickLine="y"
            />
          )}
        </Paper>
      )}

      {subView === "device-util" && (
        <DataTable columns={deviceUtilColumns} data={deviceUtil} loading={deviceLoading} rowKey={(r) => `${r.unit_name}-${r.device_type}`} emptyTitle="No device utilization data" />
      )}

      {subView === "am-consumption" && (
        <DataTable columns={amColumns} data={amConsumption} loading={amLoading} rowKey={(r) => r.drug_name} emptyTitle="No antimicrobial consumption data" />
      )}

      {subView === "prophylaxis" && (
        <DataTable columns={prophColumns} data={prophylaxis} loading={prophLoading} rowKey={(r) => r.procedure_type} emptyTitle="No surgical prophylaxis data" />
      )}

      {subView === "culture-sens" && (
        <Paper p="md" withBorder>
          <Title order={5} mb="md">Culture Sensitivity Matrix</Title>
          {csLoading ? <Text c="dimmed">Loading...</Text> : csMatrix.antibiotics.length === 0 ? (
            <Text c="dimmed">No culture sensitivity data</Text>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <Table striped withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Organism</Table.Th>
                    {csMatrix.antibiotics.map((ab) => <Table.Th key={ab}>{ab}</Table.Th>)}
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
                            <Tooltip label={`S:${row.sensitive_count} I:${row.intermediate_count} R:${row.resistant_count} (n=${row.total_tests})`}>
                              <Badge color={color} size="sm">{pct.toFixed(0)}%</Badge>
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
          <Title order={5} mb="md">MDRO Tracking (Rate per 1000 Patient Days)</Title>
          {mdroLoading ? <Text c="dimmed">Loading...</Text> : mdroChartData.length === 0 ? (
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
    queryFn: () => api.listIcMeetings(),
    enabled: subView === "meetings",
  });

  const { data: monthlyReport, isLoading: reportLoading } = useQuery({
    queryKey: ["ic-monthly-report", monthParam],
    queryFn: () => api.icMonthlySurveillance({ month: monthParam }),
    enabled: subView === "monthly",
  });

  const [meetingForm, setMeetingForm] = useState<CreateIcMeetingRequest>({
    meeting_date: "",
    meeting_type: "regular",
  });

  const createMeetingMut = useMutation({
    mutationFn: (data: CreateIcMeetingRequest) => api.createIcMeeting(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ic-meetings"] });
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
    mutationFn: (data: CreateExposureRequest) => api.createIcExposure(data),
    onSuccess: () => {
      notifications.show({ title: "Exposure recorded", message: "", color: "success" });
      closeExposure();
      setExposureForm({ event_type: "", exposure_date: "", exposure_type: "", pep_initiated: false });
    },
  });

  const meetingColumns = [
    { key: "meeting_date" as const, label: "Date", render: (r: IcMeeting) => new Date(r.meeting_date).toLocaleDateString() },
    { key: "meeting_type" as const, label: "Type", render: (r: IcMeeting) => <Badge variant="light">{r.meeting_type}</Badge> },
    { key: "agenda" as const, label: "Agenda", render: (r: IcMeeting) => r.agenda ?? "---" },
    { key: "attendees" as const, label: "Attendees", render: (r: IcMeeting) => <Badge size="sm">{Array.isArray(r.attendees) ? r.attendees.length : 0}</Badge> },
    { key: "minutes" as const, label: "Minutes", render: (r: IcMeeting) => r.minutes ? <Text size="sm" lineClamp={1}>{r.minutes}</Text> : "---" },
    { key: "action_items" as const, label: "Actions", render: (r: IcMeeting) => <Badge size="sm" color="orange">{Array.isArray(r.action_items) ? r.action_items.length : 0}</Badge> },
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
            <Button leftSection={<IconPlus size={16} />} onClick={openMeeting}>New Meeting</Button>
          )}
          {canCreate && subView === "exposures" && (
            <Button leftSection={<IconPlus size={16} />} onClick={openExposure}>Record Exposure</Button>
          )}
        </Group>
      </Group>

      {subView === "meetings" && (
        <DataTable columns={meetingColumns} data={meetings} loading={meetingsLoading} rowKey={(r) => r.id} emptyTitle="No IC meetings" />
      )}

      {subView === "exposures" && (
        <Paper p="md" withBorder>
          <Text fw={600} mb="md">Exposure Recording</Text>
          <Text c="dimmed" size="sm">Use the "Record Exposure" button to log an occupational exposure event (needlestick, blood/body fluid contact, etc.).</Text>
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
          {reportLoading ? <Text c="dimmed">Loading monthly report...</Text> : monthlyReport ? (
            <Grid>
              <Grid.Col span={{ base: 6, md: 3 }}>
                <Card withBorder p="md">
                  <Text size="sm" c="dimmed">HAI Count</Text>
                  <Text size="xl" fw={600} c="danger">{monthlyReport.hai_count}</Text>
                  <Text size="xs" c="dimmed">Rate: {monthlyReport.hai_rate.toFixed(2)}/1000</Text>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, md: 3 }}>
                <Card withBorder p="md">
                  <Text size="sm" c="dimmed">Hand Hygiene</Text>
                  <Text size="xl" fw={600} c="teal">{monthlyReport.hand_hygiene_compliance.toFixed(1)}%</Text>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, md: 3 }}>
                <Card withBorder p="md">
                  <Text size="sm" c="dimmed">BMW Total (kg)</Text>
                  <Text size="xl" fw={600}>{monthlyReport.bmw_total_kg.toFixed(1)}</Text>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, md: 3 }}>
                <Card withBorder p="md">
                  <Text size="sm" c="dimmed">Cultures / MDRO / Outbreaks</Text>
                  <Text size="xl" fw={600}>{monthlyReport.culture_count} / {monthlyReport.mdro_count} / {monthlyReport.outbreak_count}</Text>
                </Card>
              </Grid.Col>
            </Grid>
          ) : (
            <Text c="dimmed">No data for the selected month</Text>
          )}
        </Stack>
      )}

      {/* Create Meeting Drawer */}
      <Drawer opened={meetingOpened} onClose={closeMeeting} title="New IC Meeting" position="right" size="md">
        <Stack>
          <TextInput label="Meeting Date" type="datetime-local" required value={meetingForm.meeting_date} onChange={(e) => setMeetingForm({ ...meetingForm, meeting_date: e.currentTarget.value })} />
          <Select label="Meeting Type" data={["regular", "emergency", "ad_hoc", "orientation"]} value={meetingForm.meeting_type ?? "regular"} onChange={(v) => setMeetingForm({ ...meetingForm, meeting_type: v ?? "regular" })} />
          <Textarea label="Agenda" value={meetingForm.agenda ?? ""} onChange={(e) => setMeetingForm({ ...meetingForm, agenda: e.currentTarget.value || undefined })} />
          <Textarea label="Minutes" value={meetingForm.minutes ?? ""} onChange={(e) => setMeetingForm({ ...meetingForm, minutes: e.currentTarget.value || undefined })} />
          <Button loading={createMeetingMut.isPending} onClick={() => createMeetingMut.mutate(meetingForm)}>Create</Button>
        </Stack>
      </Drawer>

      {/* Exposure Drawer */}
      <Drawer opened={exposureOpened} onClose={closeExposure} title="Record Exposure" position="right" size="md">
        <Stack>
          <Select label="Event Type" required data={["needlestick", "splash", "cut", "bite", "other"]} value={exposureForm.event_type || null} onChange={(v) => setExposureForm({ ...exposureForm, event_type: v ?? "" })} />
          <TextInput label="Exposure Date" type="datetime-local" required value={exposureForm.exposure_date} onChange={(e) => setExposureForm({ ...exposureForm, exposure_date: e.currentTarget.value })} />
          <Select label="Exposure Type" required data={["percutaneous", "mucocutaneous", "intact_skin", "other"]} value={exposureForm.exposure_type || null} onChange={(v) => setExposureForm({ ...exposureForm, exposure_type: v ?? "" })} />
          <TextInput label="Source Patient ID" value={exposureForm.source_patient_id ?? ""} onChange={(e) => setExposureForm({ ...exposureForm, source_patient_id: e.currentTarget.value || undefined })} />
          <TextInput label="Exposed Staff ID" value={exposureForm.exposed_staff_id ?? ""} onChange={(e) => setExposureForm({ ...exposureForm, exposed_staff_id: e.currentTarget.value || undefined })} />
          <Switch label="PEP Initiated" checked={exposureForm.pep_initiated} onChange={(e) => setExposureForm({ ...exposureForm, pep_initiated: e.currentTarget.checked })} />
          <Textarea label="Notes" value={exposureForm.notes ?? ""} onChange={(e) => setExposureForm({ ...exposureForm, notes: e.currentTarget.value || undefined })} />
          <Button loading={createExposureMut.isPending} onClick={() => createExposureMut.mutate(exposureForm)}>Save</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Main Infection Control Page
// ══════════════════════════════════════════════════════════

export function InfectionControlPage() {
  useRequirePermission(P.INFECTION_CONTROL.SURVEILLANCE_LIST);

  return (
    <div>
      <PageHeader
        title="Infection Control"
        subtitle="HAI surveillance, antibiotic stewardship, bio-waste, hand hygiene, outbreak management, and sharps safety"
        icon={<IconShieldCheck size={20} stroke={1.5} />}
        color="danger"
      />

      <Tabs defaultValue="surveillance" mt="md">
        <Tabs.List>
          <Tabs.Tab value="surveillance" leftSection={<IconBug size={16} />}>HAI Surveillance</Tabs.Tab>
          <Tabs.Tab value="stewardship" leftSection={<IconPill size={16} />}>Stewardship & Antibiogram</Tabs.Tab>
          <Tabs.Tab value="biowaste" leftSection={<IconBiohazard size={16} />}>Bio-Waste</Tabs.Tab>
          <Tabs.Tab value="hygiene" leftSection={<IconHandStop size={16} />}>Hygiene & Bundles</Tabs.Tab>
          <Tabs.Tab value="outbreaks" leftSection={<IconVirusSearch size={16} />}>Outbreaks</Tabs.Tab>
          <Tabs.Tab value="sharps" leftSection={<IconNeedleThread size={16} />}>Sharps Safety</Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>Analytics</Tabs.Tab>
          <Tabs.Tab value="meetings" leftSection={<IconUsers size={16} />}>Meetings</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="surveillance" pt="md"><SurveillanceTab /></Tabs.Panel>
        <Tabs.Panel value="stewardship" pt="md"><StewardshipTab /></Tabs.Panel>
        <Tabs.Panel value="biowaste" pt="md"><BiowasteTab /></Tabs.Panel>
        <Tabs.Panel value="hygiene" pt="md"><HygieneTab /></Tabs.Panel>
        <Tabs.Panel value="outbreaks" pt="md"><OutbreakTab /></Tabs.Panel>
        <Tabs.Panel value="sharps" pt="md"><SharpsSafetyTab /></Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md"><AnalyticsTab /></Tabs.Panel>
        <Tabs.Panel value="meetings" pt="md"><MeetingsTab /></Tabs.Panel>
      </Tabs>
    </div>
  );
}
