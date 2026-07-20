// Chronic-care ProgramsTab — split from chronic-care.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { ChronicProgramFormInput } from "@medbrains/schemas";
import { chronicProgramFormSchema, toChronicProgramTypeFormValue } from "@medbrains/schemas";
import type { ChronicProgram, CreateChronicProgramRequest } from "@medbrains/types";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button, IconButton } from "@/components/ui";
import { confirmDestructive } from "@/lib/confirm";
import { chronicCareService } from "@/services/chronicCare.service";
import { PROGRAM_TYPES } from "./shared";

export function ProgramsTab({ canCreate }: { canCreate: boolean }) {
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
