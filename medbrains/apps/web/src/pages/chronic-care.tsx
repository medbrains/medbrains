import { useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  NumberInput,
  Paper,
  Progress,
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
import { LineChart } from "@mantine/charts";
import {
  IconPlus,
  IconReportMedical,
  IconUsers,
  IconHeartRateMonitor,
  IconPencil,
  IconTrash,
  IconTimeline,
  IconFileText,
  IconArrowUp,
  IconArrowDown,
  IconMinus,
  IconPrinter,
  IconTargetArrow,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  ChronicProgram,
  ChronicEnrollmentRow,
  CreateChronicProgramRequest,
  CreateChronicEnrollmentRequest,
  AdherenceSummaryResponse,
  DrugTimelineWithLabsResponse,
  MedicationTimelineEvent,
  TreatmentSummaryResponse,
  OutcomeDashboardResponse,
  OutcomeTargetWithActual,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";
import type { Column } from "../components/DataTable";

// ── Constants ──────────────────────────────────────────

const PROGRAM_TYPES = [
  { value: "tb_dots", label: "TB DOTS" },
  { value: "hiv_art", label: "HIV/ART" },
  { value: "diabetes", label: "Diabetes" },
  { value: "hypertension", label: "Hypertension" },
  { value: "ckd", label: "Chronic Kidney Disease" },
  { value: "copd", label: "COPD" },
  { value: "asthma", label: "Asthma" },
  { value: "cancer_chemo", label: "Cancer/Chemotherapy" },
  { value: "mental_health", label: "Mental Health" },
  { value: "epilepsy", label: "Epilepsy" },
  { value: "thyroid", label: "Thyroid" },
  { value: "rheumatic", label: "Rheumatic" },
  { value: "other", label: "Other" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "success",
  completed: "teal",
  discontinued: "orange",
  transferred: "primary",
  lost_to_followup: "danger",
  deceased: "dark",
};

const EVENT_COLORS: Record<string, string> = {
  started: "success",
  dose_changed: "primary",
  switched: "violet",
  discontinued: "danger",
  resumed: "teal",
  held: "orange",
};

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function ChronicCarePage() {
  useRequirePermission(P.CHRONIC.ENROLLMENTS_LIST);

  const canCreateProgram = useHasPermission(P.CHRONIC.PROGRAMS_CREATE);
  const canCreateEnrollment = useHasPermission(P.CHRONIC.ENROLLMENTS_CREATE);
  const canViewAdherence = useHasPermission(P.CHRONIC.ADHERENCE_LIST);
  const canViewOutcomes = useHasPermission(P.CHRONIC.OUTCOMES_VIEW);
  const canViewTimeline = useHasPermission(P.CHRONIC.TIMELINE_VIEW);

  return (
    <div>
      <PageHeader title="Chronic Care" subtitle="Disease management programs, enrollment tracking, and outcomes" />
      <Tabs defaultValue="enrollments">
        <Tabs.List>
          <Tabs.Tab value="programs" leftSection={<IconReportMedical size={14} />}>
            Programs
          </Tabs.Tab>
          <Tabs.Tab value="enrollments" leftSection={<IconUsers size={14} />}>
            Enrollments
          </Tabs.Tab>
          {canViewAdherence && (
            <Tabs.Tab value="adherence" leftSection={<IconHeartRateMonitor size={14} />}>
              Adherence
            </Tabs.Tab>
          )}
          {canViewOutcomes && (
            <Tabs.Tab value="outcomes" leftSection={<IconTargetArrow size={14} />}>
              Outcomes
            </Tabs.Tab>
          )}
          {canViewTimeline && (
            <Tabs.Tab value="drugogram" leftSection={<IconTimeline size={14} />}>
              Drug-o-gram
            </Tabs.Tab>
          )}
          {canViewTimeline && (
            <Tabs.Tab value="treatment-summary" leftSection={<IconFileText size={14} />}>
              Treatment Summary
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="programs" pt="md">
          <ProgramsTab canCreate={canCreateProgram} />
        </Tabs.Panel>
        <Tabs.Panel value="enrollments" pt="md">
          <EnrollmentsTab canCreate={canCreateEnrollment} />
        </Tabs.Panel>
        {canViewAdherence && (
          <Tabs.Panel value="adherence" pt="md">
            <AdherenceTab />
          </Tabs.Panel>
        )}
        {canViewOutcomes && (
          <Tabs.Panel value="outcomes" pt="md">
            <OutcomesTab />
          </Tabs.Panel>
        )}
        {canViewTimeline && (
          <Tabs.Panel value="drugogram" pt="md">
            <DrugOgramTab />
          </Tabs.Panel>
        )}
        {canViewTimeline && (
          <Tabs.Panel value="treatment-summary" pt="md">
            <TreatmentSummaryTab />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Programs Tab
// ══════════════════════════════════════════════════════════

function ProgramsTab({ canCreate }: { canCreate: boolean }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<ChronicProgram | null>(null);
  const qc = useQueryClient();

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ["chronic-programs", typeFilter, search],
    queryFn: () =>
      api.listChronicPrograms({
        program_type: typeFilter ?? undefined,
        search: search || undefined,
      }),
  });

  const createMut = useMutation({
    mutationFn: (data: CreateChronicProgramRequest) => api.createChronicProgram(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["chronic-programs"] });
      close();
      setEditing(null);
      notifications.show({ title: "Program saved", message: "Chronic program created", color: "success" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteChronicProgram(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["chronic-programs"] });
      notifications.show({ title: "Deleted", message: "Program removed", color: "orange" });
    },
  });

  const columns: Column<ChronicProgram>[] = [
    { key: "name", label: "Program Name", render: (r) => <Text fw={500}>{r.name}</Text> },
    { key: "code", label: "Code", render: (r) => <Text size="sm">{r.code}</Text> },
    {
      key: "program_type",
      label: "Type",
      render: (r) => (
        <Badge variant="light">{PROGRAM_TYPES.find((t) => t.value === r.program_type)?.label ?? r.program_type}</Badge>
      ),
    },
    {
      key: "duration",
      label: "Duration",
      render: (r) => <Text size="sm">{r.default_duration_months ? `${r.default_duration_months} months` : "—"}</Text>,
    },
    {
      key: "is_active",
      label: "Status",
      render: (r) => <Badge color={r.is_active ? "success" : "slate"}>{r.is_active ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canCreate ? (
          <Group gap={4}>
            <Tooltip label="Edit">
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => {
                  setEditing(r);
                  open();
                }}
                aria-label="Edit"
              >
                <IconPencil size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Delete">
              <ActionIcon variant="subtle" size="sm" color="danger" onClick={() => deleteMut.mutate(r.id)} aria-label="Delete">
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : null,
    },
  ];

  return (
    <Stack gap="md">
      <Group>
        <TextInput
          placeholder="Search programs..."
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="Program type"
          data={PROGRAM_TYPES}
          value={typeFilter}
          onChange={setTypeFilter}
          clearable
          w={200}
        />
        {canCreate && (
          <Button
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setEditing(null);
              open();
            }}
          >
            New Program
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={programs} loading={isLoading} rowKey={(r) => r.id} />

      <ProgramDrawer
        key={editing?.id ?? "new"}
        opened={opened}
        onClose={() => {
          close();
          setEditing(null);
        }}
        editing={editing}
        onSave={(data) => {
          if (editing) {
            api.updateChronicProgram(editing.id, data).then(() => {
              void qc.invalidateQueries({ queryKey: ["chronic-programs"] });
              close();
              setEditing(null);
            });
          } else {
            createMut.mutate(data as CreateChronicProgramRequest);
          }
        }}
        loading={createMut.isPending}
      />
    </Stack>
  );
}

function ProgramDrawer({
  opened,
  onClose,
  editing,
  onSave,
  loading,
}: {
  opened: boolean;
  onClose: () => void;
  editing: ChronicProgram | null;
  onSave: (data: Partial<CreateChronicProgramRequest>) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [code, setCode] = useState(editing?.code ?? "");
  const [programType, setProgramType] = useState<string | null>(editing?.program_type ?? null);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [duration, setDuration] = useState<number | string>(editing?.default_duration_months ?? "");

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={editing ? "Edit Program" : "New Program"}
      position="right"
      size="md"
    >
      <Stack gap="sm">
        <TextInput label="Program Name" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TextInput label="Code" required value={code} onChange={(e) => setCode(e.currentTarget.value)} disabled={!!editing} />
        <Select label="Program Type" required data={PROGRAM_TYPES} value={programType} onChange={setProgramType} />
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
        <NumberInput label="Default Duration (months)" value={duration} onChange={setDuration} min={1} />
        <Button
          onClick={() =>
            onSave({
              name,
              code,
              program_type: programType as CreateChronicProgramRequest["program_type"],
              description: description || undefined,
              default_duration_months: typeof duration === "number" ? duration : undefined,
            })
          }
          loading={loading}
        >
          {editing ? "Update" : "Create"}
        </Button>
      </Stack>
    </Drawer>
  );
}

// ══════════════════════════════════════════════════════════
//  Enrollments Tab
// ══════════════════════════════════════════════════════════

function EnrollmentsTab({ canCreate }: { canCreate: boolean }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const qc = useQueryClient();

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["chronic-enrollments", typeFilter, statusFilter, search],
    queryFn: () =>
      api.listChronicEnrollments({
        program_type: typeFilter ?? undefined,
        status: statusFilter ?? undefined,
        search: search || undefined,
      }),
  });

  const columns: Column<ChronicEnrollmentRow>[] = [
    {
      key: "patient",
      label: "Patient",
      render: (r) => (
        <div>
          <Text fw={500} size="sm">{r.patient_name}</Text>
          <Text size="xs" c="dimmed">{r.uhid}</Text>
        </div>
      ),
    },
    { key: "program_name", label: "Program", render: (r) => <Text size="sm">{r.program_name}</Text> },
    {
      key: "program_type",
      label: "Type",
      render: (r) => (
        <Badge variant="light" size="sm">
          {PROGRAM_TYPES.find((t) => t.value === r.program_type)?.label ?? r.program_type}
        </Badge>
      ),
    },
    { key: "enrollment_date", label: "Enrolled", render: (r) => <Text size="sm">{r.enrollment_date}</Text> },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge color={STATUS_COLORS[r.status] ?? "slate"}>{r.status.replace(/_/g, " ")}</Badge>,
    },
    {
      key: "doctor",
      label: "Doctor",
      render: (r) => <Text size="sm">{r.primary_doctor_name ?? "—"}</Text>,
    },
    {
      key: "icd",
      label: "ICD",
      render: (r) => <Text size="xs" c="dimmed">{r.icd_code ?? "—"}</Text>,
    },
  ];

  return (
    <Stack gap="md">
      <Group>
        <TextInput
          placeholder="Search patients..."
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="Program type"
          data={PROGRAM_TYPES}
          value={typeFilter}
          onChange={setTypeFilter}
          clearable
          w={180}
        />
        <Select
          placeholder="Status"
          data={[
            { value: "active", label: "Active" },
            { value: "completed", label: "Completed" },
            { value: "discontinued", label: "Discontinued" },
            { value: "transferred", label: "Transferred" },
            { value: "lost_to_followup", label: "Lost to Follow-up" },
            { value: "deceased", label: "Deceased" },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
          clearable
          w={180}
        />
        {canCreate && (
          <Button leftSection={<IconPlus size={14} />} onClick={open}>
            Enroll Patient
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={enrollments} loading={isLoading} rowKey={(r) => r.id} />

      <EnrollDrawer opened={opened} onClose={close} qc={qc} />
    </Stack>
  );
}

function EnrollDrawer({
  opened,
  onClose,
  qc,
}: {
  opened: boolean;
  onClose: () => void;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [patientId, setPatientId] = useState("");
  const [programId, setProgramId] = useState<string | null>(null);
  const [icdCode, setIcdCode] = useState("");
  const [notes, setNotes] = useState("");
  const [enrollDate, setEnrollDate] = useState<string | null>(null);

  const { data: programs = [] } = useQuery({
    queryKey: ["chronic-programs-active"],
    queryFn: () => api.listChronicPrograms({ is_active: true }),
  });

  const createMut = useMutation({
    mutationFn: (data: CreateChronicEnrollmentRequest) => api.createEnrollment(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["chronic-enrollments"] });
      onClose();
      notifications.show({ title: "Enrolled", message: "Patient enrolled in program", color: "success" });
    },
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="Enroll Patient" position="right" size="md">
      <Stack gap="sm">
        <PatientSearchSelect value={patientId} onChange={setPatientId} required />
        <Select
          label="Program"
          required
          data={programs.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
          value={programId}
          onChange={setProgramId}
          searchable
        />
        <TextInput label="ICD Code" value={icdCode} onChange={(e) => setIcdCode(e.currentTarget.value)} />
        <DateInput label="Enrollment Date" value={enrollDate} onChange={setEnrollDate} />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Button
          onClick={() =>
            createMut.mutate({
              patient_id: patientId,
              program_id: programId ?? "",
              icd_code: icdCode || undefined,
              enrollment_date: enrollDate ?? undefined,
              notes: notes || undefined,
            })
          }
          loading={createMut.isPending}
        >
          Enroll
        </Button>
      </Stack>
    </Drawer>
  );
}

// ══════════════════════════════════════════════════════════
//  Adherence Tab
// ══════════════════════════════════════════════════════════

function AdherenceTab() {
  const { data: enrollments = [] } = useQuery({
    queryKey: ["chronic-enrollments-active"],
    queryFn: () => api.listChronicEnrollments({ status: "active" }),
  });

  const [selectedEnrollment, setSelectedEnrollment] = useState<string | null>(null);

  const { data: summary } = useQuery({
    queryKey: ["adherence-summary", selectedEnrollment],
    queryFn: () => api.adherenceSummary(selectedEnrollment ?? ""),
    enabled: !!selectedEnrollment,
  });

  return (
    <Stack gap="md">
      <Select
        label="Select Enrollment"
        placeholder="Choose an active enrollment"
        data={enrollments.map((e) => ({
          value: e.id,
          label: `${e.patient_name} — ${e.program_name} (${e.uhid})`,
        }))}
        value={selectedEnrollment}
        onChange={setSelectedEnrollment}
        searchable
      />

      {summary && <AdherenceSummaryCards summary={summary} />}
    </Stack>
  );
}

function AdherenceSummaryCards({ summary }: { summary: AdherenceSummaryResponse }) {
  const totalDoses = summary.doses_taken + summary.doses_missed + summary.doses_late;

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">Dose Adherence</Text>
          <Text fw={700} size="xl">
            {totalDoses > 0 ? `${Math.round(Number(summary.dose_adherence_pct))}%` : "N/A"}
          </Text>
          <Progress
            value={totalDoses > 0 ? Number(summary.dose_adherence_pct) : 0}
            color={Number(summary.dose_adherence_pct) >= 80 ? "success" : "danger"}
            mt="xs"
          />
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">Doses</Text>
          <Group gap="xs" mt="xs">
            <Badge color="success" variant="light">{summary.doses_taken} taken</Badge>
            <Badge color="danger" variant="light">{summary.doses_missed} missed</Badge>
            <Badge color="warning" variant="light">{summary.doses_late} late</Badge>
          </Group>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">Refills</Text>
          <Group gap="xs" mt="xs">
            <Badge color="success" variant="light">{summary.refills_on_time} on time</Badge>
            <Badge color="orange" variant="light">{summary.refills_late} late</Badge>
            <Badge color="danger" variant="light">{summary.refills_missed} missed</Badge>
          </Group>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">Appointments</Text>
          <Group gap="xs" mt="xs">
            <Badge color="success" variant="light">{summary.appointments_attended} attended</Badge>
            <Badge color="danger" variant="light">{summary.appointments_missed} missed</Badge>
          </Group>
        </Card>
      </SimpleGrid>

      {summary.by_month.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="sm">Monthly Dose Adherence</Text>
          {summary.by_month.map((m) => {
            const total = m.taken + m.missed + m.late;
            const pct = total > 0 ? Math.round((m.taken / total) * 100) : 0;
            return (
              <Group key={m.month} mb="xs">
                <Text size="sm" w={80}>{m.month}</Text>
                <Progress value={pct} color={pct >= 80 ? "success" : "danger"} style={{ flex: 1 }} />
                <Text size="sm" w={40}>{pct}%</Text>
              </Group>
            );
          })}
        </Card>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Outcomes Tab (Enhanced)
// ══════════════════════════════════════════════════════════

function OutcomesTab() {
  const { data: enrollments = [] } = useQuery({
    queryKey: ["chronic-enrollments-active-outcomes"],
    queryFn: () => api.listChronicEnrollments({ status: "active" }),
  });

  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const { data: dashboard } = useQuery({
    queryKey: ["outcome-dashboard", selectedPatient],
    queryFn: () => api.outcomeDashboard(selectedPatient ?? ""),
    enabled: !!selectedPatient,
  });

  const totalEnrolled = enrollments.length;
  const byType = enrollments.reduce<Record<string, number>>((acc, e) => {
    acc[e.program_type] = (acc[e.program_type] ?? 0) + 1;
    return acc;
  }, {});

  const patientOptions = useMemo(() => {
    const seen = new Set<string>();
    return enrollments
      .filter((e) => {
        if (seen.has(e.patient_id)) return false;
        seen.add(e.patient_id);
        return true;
      })
      .map((e) => ({ value: e.patient_id, label: `${e.patient_name} (${e.uhid})` }));
  }, [enrollments]);

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">Total Active Enrollments</Text>
          <Text fw={700} size="xl">{totalEnrolled}</Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">Programs with Enrollments</Text>
          <Text fw={700} size="xl">{Object.keys(byType).length}</Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">Breakdown by Type</Text>
          <Stack gap={4} mt="xs">
            {Object.entries(byType).map(([type, count]) => (
              <Group key={type} justify="space-between">
                <Text size="sm">{PROGRAM_TYPES.find((t) => t.value === type)?.label ?? type}</Text>
                <Badge variant="light">{count}</Badge>
              </Group>
            ))}
          </Stack>
        </Card>
      </SimpleGrid>

      <Select
        label="Patient Outcome Detail"
        placeholder="Select a patient to view targets"
        data={patientOptions}
        value={selectedPatient}
        onChange={setSelectedPatient}
        searchable
      />

      {dashboard && <OutcomeDetailCards dashboard={dashboard} />}
    </Stack>
  );
}

function TrendArrow({ atTarget }: { atTarget: boolean | null }) {
  if (atTarget === null) return <IconMinus size={14} color="slate" />;
  return atTarget ? <IconArrowUp size={14} color="success" /> : <IconArrowDown size={14} color="danger" />;
}

function OutcomeDetailCards({ dashboard }: { dashboard: OutcomeDashboardResponse }) {
  return (
    <Stack gap="md">
      {dashboard.adherence_rate !== null && (
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">Overall Adherence</Text>
          <Progress value={dashboard.adherence_rate} color={dashboard.adherence_rate >= 80 ? "success" : "danger"} mt="xs" />
          <Text size="sm" mt={4}>{Math.round(dashboard.adherence_rate)}%</Text>
        </Card>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
        {dashboard.targets.map((t: OutcomeTargetWithActual) => (
          <Card key={t.target.id} withBorder padding="md">
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>{t.target.parameter_name}</Text>
              <TrendArrow atTarget={t.at_target} />
            </Group>
            <Group gap="xs">
              <Text size="xs" c="dimmed">Target: {t.target.comparison} {t.target.target_value} {t.target.unit}</Text>
            </Group>
            <Group gap="xs" mt={4}>
              <Text size="sm">Actual: {t.latest_value !== null ? `${t.latest_value} ${t.target.unit}` : "—"}</Text>
              <Badge color={t.at_target ? "success" : t.at_target === false ? "danger" : "slate"} size="xs">
                {t.at_target ? "At target" : t.at_target === false ? "Off target" : "No data"}
              </Badge>
            </Group>
            {t.latest_date && <Text size="xs" c="dimmed" mt={4}>Last: {new Date(t.latest_date).toLocaleDateString()}</Text>}
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Drug-o-gram Tab (NEW)
// ══════════════════════════════════════════════════════════

function DrugOgramTab() {
  const { data: enrollments = [] } = useQuery({
    queryKey: ["chronic-enrollments-all-drugogram"],
    queryFn: () => api.listChronicEnrollments({ status: "active" }),
  });

  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const { data: timeline, isLoading } = useQuery({
    queryKey: ["drug-timeline-labs", selectedPatient],
    queryFn: () => api.drugTimelineWithLabs(selectedPatient ?? ""),
    enabled: !!selectedPatient,
  });

  const patientOptions = useMemo(() => {
    const seen = new Set<string>();
    return enrollments
      .filter((e) => {
        if (seen.has(e.patient_id)) return false;
        seen.add(e.patient_id);
        return true;
      })
      .map((e) => ({ value: e.patient_id, label: `${e.patient_name} (${e.uhid})` }));
  }, [enrollments]);

  return (
    <Stack gap="md">
      <Select
        label="Select Patient"
        placeholder="Choose an enrolled patient"
        data={patientOptions}
        value={selectedPatient}
        onChange={setSelectedPatient}
        searchable
      />

      {isLoading && <Text c="dimmed">Loading timeline...</Text>}
      {timeline && <DrugOgramView data={timeline} />}
    </Stack>
  );
}

function DrugOgramView({ data }: { data: DrugTimelineWithLabsResponse }) {
  // Group medication events by drug
  const drugGroups = useMemo(() => {
    const groups: Record<string, MedicationTimelineEvent[]> = {};
    for (const ev of data.medication_events) {
      const key = ev.drug_name;
      if (!groups[key]) groups[key] = [];
      groups[key].push(ev);
    }
    return Object.entries(groups);
  }, [data.medication_events]);

  // Lab chart data
  const labCharts = useMemo(() => {
    return data.lab_series
      .filter((s) => s.data_points.length > 0)
      .map((series) => ({
        name: series.parameter_name,
        unit: series.unit,
        targetValue: series.target_value,
        data: series.data_points.map((p) => ({
          date: new Date(p.result_date).toLocaleDateString(),
          value: p.numeric_value ?? 0,
        })),
      }));
  }, [data.lab_series]);

  // Vitals chart data (group by parameter)
  const vitalGroups = useMemo(() => {
    const groups: Record<string, { date: string; value: number }[]> = {};
    for (const v of data.vitals_series) {
      if (v.numeric_value === null) continue;
      const arr = groups[v.parameter] ?? (groups[v.parameter] = []);
      arr.push({
        date: new Date(v.recorded_at).toLocaleDateString(),
        value: v.numeric_value,
      });
    }
    return Object.entries(groups);
  }, [data.vitals_series]);

  return (
    <Stack gap="lg">
      {/* Active Drugs Legend */}
      {data.active_drugs.length > 0 && (
        <Card withBorder padding="sm">
          <Text fw={500} size="sm" mb="xs">Active Medications</Text>
          <Group gap="xs">
            {data.active_drugs.map((d) => (
              <Badge key={d.drug_name} variant="light" color="primary" size="sm">
                {d.drug_name} {d.dosage ? `(${d.dosage})` : ""}
              </Badge>
            ))}
          </Group>
        </Card>
      )}

      {/* Medication Timeline */}
      {drugGroups.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="sm">Medication Timeline</Text>
          <Stack gap="sm">
            {drugGroups.map(([drugName, events]) => (
              <Paper key={drugName} withBorder p="xs">
                <Text size="sm" fw={500} mb={4}>{drugName}</Text>
                <Group gap={4} wrap="wrap">
                  {events.map((ev) => (
                    <Tooltip
                      key={ev.id}
                      label={`${ev.event_type}: ${ev.dosage ?? ""} ${ev.frequency ?? ""} (${new Date(ev.effective_date).toLocaleDateString()})${ev.change_reason ? ` — ${ev.change_reason}` : ""}`}
                    >
                      <Badge
                        variant="filled"
                        color={EVENT_COLORS[ev.event_type] ?? "slate"}
                        size="xs"
                        style={{ cursor: "pointer" }}
                      >
                        {ev.event_type} {new Date(ev.effective_date).toLocaleDateString()}
                      </Badge>
                    </Tooltip>
                  ))}
                </Group>
              </Paper>
            ))}
          </Stack>
        </Card>
      )}

      {/* Lab Overlay Charts */}
      {labCharts.map((chart) => (
        <Card key={chart.name} withBorder padding="md">
          <Text fw={500} size="sm" mb="xs">
            {chart.name} {chart.unit ? `(${chart.unit})` : ""}
            {chart.targetValue !== null && (
              <Text span c="dimmed" size="xs"> — Target: {chart.targetValue}</Text>
            )}
          </Text>
          <LineChart
            h={180}
            data={chart.data}
            dataKey="date"
            series={[{ name: "value", color: "primary" }]}
            curveType="monotone"
            referenceLines={chart.targetValue !== null ? [{ y: chart.targetValue, color: "red.5", label: "Target" }] : undefined}
          />
        </Card>
      ))}

      {/* Vitals Mini Charts */}
      {vitalGroups.map(([param, points]) => (
        <Card key={param} withBorder padding="md">
          <Text fw={500} size="sm" mb="xs">{param}</Text>
          <LineChart
            h={150}
            data={points}
            dataKey="date"
            series={[{ name: "value", color: "teal" }]}
            curveType="monotone"
          />
        </Card>
      ))}

      {drugGroups.length === 0 && data.lab_series.length === 0 && (
        <Text c="dimmed" ta="center">No timeline data available for this patient.</Text>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Treatment Summary Tab (NEW)
// ══════════════════════════════════════════════════════════

function TreatmentSummaryTab() {
  const { data: enrollments = [] } = useQuery({
    queryKey: ["chronic-enrollments-all-summary"],
    queryFn: () => api.listChronicEnrollments({ status: "active" }),
  });

  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const { data: summary, isLoading } = useQuery({
    queryKey: ["treatment-summary", selectedPatient],
    queryFn: () => api.treatmentSummary(selectedPatient ?? ""),
    enabled: !!selectedPatient,
  });

  const patientOptions = useMemo(() => {
    const seen = new Set<string>();
    return enrollments
      .filter((e) => {
        if (seen.has(e.patient_id)) return false;
        seen.add(e.patient_id);
        return true;
      })
      .map((e) => ({ value: e.patient_id, label: `${e.patient_name} (${e.uhid})` }));
  }, [enrollments]);

  return (
    <Stack gap="md">
      <Group>
        <Select
          label="Select Patient"
          placeholder="Choose a patient"
          data={patientOptions}
          value={selectedPatient}
          onChange={setSelectedPatient}
          searchable
          style={{ flex: 1 }}
        />
        {summary && (
          <Button
            leftSection={<IconPrinter size={14} />}
            variant="light"
            mt={24}
            onClick={() => window.print()}
          >
            Print Summary
          </Button>
        )}
      </Group>

      {isLoading && <Text c="dimmed">Loading summary...</Text>}
      {summary && <TreatmentSummaryView summary={summary} />}
    </Stack>
  );
}

function TreatmentSummaryView({ summary }: { summary: TreatmentSummaryResponse }) {
  return (
    <Stack gap="md" className="print-area">
      {/* Patient Demographics */}
      <Card withBorder padding="md">
        <Text fw={600} size="lg">{summary.patient_name}</Text>
        <Group gap="md" mt={4}>
          <Text size="sm" c="dimmed">UHID: {summary.uhid}</Text>
          {summary.date_of_birth && <Text size="sm" c="dimmed">DOB: {summary.date_of_birth}</Text>}
          {summary.gender && <Text size="sm" c="dimmed">Gender: {summary.gender}</Text>}
        </Group>
      </Card>

      {/* Active Diagnoses */}
      {summary.active_diagnoses.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="xs">Active Diagnoses</Text>
          <Stack gap={4}>
            {summary.active_diagnoses.map((d, i) => (
              <Group key={i} gap="xs">
                <Text size="sm">{d.diagnosis_name}</Text>
                {d.icd_code && <Badge variant="light" size="xs">{d.icd_code}</Badge>}
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      {/* Current Medications */}
      {summary.current_medications.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="xs">Current Medications</Text>
          <Stack gap={4}>
            {summary.current_medications.map((m) => (
              <Group key={m.drug_name} gap="xs">
                <Text size="sm" fw={500}>{m.drug_name}</Text>
                {m.generic_name && <Text size="xs" c="dimmed">({m.generic_name})</Text>}
                <Text size="sm">{m.dosage} {m.frequency} {m.route}</Text>
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      {/* Outcome Targets */}
      {summary.targets.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="xs">Outcome Targets</Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            {summary.targets.map((t) => (
              <Paper key={t.target.id} withBorder p="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>{t.target.parameter_name}</Text>
                  <Badge
                    color={t.at_target ? "success" : t.at_target === false ? "danger" : "slate"}
                    size="xs"
                  >
                    {t.at_target ? "At target" : t.at_target === false ? "Off target" : "No data"}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Target: {t.target.comparison} {t.target.target_value} {t.target.unit}
                  {t.latest_value !== null && ` | Actual: ${t.latest_value}`}
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
        </Card>
      )}

      {/* Lab Trend Sparklines */}
      {summary.lab_trends.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="xs">Lab Trends</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {summary.lab_trends.filter((s) => s.data_points.length > 0).map((series) => (
              <Paper key={series.parameter_name} withBorder p="xs">
                <Text size="sm" fw={500} mb={4}>
                  {series.parameter_name} {series.unit ? `(${series.unit})` : ""}
                </Text>
                <LineChart
                  h={100}
                  data={series.data_points.map((p) => ({
                    date: new Date(p.result_date).toLocaleDateString(),
                    value: p.numeric_value ?? 0,
                  }))}
                  dataKey="date"
                  series={[{ name: "value", color: "primary" }]}
                  curveType="monotone"
                  withDots={false}
                  referenceLines={
                    series.target_value !== null
                      ? [{ y: series.target_value, color: "red.5", label: "Target" }]
                      : undefined
                  }
                />
              </Paper>
            ))}
          </SimpleGrid>
        </Card>
      )}

      {/* Adherence Rate */}
      {summary.adherence_rate !== null && (
        <Card withBorder padding="md">
          <Text fw={500} mb="xs">Overall Adherence Rate</Text>
          <Progress
            value={summary.adherence_rate}
            color={summary.adherence_rate >= 80 ? "success" : "danger"}
            size="lg"
          />
          <Text size="sm" mt={4}>{Math.round(summary.adherence_rate)}%</Text>
        </Card>
      )}

      {/* Enrollment History */}
      {summary.enrollments.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="xs">Enrollment History</Text>
          <Stack gap={4}>
            {summary.enrollments.map((e, i) => (
              <Group key={i} gap="xs">
                <Text size="sm">{e.program_name}</Text>
                <Text size="xs" c="dimmed">Enrolled: {e.enrollment_date}</Text>
                <Badge color={STATUS_COLORS[e.status] ?? "slate"} size="xs">
                  {e.status.replace(/_/g, " ")}
                </Badge>
              </Group>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
