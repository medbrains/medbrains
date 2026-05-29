import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { MiniDepartmentFormInput } from "@medbrains/schemas";
import { miniDepartmentFormSchema } from "@medbrains/schemas";
import type { DepartmentRow } from "@medbrains/types";
import { IconBuilding, IconCheck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { adminAccessService } from "@/services/adminAccess.service";

interface MiniAddDepartmentProps {
  searchText: string;
  departmentType?: "clinical" | "para_clinical" | "administrative" | "support";
  onCreated: (department: DepartmentRow) => void;
  onCancel: () => void;
}

const departmentTypeOptions = [
  { value: "clinical", label: "Clinical" },
  { value: "para_clinical", label: "Para-Clinical" },
  { value: "administrative", label: "Administrative" },
  { value: "support", label: "Support" },
  { value: "academic", label: "Academic" },
];

function inferName(searchText: string): string {
  return searchText.trim();
}

function inferCode(name: string): string {
  const code = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  return code || "DEPT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to add department";
}

export function MiniAddDepartment({
  searchText,
  departmentType,
  onCreated,
  onCancel,
}: MiniAddDepartmentProps) {
  const initialName = useMemo(() => inferName(searchText), [searchText]);
  const queryClient = useQueryClient();
  const {
    control,
    getValues,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MiniDepartmentFormInput>({
    resolver: zodResolver(miniDepartmentFormSchema),
    defaultValues: {
      name: initialName,
      code: inferCode(initialName),
      department_type: departmentType ?? "clinical",
    },
    mode: "onTouched",
  });
  const formValues = watch();

  const mutation = useMutation({
    mutationFn: (values: MiniDepartmentFormInput) =>
      adminAccessService.createDepartment({
        code: values.code.trim(),
        name: values.name.trim(),
        department_type: values.department_type,
      }),
    onSuccess: (department) => {
      void queryClient.invalidateQueries({ queryKey: ["departments-list"] });
      void queryClient.invalidateQueries({ queryKey: ["setup-departments"] });
      void queryClient.invalidateQueries({ queryKey: ["setup", "departments"] });
      notifications.show({
        title: "Department added",
        message: `${department.name} is now selected`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      onCreated(department);
    },
    onError: (error) => {
      notifications.show({
        title: "Department add failed",
        message: errorMessage(error),
        color: "danger",
      });
    },
  });

  const submitDepartment = handleSubmit((values) => mutation.mutate(values));
  const canSubmit = formValues.name.trim().length >= 2 && formValues.code.trim().length >= 2;

  return (
    <Stack gap="sm">
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextInput
            label="Department name"
            required
            value={field.value}
            onChange={(event) => {
              const next = event.currentTarget.value;
              const currentCode = getValues("code");
              field.onChange(next);
              if (!currentCode || currentCode === inferCode(field.value)) {
                setValue("code", inferCode(next), { shouldDirty: true, shouldValidate: true });
              }
            }}
            error={errors.name?.message}
          />
        )}
      />
      <Group grow align="flex-start">
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <TextInput
              label="Code"
              required
              value={field.value}
              onChange={(event) => field.onChange(event.currentTarget.value.toUpperCase())}
              error={errors.code?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="department_type"
          render={({ field }) => (
            <Select
              allowDeselect={false}
              data={departmentTypeOptions}
              disabled={Boolean(departmentType)}
              label="Type"
              value={field.value}
              onChange={(value) => field.onChange(value ?? "clinical")}
            />
          )}
        />
      </Group>
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          leftSection={<IconBuilding size={16} />}
          loading={mutation.isPending}
          disabled={!canSubmit}
          onClick={() => void submitDepartment()}
        >
          Add & select
        </Button>
      </Group>
    </Stack>
  );
}
