// IPD OverviewTab — split from ipd.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox, Group, Select, Stack, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { IpdNursingTaskFormInput } from "@medbrains/schemas";
import { ipdNursingTaskFormSchema } from "@medbrains/schemas";
import type { CreateNursingTaskRequest, NursingTask } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Button } from "@/components/ui";
import {
  DEFAULT_IPD_NURSING_TASK_VALUES,
  ipdOptionalText,
  nursingTaskTypeOptions,
} from "@/forms/ipd.form";
import { ipdService } from "@/services/ipd.service";

export function OverviewTab({
  admissionId,
  tasks,
  canCreate,
}: {
  admissionId: string;
  tasks: NursingTask[];
  canCreate: boolean;
}) {
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<IpdNursingTaskFormInput>({
    resolver: zodResolver(ipdNursingTaskFormSchema),
    defaultValues: DEFAULT_IPD_NURSING_TASK_VALUES,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateNursingTaskRequest) => ipdService.createNursingTask(admissionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] });
      formHandlers.close();
      reset(DEFAULT_IPD_NURSING_TASK_VALUES);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      ipdService.updateNursingTask(admissionId, taskId, { is_completed: completed }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] }),
  });

  const handleCreateTask = (values: IpdNursingTaskFormInput) => {
    createMutation.mutate({
      task_type: values.task_type,
      description: values.description.trim(),
      assigned_to: ipdOptionalText(values.assigned_to),
      notes: ipdOptionalText(values.notes),
    });
  };

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={formHandlers.toggle}
          >
            Add Task
          </Button>
        </Group>
      )}
      {formOpened && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateTask)}>
          <Controller
            control={control}
            name="task_type"
            render={({ field }) => (
              <Select
                label="Task Type"
                required
                data={nursingTaskTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "vitals")}
                error={errors.task_type?.message}
                searchable
              />
            )}
          />
          <TextInput
            label="Description"
            required
            error={errors.description?.message}
            {...register("description")}
          />
          <Controller
            control={control}
            name="assigned_to"
            render={({ field }) => (
              <EmployeeSearchSelect
                label="Assigned to"
                value={field.value}
                onChange={field.onChange}
                error={errors.assigned_to?.message}
              />
            )}
          />
          <TextInput label="Notes" error={errors.notes?.message} {...register("notes")} />
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save Task
          </Button>
        </Stack>
      )}
      <DataTable
        columns={[
          {
            key: "done",
            label: "Done",
            render: (t: NursingTask) => (
              <Checkbox
                checked={t.is_completed}
                onChange={() => toggleMutation.mutate({ taskId: t.id, completed: !t.is_completed })}
                disabled={!canCreate}
              />
            ),
          },
          { key: "task_type", label: "Type", render: (t: NursingTask) => t.task_type },
          { key: "description", label: "Description", render: (t: NursingTask) => t.description },
          {
            key: "due",
            label: "Due",
            render: (t: NursingTask) => (t.due_at ? new Date(t.due_at).toLocaleString() : "—"),
          },
          { key: "notes", label: "Notes", render: (t: NursingTask) => t.notes ?? "—" },
        ]}
        data={tasks}
        rowKey={(t) => t.id}
      />
    </Stack>
  );
}

// ── Progress Notes ─────────────────────────────────────
