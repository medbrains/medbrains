import { zodResolver } from "@hookform/resolvers/zod";
import { confirmDestructive } from "@/lib/confirm";
import { DrugOgramTab } from "./chronic-care/drug-ogram-tab";
import { TreatmentSummaryTab } from "./chronic-care/treatment-summary-tab";
import "@mantine/charts/styles.css";
import {
  Card,
  Drawer,
  Group,
  NumberInput,
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
import type { ChronicEnrollmentFormInput, ChronicProgramFormInput } from "@medbrains/schemas";
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
  OutcomeDashboardResponse,
  OutcomeTargetWithActual,
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
import { Badge, Button, IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { chronicCareService } from "@/services/chronicCare.service";
import { PROGRAM_TYPES, STATUS_COLORS } from "./chronic-care/shared";

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
