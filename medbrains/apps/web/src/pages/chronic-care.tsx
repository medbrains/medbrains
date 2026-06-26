import { zodResolver } from "@hookform/resolvers/zod";
import { confirmDestructive } from "@/lib/confirm";
import "@mantine/charts/styles.css";
import { LineChart } from "@mantine/charts";
import {
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
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  ChronicEnrollmentFormInput,
  ChronicProgramFormInput,
  ChronicProgramTypeFormValue,
} from "@medbrains/schemas";
import {
  chronicEnrollmentFormSchema,
  chronicProgramFormSchema,
  toChronicProgramTypeFormValue,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AdherenceSummaryResponse,
  ChronicEnrollmentRow,
  ChronicProgram,
  CreateChronicEnrollmentRequest,
  CreateChronicProgramRequest,
  DrugTimelineWithLabsResponse,
  MedicationTimelineEvent,
  OutcomeDashboardResponse,
  OutcomeTargetWithActual,
  TreatmentSummaryResponse,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconArrowDown,
  IconArrowUp,
  IconFileText,
  IconHeartRateMonitor,
  IconMinus,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconReportMedical,
  IconTargetArrow,
  IconTimeline,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import { Icd11CodeSelect } from "@/components/Clinical/Icd11CodeSelect";
import type { Column } from "@/components/DataTable";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { chronicCareService } from "@/services/chronicCare.service";

// ── Constants ──────────────────────────────────────────

const PROGRAM_TYPES: Array<{ value: ChronicProgramTypeFormValue; label: string }> = [
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

const STATUS_COLORS: Record<string, BadgeTone> = {
  active: "success",
  completed: "success",
  discontinued: "warning",
  transferred: "primary",
  lost_to_followup: "danger",
  deceased: "neutral",
};

const EVENT_COLORS: Record<string, BadgeTone> = {
  started: "success",
  dose_changed: "primary",
  switched: "accent",
  discontinued: "danger",
  resumed: "success",
  held: "warning",
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
      <PageHeader
        title="Chronic Care"
        subtitle="Disease management programs, enrollment tracking, and outcomes"
      />
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
      chronicCareService.listChronicPrograms({
        program_type: typeFilter ?? undefined,
        search: search || undefined,
      }),
  });

  const createMut = useMutation({
    mutationFn: (data: CreateChronicProgramRequest) =>
      chronicCareService.createChronicProgram(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["chronic-programs"] });
      close();
      setEditing(null);
      notifications.show({
        title: "Program saved",
        message: "Chronic program created",
        color: "success",
      });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => chronicCareService.deleteChronicProgram(id),
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
        <Badge tone="neutral" variant="light">
          {PROGRAM_TYPES.find((t) => t.value === r.program_type)?.label ?? r.program_type}
        </Badge>
      ),
    },
    {
      key: "duration",
      label: "Duration",
      render: (r) => (
        <Text size="sm">
          {r.default_duration_months ? `${r.default_duration_months} months` : "—"}
        </Text>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (r) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>
          {r.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canCreate ? (
          <Group gap={4}>
            <Tooltip label="Edit">
              <IconButton
                size="sm"
                onClick={() => {
                  setEditing(r);
                  open();
                }}
                aria-label="Edit"
              >
                <IconPencil size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip label="Delete">
              <IconButton
                tone="danger"
                size="sm"
                onClick={() =>
                  confirmDestructive({
                    title: "Delete",
                    message: "Permanently delete this record? This cannot be undone.",
                    onConfirm: () => deleteMut.mutate(r.id),
                  })
                }
                aria-label="Delete"
              >
                <IconTrash size={14} />
              </IconButton>
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
            tone="primary"
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
            chronicCareService.updateChronicProgram(editing.id, data).then(() => {
              void qc.invalidateQueries({ queryKey: ["chronic-programs"] });
              close();
              setEditing(null);
            });
          } else {
            createMut.mutate(data);
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
  onSave: (data: CreateChronicProgramRequest) => void;
  loading: boolean;
}) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChronicProgramFormInput>({
    resolver: zodResolver(chronicProgramFormSchema),
    defaultValues: {
      name: editing?.name ?? "",
      code: editing?.code ?? "",
      program_type: editing?.program_type ?? "other",
      description: editing?.description ?? "",
      default_duration_months: editing?.default_duration_months ?? "",
    },
    mode: "onTouched",
  });
  const closeAndReset = () => {
    reset();
    onClose();
  };
  const submitProgram = handleSubmit((values) => {
    const defaultDuration =
      values.default_duration_months === "" ? undefined : Number(values.default_duration_months);
    onSave({
      name: values.name.trim(),
      code: values.code.trim(),
      program_type: values.program_type,
      description: values.description || undefined,
      default_duration_months: Number.isFinite(defaultDuration) ? defaultDuration : undefined,
    });
  });

  return (
    <Drawer
      opened={opened}
      onClose={closeAndReset}
      title={editing ? "Edit Program" : "New Program"}
      position="right"
      size="md"
    >
      <Stack gap="sm">
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextInput
              label="Program Name"
              required
              value={field.value}
              onChange={field.onChange}
              error={errors.name?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <TextInput
              label="Code"
              required
              value={field.value}
              onChange={field.onChange}
              error={errors.code?.message}
              disabled={!!editing}
            />
          )}
        />
        <Controller
          control={control}
          name="program_type"
          render={({ field }) => (
            <Select
              label="Program Type"
              required
              data={PROGRAM_TYPES}
              value={field.value}
              onChange={(value) => field.onChange(toChronicProgramTypeFormValue(value))}
            />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <Textarea label="Description" value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="default_duration_months"
          render={({ field }) => (
            <NumberInput
              label="Default Duration (months)"
              value={field.value}
              onChange={field.onChange}
              min={1}
            />
          )}
        />
        <Button tone="primary" onClick={() => void submitProgram()} loading={loading}>
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
      chronicCareService.listChronicEnrollments({
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
          <Text fw={500} size="sm">
            {r.patient_name}
          </Text>
          <Text size="xs" c="dimmed">
            {r.uhid}
          </Text>
        </div>
      ),
    },
    {
      key: "program_name",
      label: "Program",
      render: (r) => <Text size="sm">{r.program_name}</Text>,
    },
    {
      key: "program_type",
      label: "Type",
      render: (r) => (
        <Badge tone="neutral" variant="light" size="sm">
          {PROGRAM_TYPES.find((t) => t.value === r.program_type)?.label ?? r.program_type}
        </Badge>
      ),
    },
    {
      key: "enrollment_date",
      label: "Enrolled",
      render: (r) => <Text size="sm">{r.enrollment_date}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={STATUS_COLORS[r.status] ?? "neutral"}>{r.status.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "doctor",
      label: "Doctor",
      render: (r) => <Text size="sm">{r.primary_doctor_name ?? "—"}</Text>,
    },
    {
      key: "icd",
      label: "ICD",
      render: (r) => (
        <Text size="xs" c="dimmed">
          {r.icd_code ?? "—"}
        </Text>
      ),
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
          <Button tone="primary" leftSection={<IconPlus size={14} />} onClick={open}>
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
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChronicEnrollmentFormInput>({
    resolver: zodResolver(chronicEnrollmentFormSchema),
    defaultValues: {
      patient_id: "",
      program_id: "",
      icd_code: "",
      enrollment_date: undefined,
      notes: "",
    },
    mode: "onTouched",
  });
  const closeAndReset = () => {
    reset();
    onClose();
  };

  const { data: programs = [] } = useQuery({
    queryKey: ["chronic-programs-active"],
    queryFn: () => chronicCareService.listChronicPrograms({ is_active: true }),
  });

  const createMut = useMutation({
    mutationFn: (data: CreateChronicEnrollmentRequest) => chronicCareService.createEnrollment(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["chronic-enrollments"] });
      closeAndReset();
      notifications.show({
        title: "Enrolled",
        message: "Patient enrolled in program",
        color: "success",
      });
    },
  });
  const submitEnrollment = handleSubmit((values) =>
    createMut.mutate({
      patient_id: values.patient_id,
      program_id: values.program_id,
      icd_code: values.icd_code || undefined,
      enrollment_date: values.enrollment_date || undefined,
      notes: values.notes || undefined,
    }),
  );

  return (
    <Drawer
      opened={opened}
      onClose={closeAndReset}
      title="Enroll Patient"
      position="right"
      size="xl"
    >
      <Stack gap="sm">
        <Controller
          control={control}
          name="patient_id"
          render={({ field }) => (
            <PatientSearchSelect
              value={field.value}
              onChange={field.onChange}
              error={errors.patient_id?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="program_id"
          render={({ field }) => (
            <Select
              label="Program"
              required
              data={programs.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
              value={field.value}
              onChange={(value) => field.onChange(value ?? "")}
              error={errors.program_id?.message}
              searchable
            />
          )}
        />
        <Controller
          control={control}
          name="icd_code"
          render={({ field }) => (
            <Icd11CodeSelect
              label="ICD-11 diagnosis"
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? "")}
            />
          )}
        />
        <Controller
          control={control}
          name="enrollment_date"
          render={({ field }) => (
            <DateInput
              label="Enrollment Date"
              value={field.value ?? null}
              onChange={(value) => field.onChange(value ?? undefined)}
            />
          )}
        />
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Textarea label="Notes" value={field.value ?? ""} onChange={field.onChange} />
          )}
        />
        <Button
          tone="primary"
          onClick={() => void submitEnrollment()}
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
    queryFn: () => chronicCareService.listChronicEnrollments({ status: "active" }),
  });

  const [selectedEnrollment, setSelectedEnrollment] = useState<string | null>(null);

  const { data: summary } = useQuery({
    queryKey: ["adherence-summary", selectedEnrollment],
    queryFn: () => chronicCareService.adherenceSummary(selectedEnrollment ?? ""),
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
          <Text size="xs" c="dimmed" tt="uppercase">
            Dose Adherence
          </Text>
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
          <Text size="xs" c="dimmed" tt="uppercase">
            Doses
          </Text>
          <Group gap="xs" mt="xs">
            <Badge tone="success" variant="light">
              {summary.doses_taken} taken
            </Badge>
            <Badge tone="danger" variant="light">
              {summary.doses_missed} missed
            </Badge>
            <Badge tone="warning" variant="light">
              {summary.doses_late} late
            </Badge>
          </Group>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Refills
          </Text>
          <Group gap="xs" mt="xs">
            <Badge tone="success" variant="light">
              {summary.refills_on_time} on time
            </Badge>
            <Badge tone="warning" variant="light">
              {summary.refills_late} late
            </Badge>
            <Badge tone="danger" variant="light">
              {summary.refills_missed} missed
            </Badge>
          </Group>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Appointments
          </Text>
          <Group gap="xs" mt="xs">
            <Badge tone="success" variant="light">
              {summary.appointments_attended} attended
            </Badge>
            <Badge tone="danger" variant="light">
              {summary.appointments_missed} missed
            </Badge>
          </Group>
        </Card>
      </SimpleGrid>

      {summary.by_month.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="sm">
            Monthly Dose Adherence
          </Text>
          {summary.by_month.map((m) => {
            const total = m.taken + m.missed + m.late;
            const pct = total > 0 ? Math.round((m.taken / total) * 100) : 0;
            return (
              <Group key={m.month} mb="xs">
                <Text size="sm" w={80}>
                  {m.month}
                </Text>
                <Progress
                  value={pct}
                  color={pct >= 80 ? "success" : "danger"}
                  style={{ flex: 1 }}
                />
                <Text size="sm" w={40}>
                  {pct}%
                </Text>
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
    queryFn: () => chronicCareService.listChronicEnrollments({ status: "active" }),
  });

  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const { data: dashboard } = useQuery({
    queryKey: ["outcome-dashboard", selectedPatient],
    queryFn: () => chronicCareService.outcomeDashboard(selectedPatient ?? ""),
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
          <Text size="xs" c="dimmed" tt="uppercase">
            Total Active Enrollments
          </Text>
          <Text fw={700} size="xl">
            {totalEnrolled}
          </Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Programs with Enrollments
          </Text>
          <Text fw={700} size="xl">
            {Object.keys(byType).length}
          </Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Breakdown by Type
          </Text>
          <Stack gap={4} mt="xs">
            {Object.entries(byType).map(([type, count]) => (
              <Group key={type} justify="space-between">
                <Text size="sm">{PROGRAM_TYPES.find((t) => t.value === type)?.label ?? type}</Text>
                <Badge tone="neutral" variant="light">
                  {count}
                </Badge>
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
  return atTarget ? (
    <IconArrowUp size={14} color="success" />
  ) : (
    <IconArrowDown size={14} color="danger" />
  );
}

function OutcomeDetailCards({ dashboard }: { dashboard: OutcomeDashboardResponse }) {
  return (
    <Stack gap="md">
      {dashboard.adherence_rate !== null && (
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Overall Adherence
          </Text>
          <Progress
            value={dashboard.adherence_rate}
            color={dashboard.adherence_rate >= 80 ? "success" : "danger"}
            mt="xs"
          />
          <Text size="sm" mt={4}>
            {Math.round(dashboard.adherence_rate)}%
          </Text>
        </Card>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
        {dashboard.targets.map((t: OutcomeTargetWithActual) => (
          <Card key={t.target.id} withBorder padding="md">
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>
                {t.target.parameter_name}
              </Text>
              <TrendArrow atTarget={t.at_target} />
            </Group>
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                Target: {t.target.comparison} {t.target.target_value} {t.target.unit}
              </Text>
            </Group>
            <Group gap="xs" mt={4}>
              <Text size="sm">
                Actual: {t.latest_value !== null ? `${t.latest_value} ${t.target.unit}` : "—"}
              </Text>
              <Badge
                tone={t.at_target ? "success" : t.at_target === false ? "danger" : "neutral"}
                size="xs"
              >
                {t.at_target ? "At target" : t.at_target === false ? "Off target" : "No data"}
              </Badge>
            </Group>
            {t.latest_date && (
              <Text size="xs" c="dimmed" mt={4}>
                Last: {new Date(t.latest_date).toLocaleDateString()}
              </Text>
            )}
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
    queryFn: () => chronicCareService.listChronicEnrollments({ status: "active" }),
  });

  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const { data: timeline, isLoading } = useQuery({
    queryKey: ["drug-timeline-labs", selectedPatient],
    queryFn: () => chronicCareService.drugTimelineWithLabs(selectedPatient ?? ""),
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
      if (!groups[v.parameter]) {
        groups[v.parameter] = [];
      }
      const arr = groups[v.parameter] ?? [];
      groups[v.parameter] = arr;
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
          <Text fw={500} size="sm" mb="xs">
            Active Medications
          </Text>
          <Group gap="xs">
            {data.active_drugs.map((d) => (
              <Badge key={d.drug_name} tone="primary" variant="light" size="sm">
                {d.drug_name} {d.dosage ? `(${d.dosage})` : ""}
              </Badge>
            ))}
          </Group>
        </Card>
      )}

      {/* Medication Timeline */}
      {drugGroups.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="sm">
            Medication Timeline
          </Text>
          <Stack gap="sm">
            {drugGroups.map(([drugName, events]) => (
              <Paper key={drugName} withBorder p="xs">
                <Text size="sm" fw={500} mb={4}>
                  {drugName}
                </Text>
                <Group gap={4} wrap="wrap">
                  {events.map((ev) => (
                    <Tooltip
                      key={ev.id}
                      label={`${ev.event_type}: ${ev.dosage ?? ""} ${ev.frequency ?? ""} (${new Date(ev.effective_date).toLocaleDateString()})${ev.change_reason ? ` — ${ev.change_reason}` : ""}`}
                    >
                      <Badge
                        tone={EVENT_COLORS[ev.event_type] ?? "neutral"}
                        variant="filled"
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
              <Text span c="dimmed" size="xs">
                {" "}
                — Target: {chart.targetValue}
              </Text>
            )}
          </Text>
          <LineChart
            h={180}
            data={chart.data}
            dataKey="date"
            series={[{ name: "value", color: "primary" }]}
            curveType="monotone"
            referenceLines={
              chart.targetValue !== null
                ? [{ y: chart.targetValue, color: "red.5", label: "Target" }]
                : undefined
            }
          />
        </Card>
      ))}

      {/* Vitals Mini Charts */}
      {vitalGroups.map(([param, points]) => (
        <Card key={param} withBorder padding="md">
          <Text fw={500} size="sm" mb="xs">
            {param}
          </Text>
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
        <Text c="dimmed" ta="center">
          No timeline data available for this patient.
        </Text>
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
    queryFn: () => chronicCareService.listChronicEnrollments({ status: "active" }),
  });

  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const { data: summary, isLoading } = useQuery({
    queryKey: ["treatment-summary", selectedPatient],
    queryFn: () => chronicCareService.treatmentSummary(selectedPatient ?? ""),
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
            tone="secondary"
            leftSection={<IconPrinter size={14} />}
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
        <Text fw={600} size="lg">
          {summary.patient_name}
        </Text>
        <Group gap="md" mt={4}>
          <Text size="sm" c="dimmed">
            UHID: {summary.uhid}
          </Text>
          {summary.date_of_birth && (
            <Text size="sm" c="dimmed">
              DOB: {summary.date_of_birth}
            </Text>
          )}
          {summary.gender && (
            <Text size="sm" c="dimmed">
              Gender: {summary.gender}
            </Text>
          )}
        </Group>
      </Card>

      {/* Active Diagnoses */}
      {summary.active_diagnoses.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="xs">
            Active Diagnoses
          </Text>
          <Stack gap={4}>
            {summary.active_diagnoses.map((d) => (
              <Group key={`${d.diagnosis_name}-${d.icd_code ?? "uncoded"}`} gap="xs">
                <Text size="sm">{d.diagnosis_name}</Text>
                {d.icd_code && (
                  <Badge tone="neutral" variant="light" size="xs">
                    {d.icd_code}
                  </Badge>
                )}
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      {/* Current Medications */}
      {summary.current_medications.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="xs">
            Current Medications
          </Text>
          <Stack gap={4}>
            {summary.current_medications.map((m) => (
              <Group key={m.drug_name} gap="xs">
                <Text size="sm" fw={500}>
                  {m.drug_name}
                </Text>
                {m.generic_name && (
                  <Text size="xs" c="dimmed">
                    ({m.generic_name})
                  </Text>
                )}
                <Text size="sm">
                  {m.dosage} {m.frequency} {m.route}
                </Text>
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      {/* Outcome Targets */}
      {summary.targets.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="xs">
            Outcome Targets
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            {summary.targets.map((t) => (
              <Paper key={t.target.id} withBorder p="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    {t.target.parameter_name}
                  </Text>
                  <Badge
                    tone={t.at_target ? "success" : t.at_target === false ? "danger" : "neutral"}
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
          <Text fw={500} mb="xs">
            Lab Trends
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {summary.lab_trends
              .filter((s) => s.data_points.length > 0)
              .map((series) => (
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
          <Text fw={500} mb="xs">
            Overall Adherence Rate
          </Text>
          <Progress
            value={summary.adherence_rate}
            color={summary.adherence_rate >= 80 ? "success" : "danger"}
            size="lg"
          />
          <Text size="sm" mt={4}>
            {Math.round(summary.adherence_rate)}%
          </Text>
        </Card>
      )}

      {/* Enrollment History */}
      {summary.enrollments.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="xs">
            Enrollment History
          </Text>
          <Stack gap={4}>
            {summary.enrollments.map((e) => (
              <Group key={`${e.program_name}-${e.enrollment_date}-${e.status}`} gap="xs">
                <Text size="sm">{e.program_name}</Text>
                <Text size="xs" c="dimmed">
                  Enrolled: {e.enrollment_date}
                </Text>
                <Badge tone={STATUS_COLORS[e.status] ?? "neutral"} size="xs">
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
