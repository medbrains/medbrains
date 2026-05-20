import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Group,
  MultiSelect,
  NumberInput,
  PasswordInput,
  Select,
  Stack,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { MiniDoctorFormInput } from "@medbrains/schemas";
import { miniDoctorFormSchema } from "@medbrains/schemas";
import type { SetupUser } from "@medbrains/types";
import { IconCheck, IconStethoscope } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { adminAccessService } from "../../services/adminAccess.service";

interface MiniCreateDoctorProps {
  searchText: string;
  onCreated: (doctor: SetupUser) => void;
  onCancel: () => void;
}

function inferName(searchText: string): string {
  return searchText.replace(/^dr\.?\s+/i, "").trim();
}

function inferUsername(name: string, email: string): string {
  const emailUser = email.split("@")[0]?.trim();
  if (emailUser) {
    return emailUser.toLowerCase().replace(/[^a-z0-9._-]+/g, "");
  }
  const username = name
    .toLowerCase()
    .replace(/^dr\.?\s+/i, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return username || "doctor";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to create doctor";
}

export function MiniCreateDoctor({ searchText, onCreated, onCancel }: MiniCreateDoctorProps) {
  const initialName = useMemo(() => inferName(searchText), [searchText]);
  const queryClient = useQueryClient();
  const {
    control,
    getValues,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MiniDoctorFormInput>({
    resolver: zodResolver(miniDoctorFormSchema),
    defaultValues: {
      full_name: initialName,
      email: "",
      username: inferUsername(initialName, ""),
      password: "",
      role: "doctor",
      department_ids: [],
      specialization: "",
      medical_registration_number: "",
      qualification: "",
      consultation_fee: "",
    },
    mode: "onTouched",
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["setup", "roles"],
    queryFn: () => adminAccessService.listRoles(),
    staleTime: 300_000,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["setup", "departments"],
    queryFn: () => adminAccessService.listDepartments(),
    staleTime: 300_000,
  });

  const roleOptions = useMemo(
    () => roles.map((item) => ({ value: item.code, label: item.name })),
    [roles],
  );
  const doctorRole = useMemo(
    () =>
      roleOptions.find((item) => item.value === "doctor")?.value ??
      roleOptions.find((item) => /doctor/i.test(item.label))?.value,
    [roleOptions],
  );
  const formValues = watch();
  const role = formValues.role;
  const selectedRole = roleOptions.some((item) => item.value === role)
    ? role
    : (doctorRole ?? role);

  const departmentOptions = useMemo(
    () =>
      departments
        .filter((department) => department.is_active)
        .map((department) => ({
          value: department.id,
          label: `${department.name} (${department.department_type})`,
        })),
    [departments],
  );

  const mutation = useMutation({
    mutationFn: (values: MiniDoctorFormInput) =>
      adminAccessService.createUser({
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
        full_name: values.full_name.trim(),
        role: selectedRole,
        department_ids: values.department_ids,
        specialization: values.specialization.trim() || undefined,
        medical_registration_number: values.medical_registration_number.trim() || undefined,
        qualification: values.qualification.trim() || undefined,
        consultation_fee:
          typeof values.consultation_fee === "number" ? values.consultation_fee : undefined,
      }),
    onSuccess: (doctor) => {
      void queryClient.invalidateQueries({ queryKey: ["doctors-list"] });
      void queryClient.invalidateQueries({ queryKey: ["setup-users"] });
      notifications.show({
        title: "Doctor created",
        message: `Dr. ${doctor.full_name} is now selected`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      onCreated(doctor);
    },
    onError: (error) => {
      notifications.show({
        title: "Doctor create failed",
        message: errorMessage(error),
        color: "danger",
      });
    },
  });

  const canSubmit =
    formValues.full_name.trim().length > 0 &&
    formValues.username.trim().length >= 3 &&
    formValues.email.includes("@") &&
    formValues.password.length >= 8 &&
    selectedRole.length > 0;
  const submitDoctor = handleSubmit((values) => mutation.mutate(values));

  return (
    <Stack gap="sm">
      <Controller
        control={control}
        name="full_name"
        render={({ field }) => (
          <TextInput
            label="Full name"
            required
            value={field.value}
            onChange={(event) => {
              const next = event.currentTarget.value;
              const currentEmail = getValues("email");
              const currentUsername = getValues("username");
              field.onChange(next);
              if (
                !currentUsername ||
                currentUsername === inferUsername(field.value, currentEmail)
              ) {
                setValue("username", inferUsername(next, currentEmail), {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }
            }}
            error={errors.full_name?.message}
          />
        )}
      />
      <Group grow align="flex-start">
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextInput
              label="Email"
              required
              type="email"
              value={field.value}
              onChange={(event) => {
                const next = event.currentTarget.value;
                const currentFullName = getValues("full_name");
                const currentUsername = getValues("username");
                field.onChange(next);
                if (
                  !currentUsername ||
                  currentUsername === inferUsername(currentFullName, field.value)
                ) {
                  setValue("username", inferUsername(currentFullName, next), {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }
              }}
              error={errors.email?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="username"
          render={({ field }) => (
            <TextInput
              label="Username"
              required
              value={field.value}
              onChange={field.onChange}
              error={errors.username?.message}
            />
          )}
        />
      </Group>
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <PasswordInput
            label="Temporary password"
            required
            value={field.value}
            onChange={field.onChange}
            error={errors.password?.message}
          />
        )}
      />
      <Group grow align="flex-start">
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Select
              allowDeselect={false}
              data={roleOptions}
              label="Role"
              required
              value={selectedRole}
              onChange={(value) => field.onChange(value ?? "doctor")}
              error={errors.role?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="consultation_fee"
          render={({ field }) => (
            <NumberInput
              label="Consultation fee"
              min={0}
              value={field.value}
              onChange={field.onChange}
              error={errors.consultation_fee?.message}
            />
          )}
        />
      </Group>
      <Controller
        control={control}
        name="department_ids"
        render={({ field }) => (
          <MultiSelect
            clearable
            data={departmentOptions}
            label="Departments"
            searchable
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <Group grow align="flex-start">
        <Controller
          control={control}
          name="specialization"
          render={({ field }) => (
            <TextInput label="Specialization" value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="medical_registration_number"
          render={({ field }) => (
            <TextInput label="Registration no." value={field.value} onChange={field.onChange} />
          )}
        />
      </Group>
      <Controller
        control={control}
        name="qualification"
        render={({ field }) => (
          <TextInput label="Qualification" value={field.value} onChange={field.onChange} />
        )}
      />
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          leftSection={<IconStethoscope size={16} />}
          loading={mutation.isPending}
          disabled={!canSubmit}
          onClick={() => void submitDoctor()}
        >
          Create & select
        </Button>
      </Group>
    </Stack>
  );
}
