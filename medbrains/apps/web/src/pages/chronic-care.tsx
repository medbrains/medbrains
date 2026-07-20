import { zodResolver } from "@hookform/resolvers/zod";
import { confirmDestructive } from "@/lib/confirm";
import { AdherenceTab } from "./chronic-care/adherence-tab";
import { DrugOgramTab } from "./chronic-care/drug-ogram-tab";
import { EnrollmentsTab } from "./chronic-care/enrollments-tab";
import { OutcomesTab } from "./chronic-care/outcomes-tab";
import { TreatmentSummaryTab } from "./chronic-care/treatment-summary-tab";
import "@mantine/charts/styles.css";
import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { ChronicProgramFormInput } from "@medbrains/schemas";
import { chronicProgramFormSchema, toChronicProgramTypeFormValue } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { ChronicProgram, CreateChronicProgramRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconFileText,
  IconHeartRateMonitor,
  IconPencil,
  IconPlus,
  IconReportMedical,
  IconTargetArrow,
  IconTimeline,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button, IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { chronicCareService } from "@/services/chronicCare.service";
import { PROGRAM_TYPES } from "./chronic-care/shared";

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
