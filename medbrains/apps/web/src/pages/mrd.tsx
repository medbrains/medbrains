import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconFileCertificate,
  IconArrowRight,
  IconArrowBack,
  IconBabyCarriage,
  IconSkull,
  IconChartBar,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  MrdMedicalRecord,
  MrdRecordMovement,
  MrdBirthRegister,
  MrdDeathRegister,
  MrdRetentionPolicy,
  CreateMrdRecordRequest,
  IssueMrdRecordRequest,
  CreateMrdBirthRequest,
  CreateMrdDeathRequest,
  CreateMrdRetentionPolicyRequest,
  MrdMorbidityMortalityResponse,
  MrdAdmissionDischargeSummary,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";
import type { Column } from "../components/DataTable";

// ── Helpers ──────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active: "success", archived: "primary", destroyed: "slate", missing: "danger",
  issued: "warning", returned: "success", overdue: "danger",
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

// ══════════════════════════════════════════════════════════
//  Page
// ══════════════════════════════════════════════════════════

export function MrdPage() {
  useRequirePermission(P.MRD.RECORDS_LIST);
  const [tab, setTab] = useState<string | null>("records");

  return (
    <div>
      <PageHeader title="Medical Records Department" subtitle="Record indexing, birth/death registries, statistics" />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="records" leftSection={<IconFileCertificate size={16} />}>Records</Tabs.Tab>
          <Tabs.Tab value="births" leftSection={<IconBabyCarriage size={16} />}>Birth Register</Tabs.Tab>
          <Tabs.Tab value="deaths" leftSection={<IconSkull size={16} />}>Death Register</Tabs.Tab>
          <Tabs.Tab value="stats" leftSection={<IconChartBar size={16} />}>Statistics</Tabs.Tab>
          <Tabs.Tab value="retention" leftSection={<IconShieldCheck size={16} />}>Retention Policies</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="records" pt="md"><RecordsTab /></Tabs.Panel>
        <Tabs.Panel value="births" pt="md"><BirthsTab /></Tabs.Panel>
        <Tabs.Panel value="deaths" pt="md"><DeathsTab /></Tabs.Panel>
        <Tabs.Panel value="stats" pt="md"><StatsTab /></Tabs.Panel>
        <Tabs.Panel value="retention" pt="md"><RetentionTab /></Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Records Tab
// ══════════════════════════════════════════════════════════

function RecordsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.MRD.RECORDS_CREATE);
  const canManage = useHasPermission(P.MRD.RECORDS_MANAGE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();
  const [issueOpen, { open: openIssue, close: closeIssue }] = useDisclosure();
  const [movementsOpen, { open: openMovements, close: closeMovements }] = useDisclosure();
  const [selectedRecord, setSelectedRecord] = useState<MrdMedicalRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["mrd-records", statusFilter],
    queryFn: () => api.listMrdRecords({ status: statusFilter ?? undefined }),
  });

  // Create
  const [createForm, setCreateForm] = useState<CreateMrdRecordRequest>({ patient_id: "" });
  const createMut = useMutation({
    mutationFn: (body: CreateMrdRecordRequest) => api.createMrdRecord(body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["mrd-records"] }); closeCreate(); notifications.show({ title: "Created", message: "Medical record indexed", color: "success" }); },
  });

  // Issue
  const [issueForm, setIssueForm] = useState<IssueMrdRecordRequest>({});
  const issueMut = useMutation({
    mutationFn: (body: IssueMrdRecordRequest) => api.issueMrdRecord(selectedRecord?.id ?? "", body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["mrd-records"] }); closeIssue(); notifications.show({ title: "Issued", message: "Record issued", color: "success" }); },
  });

  // Movements
  const { data: movements = [] } = useQuery({
    queryKey: ["mrd-movements", selectedRecord?.id],
    queryFn: () => api.listMrdMovements(selectedRecord?.id ?? ""),
    enabled: movementsOpen && !!selectedRecord,
  });

  const returnMut = useMutation({
    mutationFn: (movementId: string) => api.returnMrdRecord(selectedRecord?.id ?? "", movementId),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["mrd-movements"] }); void qc.invalidateQueries({ queryKey: ["mrd-records"] }); notifications.show({ title: "Returned", message: "Record returned", color: "success" }); },
  });

  const columns: Column<MrdMedicalRecord>[] = [
    { key: "record_number", label: "Record #", render: (r) => <Text fw={600}>{r.record_number}</Text> },
    { key: "record_type", label: "Type", render: (r) => <Badge variant="light">{r.record_type.toUpperCase()}</Badge> },
    { key: "volume_number", label: "Vol", render: (r) => <Text>{r.volume_number}</Text> },
    { key: "shelf_location", label: "Shelf", render: (r) => <Text>{r.shelf_location ?? "—"}</Text> },
    { key: "status", label: "Status", render: (r) => <Badge color={STATUS_COLORS[r.status] ?? "slate"}>{r.status}</Badge> },
    { key: "last_accessed_at", label: "Last Accessed", render: (r) => <Text size="sm">{fmt(r.last_accessed_at)}</Text> },
    {
      key: "actions", label: "", render: (r) => (
        <Group gap={4}>
          {canManage && (
            <Tooltip label="Issue">
              <ActionIcon variant="light" onClick={() => { setSelectedRecord(r); setIssueForm({}); openIssue(); }} aria-label="Go forward">
                <IconArrowRight size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Movements">
            <ActionIcon variant="light" color="primary" onClick={() => { setSelectedRecord(r); openMovements(); }} aria-label="Arrow Back">
              <IconArrowBack size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select data={[{ value: "", label: "All" }, { value: "active", label: "Active" }, { value: "archived", label: "Archived" }, { value: "missing", label: "Missing" }, { value: "destroyed", label: "Destroyed" }]} value={statusFilter ?? ""} onChange={(v) => setStatusFilter(v || null)} placeholder="Filter status" w={200} clearable />
        {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Index Record</Button>}
      </Group>
      <DataTable columns={columns} data={records} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Drawer */}
      <Drawer opened={createOpen} onClose={closeCreate} title="Index Medical Record" position="right" size="xl">
        <Stack>
          <PatientSearchSelect value={createForm.patient_id} onChange={(v) => setCreateForm({ ...createForm, patient_id: v })} required />
          <Select label="Record Type" data={["opd", "ipd", "emergency"]} value={createForm.record_type ?? "opd"} onChange={(v) => setCreateForm({ ...createForm, record_type: v ?? "opd" })} />
          <NumberInput label="Volume" value={createForm.volume_number ?? 1} onChange={(v) => setCreateForm({ ...createForm, volume_number: Number(v) })} min={1} />
          <TextInput label="Shelf Location" value={createForm.shelf_location ?? ""} onChange={(e) => setCreateForm({ ...createForm, shelf_location: e.currentTarget.value })} />
          <NumberInput label="Total Pages" value={createForm.total_pages ?? undefined} onChange={(v) => setCreateForm({ ...createForm, total_pages: v ? Number(v) : undefined })} />
          <Textarea label="Notes" value={createForm.notes ?? ""} onChange={(e) => setCreateForm({ ...createForm, notes: e.currentTarget.value })} />
          <Button onClick={() => createMut.mutate(createForm)} loading={createMut.isPending}>Create</Button>
        </Stack>
      </Drawer>

      {/* Issue Drawer */}
      <Drawer opened={issueOpen} onClose={closeIssue} title={`Issue: ${selectedRecord?.record_number ?? ""}`} position="right" size="xl">
        <Stack>
          <TextInput label="Issued To (User ID)" value={issueForm.issued_to_user_id ?? ""} onChange={(e) => setIssueForm({ ...issueForm, issued_to_user_id: e.currentTarget.value || undefined })} />
          <TextInput label="Department ID" value={issueForm.issued_to_department_id ?? ""} onChange={(e) => setIssueForm({ ...issueForm, issued_to_department_id: e.currentTarget.value || undefined })} />
          <TextInput label="Purpose" value={issueForm.purpose ?? ""} onChange={(e) => setIssueForm({ ...issueForm, purpose: e.currentTarget.value })} />
          <NumberInput label="Due in (days)" value={issueForm.due_days ?? 7} onChange={(v) => setIssueForm({ ...issueForm, due_days: Number(v) })} min={1} />
          <Button onClick={() => issueMut.mutate(issueForm)} loading={issueMut.isPending}>Issue Record</Button>
        </Stack>
      </Drawer>

      {/* Movements Drawer */}
      <Drawer opened={movementsOpen} onClose={closeMovements} title={`Movements: ${selectedRecord?.record_number ?? ""}`} position="right" size="lg">
        <DataTable
          columns={[
            { key: "issued_at", label: "Issued", render: (m: MrdRecordMovement) => <Text size="sm">{fmt(m.issued_at)}</Text> },
            { key: "due_date", label: "Due", render: (m: MrdRecordMovement) => <Text size="sm">{fmt(m.due_date)}</Text> },
            { key: "returned_at", label: "Returned", render: (m: MrdRecordMovement) => <Text size="sm">{fmt(m.returned_at)}</Text> },
            { key: "status", label: "Status", render: (m: MrdRecordMovement) => <Badge color={STATUS_COLORS[m.status] ?? "slate"}>{m.status}</Badge> },
            { key: "purpose", label: "Purpose", render: (m: MrdRecordMovement) => <Text size="sm">{m.purpose ?? "—"}</Text> },
            {
              key: "action", label: "", render: (m: MrdRecordMovement) =>
                canManage && m.status === "issued" ? (
                  <Button size="xs" variant="light" onClick={() => returnMut.mutate(m.id)} loading={returnMut.isPending}>Return</Button>
                ) : null,
            },
          ]}
          data={movements}
          loading={false}
          rowKey={(m) => m.id}
        />
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Births Tab
// ══════════════════════════════════════════════════════════

function BirthsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.MRD.BIRTHS_CREATE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();

  const { data: births = [], isLoading } = useQuery({
    queryKey: ["mrd-births"],
    queryFn: () => api.listMrdBirths(),
  });

  const [form, setForm] = useState<CreateMrdBirthRequest>({
    patient_id: "", birth_date: "", baby_gender: "",
  });

  const createMut = useMutation({
    mutationFn: (body: CreateMrdBirthRequest) => api.createMrdBirth(body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["mrd-births"] }); closeCreate(); notifications.show({ title: "Registered", message: "Birth registered", color: "success" }); },
  });

  const columns: Column<MrdBirthRegister>[] = [
    { key: "register_number", label: "Reg #", render: (r) => <Text fw={600}>{r.register_number}</Text> },
    { key: "birth_date", label: "Date", render: (r) => <Text>{fmt(r.birth_date)}</Text> },
    { key: "baby_gender", label: "Gender", render: (r) => <Badge variant="light">{r.baby_gender}</Badge> },
    { key: "baby_weight_grams", label: "Weight (g)", render: (r) => <Text>{r.baby_weight_grams ?? "—"}</Text> },
    { key: "birth_type", label: "Type", render: (r) => <Text>{r.birth_type}</Text> },
    { key: "apgar", label: "APGAR", render: (r) => <Text>{r.apgar_1min != null ? `${r.apgar_1min}/${r.apgar_5min}` : "—"}</Text> },
    { key: "cert", label: "Certificate", render: (r) => r.certificate_issued ? <Badge color="success">Issued</Badge> : <Badge color="slate">Pending</Badge> },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Register Birth</Button>}
      </Group>
      <DataTable columns={columns} data={births} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer opened={createOpen} onClose={closeCreate} title="Register Birth" position="right" size="xl">
        <Stack>
          <PatientSearchSelect label="Mother Patient" value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} required />
          <TextInput label="Birth Date" required placeholder="YYYY-MM-DD" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.currentTarget.value })} />
          <Select label="Baby Gender" data={["male", "female", "ambiguous"]} required value={form.baby_gender} onChange={(v) => setForm({ ...form, baby_gender: v ?? "" })} />
          <NumberInput label="Baby Weight (grams)" value={form.baby_weight_grams ?? undefined} onChange={(v) => setForm({ ...form, baby_weight_grams: v ? Number(v) : undefined })} />
          <Select label="Birth Type" data={["normal", "cesarean", "assisted", "vacuum", "forceps"]} value={form.birth_type ?? "normal"} onChange={(v) => setForm({ ...form, birth_type: v ?? "normal" })} />
          <Group grow>
            <NumberInput label="APGAR 1min" value={form.apgar_1min ?? undefined} onChange={(v) => setForm({ ...form, apgar_1min: v != null ? Number(v) : undefined })} min={0} max={10} />
            <NumberInput label="APGAR 5min" value={form.apgar_5min ?? undefined} onChange={(v) => setForm({ ...form, apgar_5min: v != null ? Number(v) : undefined })} min={0} max={10} />
          </Group>
          <TextInput label="Father Name" value={form.father_name ?? ""} onChange={(e) => setForm({ ...form, father_name: e.currentTarget.value })} />
          <NumberInput label="Mother Age" value={form.mother_age ?? undefined} onChange={(v) => setForm({ ...form, mother_age: v ? Number(v) : undefined })} />
          <Textarea label="Complications" value={form.complications ?? ""} onChange={(e) => setForm({ ...form, complications: e.currentTarget.value })} />
          <Button onClick={() => createMut.mutate(form)} loading={createMut.isPending}>Register</Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Deaths Tab
// ══════════════════════════════════════════════════════════

function DeathsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.MRD.DEATHS_CREATE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();

  const { data: deaths = [], isLoading } = useQuery({
    queryKey: ["mrd-deaths"],
    queryFn: () => api.listMrdDeaths(),
  });

  const [form, setForm] = useState<CreateMrdDeathRequest>({
    patient_id: "", death_date: "",
  });

  const createMut = useMutation({
    mutationFn: (body: CreateMrdDeathRequest) => api.createMrdDeath(body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["mrd-deaths"] }); closeCreate(); notifications.show({ title: "Registered", message: "Death registered", color: "success" }); },
  });

  const columns: Column<MrdDeathRegister>[] = [
    { key: "register_number", label: "Reg #", render: (r) => <Text fw={600}>{r.register_number}</Text> },
    { key: "death_date", label: "Date", render: (r) => <Text>{fmt(r.death_date)}</Text> },
    { key: "cause_of_death", label: "Cause", render: (r) => <Text lineClamp={1}>{r.cause_of_death ?? "—"}</Text> },
    { key: "manner_of_death", label: "Manner", render: (r) => <Badge variant="light">{r.manner_of_death}</Badge> },
    { key: "is_medico_legal", label: "MLC", render: (r) => r.is_medico_legal ? <Badge color="danger">MLC</Badge> : <Text size="sm">No</Text> },
    { key: "cert", label: "Certificate", render: (r) => r.certificate_issued ? <Badge color="success">Issued</Badge> : <Badge color="slate">Pending</Badge> },
    { key: "municipality", label: "Reported", render: (r) => r.reported_to_municipality ? <Badge color="success">Yes</Badge> : <Badge color="orange">No</Badge> },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Register Death</Button>}
      </Group>
      <DataTable columns={columns} data={deaths} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer opened={createOpen} onClose={closeCreate} title="Register Death" position="right" size="xl">
        <Stack>
          <PatientSearchSelect value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} required />
          <TextInput label="Death Date" required placeholder="YYYY-MM-DD" value={form.death_date} onChange={(e) => setForm({ ...form, death_date: e.currentTarget.value })} />
          <TextInput label="Cause of Death" value={form.cause_of_death ?? ""} onChange={(e) => setForm({ ...form, cause_of_death: e.currentTarget.value })} />
          <TextInput label="Immediate Cause" value={form.immediate_cause ?? ""} onChange={(e) => setForm({ ...form, immediate_cause: e.currentTarget.value })} />
          <TextInput label="Antecedent Cause" value={form.antecedent_cause ?? ""} onChange={(e) => setForm({ ...form, antecedent_cause: e.currentTarget.value })} />
          <TextInput label="Underlying Cause" value={form.underlying_cause ?? ""} onChange={(e) => setForm({ ...form, underlying_cause: e.currentTarget.value })} />
          <Select label="Manner of Death" data={["natural", "accident", "suicide", "homicide", "undetermined", "pending"]} value={form.manner_of_death ?? "natural"} onChange={(v) => setForm({ ...form, manner_of_death: v ?? "natural" })} />
          <Group grow>
            <Select label="Medico-Legal?" data={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} value={String(form.is_medico_legal ?? false)} onChange={(v) => setForm({ ...form, is_medico_legal: v === "true" })} />
            <Select label="Brought Dead?" data={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} value={String(form.is_brought_dead ?? false)} onChange={(v) => setForm({ ...form, is_brought_dead: v === "true" })} />
          </Group>
          <Button onClick={() => createMut.mutate(form)} loading={createMut.isPending}>Register</Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Statistics Tab
// ══════════════════════════════════════════════════════════

function StatsTab() {
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);

  const dateParams = {
    from_date: fromDate?.slice(0, 10) ?? undefined,
    to_date: toDate?.slice(0, 10) ?? undefined,
  };

  const { data: morbMort } = useQuery({
    queryKey: ["mrd-morbidity-mortality", dateParams],
    queryFn: () => api.getMrdMorbidityMortality(dateParams),
  });

  const { data: admDisch } = useQuery({
    queryKey: ["mrd-admission-discharge", dateParams],
    queryFn: () => api.getMrdAdmissionDischarge(dateParams),
  });

  return (
    <Stack>
      <Group>
        <DateInput label="From" value={fromDate} onChange={setFromDate} clearable />
        <DateInput label="To" value={toDate} onChange={setToDate} clearable />
      </Group>

      {/* Summary Cards */}
      {admDisch && (
        <SimpleGrid cols={{ base: 2, md: 4 }}>
          <Card withBorder><Text size="sm" c="dimmed">Admitted</Text><Text size="xl" fw={700}>{admDisch.total_admitted}</Text></Card>
          <Card withBorder><Text size="sm" c="dimmed">Discharged</Text><Text size="xl" fw={700}>{admDisch.total_discharged}</Text></Card>
          <Card withBorder><Text size="sm" c="dimmed">Deaths</Text><Text size="xl" fw={700} c="danger">{admDisch.total_deaths}</Text></Card>
          <Card withBorder><Text size="sm" c="dimmed">Avg LOS (days)</Text><Text size="xl" fw={700}>{admDisch.overall_avg_los_days?.toFixed(1) ?? "—"}</Text></Card>
        </SimpleGrid>
      )}

      {/* Morbidity */}
      <Text fw={600} mt="md">Top Morbidity (by ICD-10)</Text>
      <DataTable
        columns={[
          { key: "icd_code", label: "ICD Code", render: (r: NonNullable<MrdMorbidityMortalityResponse>["morbidity"][number]) => <Text>{r.icd_code ?? "—"}</Text> },
          { key: "diagnosis_name", label: "Diagnosis", render: (r: NonNullable<MrdMorbidityMortalityResponse>["morbidity"][number]) => <Text>{r.diagnosis_name}</Text> },
          { key: "count", label: "Cases", render: (r: NonNullable<MrdMorbidityMortalityResponse>["morbidity"][number]) => <Text fw={600}>{r.count}</Text> },
        ]}
        data={morbMort?.morbidity ?? []}
        loading={false}
        rowKey={(r) => `${r.icd_code}-${r.diagnosis_name}`}
      />

      {/* Mortality */}
      <Text fw={600} mt="md">Top Mortality Causes</Text>
      <DataTable
        columns={[
          { key: "cause_of_death", label: "Cause", render: (r: NonNullable<MrdMorbidityMortalityResponse>["mortality"][number]) => <Text>{r.cause_of_death ?? "Unknown"}</Text> },
          { key: "manner_of_death", label: "Manner", render: (r: NonNullable<MrdMorbidityMortalityResponse>["mortality"][number]) => <Badge variant="light">{r.manner_of_death}</Badge> },
          { key: "count", label: "Deaths", render: (r: NonNullable<MrdMorbidityMortalityResponse>["mortality"][number]) => <Text fw={600} c="danger">{r.count}</Text> },
        ]}
        data={morbMort?.mortality ?? []}
        loading={false}
        rowKey={(r) => `${r.cause_of_death}-${r.manner_of_death}`}
      />

      {/* Department-wise Admission/Discharge */}
      <Text fw={600} mt="md">Admission/Discharge by Department</Text>
      <DataTable
        columns={[
          { key: "department_name", label: "Department", render: (r: NonNullable<MrdAdmissionDischargeSummary>["rows"][number]) => <Text>{r.department_name ?? "Unknown"}</Text> },
          { key: "total_admitted", label: "Admitted", render: (r: NonNullable<MrdAdmissionDischargeSummary>["rows"][number]) => <Text>{r.total_admitted}</Text> },
          { key: "total_discharged", label: "Discharged", render: (r: NonNullable<MrdAdmissionDischargeSummary>["rows"][number]) => <Text>{r.total_discharged}</Text> },
          { key: "total_deaths", label: "Deaths", render: (r: NonNullable<MrdAdmissionDischargeSummary>["rows"][number]) => <Text c="danger">{r.total_deaths}</Text> },
          { key: "avg_los_days", label: "Avg LOS", render: (r: NonNullable<MrdAdmissionDischargeSummary>["rows"][number]) => <Text>{r.avg_los_days?.toFixed(1) ?? "—"}</Text> },
        ]}
        data={admDisch?.rows ?? []}
        loading={false}
        rowKey={(r) => r.department_name ?? "unknown"}
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Retention Policies Tab
// ══════════════════════════════════════════════════════════

function RetentionTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.MRD.RECORDS_MANAGE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["mrd-retention"],
    queryFn: () => api.listMrdRetentionPolicies(),
  });

  const [form, setForm] = useState<CreateMrdRetentionPolicyRequest>({
    record_type: "", category: "", retention_years: 5,
  });

  const createMut = useMutation({
    mutationFn: (body: CreateMrdRetentionPolicyRequest) => api.createMrdRetentionPolicy(body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["mrd-retention"] }); closeCreate(); notifications.show({ title: "Created", message: "Retention policy created", color: "success" }); },
  });

  const columns: Column<MrdRetentionPolicy>[] = [
    { key: "record_type", label: "Record Type", render: (r) => <Text>{r.record_type}</Text> },
    { key: "category", label: "Category", render: (r) => <Text>{r.category}</Text> },
    { key: "retention_years", label: "Years", render: (r) => <Text fw={600}>{r.retention_years}</Text> },
    { key: "legal_reference", label: "Legal Ref", render: (r) => <Text size="sm">{r.legal_reference ?? "—"}</Text> },
    { key: "destruction_method", label: "Destruction", render: (r) => <Text size="sm">{r.destruction_method ?? "—"}</Text> },
    { key: "is_active", label: "Active", render: (r) => r.is_active ? <Badge color="success">Yes</Badge> : <Badge color="slate">No</Badge> },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canManage && <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Add Policy</Button>}
      </Group>
      <DataTable columns={columns} data={policies} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer opened={createOpen} onClose={closeCreate} title="Add Retention Policy" position="right" size="xl">
        <Stack>
          <Select label="Record Type" data={["opd", "ipd", "emergency", "maternity", "mlc", "pediatric"]} required value={form.record_type} onChange={(v) => setForm({ ...form, record_type: v ?? "" })} />
          <TextInput label="Category" required placeholder="e.g., adult_opd" value={form.category} onChange={(e) => setForm({ ...form, category: e.currentTarget.value })} />
          <NumberInput label="Retention Years" required value={form.retention_years} onChange={(v) => setForm({ ...form, retention_years: Number(v) })} min={1} />
          <TextInput label="Legal Reference" value={form.legal_reference ?? ""} onChange={(e) => setForm({ ...form, legal_reference: e.currentTarget.value })} />
          <Select label="Destruction Method" data={["shredding", "incineration"]} value={form.destruction_method ?? null} onChange={(v) => setForm({ ...form, destruction_method: v ?? undefined })} clearable />
          <Button onClick={() => createMut.mutate(form)} loading={createMut.isPending}>Create</Button>
        </Stack>
      </Drawer>
    </>
  );
}
