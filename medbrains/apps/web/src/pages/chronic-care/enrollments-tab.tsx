// Chronic-care EnrollmentsTab — split from chronic-care.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { ChronicEnrollmentFormInput } from "@medbrains/schemas";
import { chronicEnrollmentFormSchema } from "@medbrains/schemas";
import type { ChronicEnrollmentRow, CreateChronicEnrollmentRequest } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Icd11CodeSelect } from "@/components/Clinical/Icd11CodeSelect";
import type { Column } from "@/components/DataTable";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button } from "@/components/ui";
import { chronicCareService } from "@/services/chronicCare.service";
import { PROGRAM_TYPES, STATUS_COLORS } from "./shared";

export function EnrollmentsTab({ canCreate }: { canCreate: boolean }) {
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
