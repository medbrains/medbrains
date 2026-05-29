import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Group, Modal, Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CreateDepartmentFormInput } from "@medbrains/schemas";
import { createDepartmentFormSchema } from "@medbrains/schemas";
import type { DepartmentRow } from "@medbrains/types";
import { IconCheck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { adminAccessService } from "@/services/adminAccess.service";

const DEPARTMENT_TYPE_OPTIONS = [
  { value: "clinical", label: "Clinical" },
  { value: "pre_clinical", label: "Pre-Clinical" },
  { value: "para_clinical", label: "Para-Clinical" },
  { value: "administrative", label: "Administrative" },
  { value: "support", label: "Support" },
  { value: "academic", label: "Academic" },
];

interface CreateDepartmentModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated?: (department: DepartmentRow) => void;
}

export function CreateDepartmentModal({ opened, onClose, onCreated }: CreateDepartmentModalProps) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateDepartmentFormInput>({
    resolver: zodResolver(createDepartmentFormSchema),
    defaultValues: { code: "", name: "", department_type: "clinical" },
    mode: "onTouched",
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateDepartmentFormInput) =>
      adminAccessService.createDepartment({
        code: data.code.trim(),
        name: data.name.trim(),
        department_type: data.department_type,
      }),
    onSuccess: (created: DepartmentRow) => {
      notifications.show({
        title: "Department created",
        message: "Department has been created successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-departments"] });
      reset();
      if (onCreated) {
        onCreated(created);
      } else {
        onClose();
      }
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Create failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const submitDepartment = handleSubmit((values) => createMutation.mutate(values));

  return (
    <Modal opened={opened} onClose={handleClose} title="Add Department" size="md">
      <Stack gap="sm">
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <TextInput
              label="Code"
              placeholder="GEN-MED"
              value={field.value}
              onChange={(e) => field.onChange(e.currentTarget.value.toUpperCase())}
              error={errors.code?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextInput
              label="Name"
              placeholder="General Medicine"
              value={field.value}
              onChange={field.onChange}
              error={errors.name?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="department_type"
          render={({ field }) => (
            <Select
              label="Department Type"
              data={DEPARTMENT_TYPE_OPTIONS}
              value={field.value}
              onChange={(v) => field.onChange(v ?? "clinical")}
              error={errors.department_type?.message}
              required
            />
          )}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={() => void submitDepartment()} loading={createMutation.isPending}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
