import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Checkbox, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { GenderFormValue, MiniRegisterPatientFormInput } from "@medbrains/schemas";
import { miniRegisterPatientFormSchema, toGenderFormValue } from "@medbrains/schemas";
import type { Patient } from "@medbrains/types";
import { PATIENT_NAME_FIELD_ACCESS_KEYS, PATIENT_UHID_FIELD_ACCESS_KEY } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import { IconAlertTriangle, IconCheck, IconUserPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useProtectedFieldAccess } from "@/components/PermissionedFieldValue";
import { type CreatePatientInput, patientsService } from "@/services/patients.service";

interface MiniRegisterPatientProps {
  searchText: string;
  onCreated: (patient: Patient) => void;
  onCancel: () => void;
}

const genderOptions: { value: GenderFormValue; label: string }[] = [
  { value: "unknown", label: "Unknown" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

function splitSearchText(searchText: string): { firstName: string; lastName: string } {
  const tokens = searchText
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d{4,}\b/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (tokens.length === 1) {
    return { firstName: tokens[0] ?? "", lastName: "" };
  }

  return {
    firstName: tokens.slice(0, -1).join(" "),
    lastName: tokens.at(-1) ?? "",
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unable to register patient";
}

export function MiniRegisterPatient({ searchText, onCreated, onCancel }: MiniRegisterPatientProps) {
  const initialName = useMemo(() => splitSearchText(searchText), [searchText]);
  const queryClient = useQueryClient();
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const phoneAccess = useProtectedFieldAccess("patients.phone");
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MiniRegisterPatientFormInput>({
    resolver: zodResolver(miniRegisterPatientFormSchema),
    defaultValues: {
      first_name: initialName.firstName,
      last_name: initialName.lastName,
      phone: "",
      date_of_birth: "",
      gender: "unknown",
      duplicate_checked: false,
    },
    mode: "onTouched",
  });
  const values = watch();

  const duplicateTerm =
    values.phone.trim() || `${values.first_name.trim()} ${values.last_name.trim()}`.trim();
  const { data: duplicateData, isFetching: isCheckingDuplicates } = useQuery({
    queryKey: ["patient-inline-duplicate-check", duplicateTerm],
    queryFn: () => patientsService.listPatients({ search: duplicateTerm, per_page: 5 }),
    enabled: duplicateTerm.length >= 3,
    staleTime: 30_000,
  });

  const duplicateCandidates = duplicateData?.patients ?? [];
  const hasDuplicateCandidates = duplicateCandidates.length > 0;
  const canSubmit =
    values.first_name.trim().length > 0 &&
    values.last_name.trim().length > 0 &&
    (!hasDuplicateCandidates || values.duplicate_checked);
  const formatPatientLabel = (patient: Patient): string => {
    const name =
      fieldAccessText(
        patientNameAccess,
        `${patient.first_name} ${patient.last_name}`.trim(),
        "name",
      ) || "Patient";
    const uhid = fieldAccessText(uhidAccess, patient.uhid, "identifier");
    const phone = patient.phone ? ` - ${fieldAccessText(phoneAccess, patient.phone, "phone")}` : "";
    return `${name} (${uhid})${phone}`;
  };

  const mutation = useMutation({
    mutationFn: (payload: CreatePatientInput) => patientsService.createPatient(payload),
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ["patient-search"] });
      const registeredName =
        fieldAccessText(
          patientNameAccess,
          `${patient.first_name} ${patient.last_name}`.trim(),
          "name",
        ) || "Patient";
      notifications.show({
        title: "Patient registered",
        message: `${registeredName} is now selected`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      onCreated(patient);
    },
    onError: (error) => {
      notifications.show({
        title: "Registration failed",
        message: errorMessage(error),
        color: "danger",
      });
    },
  });

  const submitPatient = handleSubmit((formValues) => {
    if (!canSubmit) {
      return;
    }

    mutation.mutate({
      first_name: formValues.first_name.trim(),
      last_name: formValues.last_name.trim(),
      phone: formValues.phone.trim(),
      date_of_birth: formValues.date_of_birth || null,
      gender: formValues.gender,
      category: "general",
      registration_type: "new",
      registration_source: "walk_in",
      financial_class: "self_pay",
      attributes: {
        inline_registration_source: "patient_search_select",
        inline_registration_query: searchText,
      },
    });
  });

  return (
    <Stack gap="sm">
      <Alert color="warning" icon={<IconAlertTriangle size={16} />} variant="light">
        <Text size="sm" fw={600}>
          Verify the patient is not already registered.
        </Text>
        <Text size="xs" c="dimmed">
          Check phone, UHID, and name spelling before creating a new UHID.
        </Text>
      </Alert>

      {hasDuplicateCandidates && (
        <Alert color="orange" icon={<IconAlertTriangle size={16} />} variant="light">
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              Possible duplicate patients found
            </Text>
            {duplicateCandidates.map((patient) => (
              <Text key={patient.id} size="xs">
                {formatPatientLabel(patient)}
              </Text>
            ))}
            <Controller
              control={control}
              name="duplicate_checked"
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  label="I checked these records and still need a new patient"
                  mt={4}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
          </Stack>
        </Alert>
      )}

      <Group grow align="flex-start">
        <Controller
          control={control}
          name="first_name"
          render={({ field }) => (
            <TextInput
              label="First name"
              required
              value={field.value}
              onChange={(event) => {
                field.onChange(event);
                setValue("duplicate_checked", false, { shouldValidate: true });
              }}
              error={errors.first_name?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="last_name"
          render={({ field }) => (
            <TextInput
              label="Last name / initial"
              required
              value={field.value}
              onChange={(event) => {
                field.onChange(event);
                setValue("duplicate_checked", false, { shouldValidate: true });
              }}
              error={errors.last_name?.message}
            />
          )}
        />
      </Group>

      <Group grow align="flex-start">
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <TextInput
              label="Phone"
              inputMode="tel"
              value={field.value}
              onChange={(event) => {
                field.onChange(event);
                setValue("duplicate_checked", false, { shouldValidate: true });
              }}
              error={errors.phone?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="date_of_birth"
          render={({ field }) => (
            <TextInput
              label="Date of birth"
              type="date"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Group>

      <Controller
        control={control}
        name="gender"
        render={({ field }) => (
          <Select
            allowDeselect={false}
            data={genderOptions}
            label="Gender"
            value={field.value}
            onChange={(value) => field.onChange(toGenderFormValue(value))}
          />
        )}
      />

      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          leftSection={<IconUserPlus size={16} />}
          loading={mutation.isPending}
          disabled={!canSubmit || isCheckingDuplicates}
          onClick={() => void submitPatient()}
        >
          Register & select
        </Button>
      </Group>
    </Stack>
  );
}
