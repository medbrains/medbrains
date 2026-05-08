import { Alert, Button, Checkbox, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type { CreatePatientRequest, Gender, Patient } from "@medbrains/types";
import { IconAlertTriangle, IconCheck, IconUserPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

interface MiniRegisterPatientProps {
  searchText: string;
  onCreated: (patient: Patient) => void;
  onCancel: () => void;
}

const genderOptions: { value: Gender; label: string }[] = [
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

function formatPatientLabel(patient: Patient): string {
  const phone = patient.phone ? ` - ${patient.phone}` : "";
  return `${patient.first_name} ${patient.last_name} (${patient.uhid})${phone}`;
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
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [lastName, setLastName] = useState(initialName.lastName);
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<Gender>("unknown");
  const [duplicateChecked, setDuplicateChecked] = useState(false);

  const duplicateTerm = phone.trim() || `${firstName.trim()} ${lastName.trim()}`.trim();
  const { data: duplicateData, isFetching: isCheckingDuplicates } = useQuery({
    queryKey: ["patient-inline-duplicate-check", duplicateTerm],
    queryFn: () => api.listPatients({ search: duplicateTerm, per_page: 5 }),
    enabled: duplicateTerm.length >= 3,
    staleTime: 30_000,
  });

  const duplicateCandidates = duplicateData?.patients ?? [];
  const hasDuplicateCandidates = duplicateCandidates.length > 0;
  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    (!hasDuplicateCandidates || duplicateChecked);

  const mutation = useMutation({
    mutationFn: (payload: CreatePatientRequest) => api.createPatient(payload),
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ["patient-search"] });
      notifications.show({
        title: "Patient registered",
        message: `${patient.first_name} ${patient.last_name} is now selected`,
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

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    mutation.mutate({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim(),
      date_of_birth: dateOfBirth || null,
      gender,
      category: "general",
      registration_type: "new",
      registration_source: "walk_in",
      financial_class: "self_pay",
      attributes: {
        inline_registration_source: "patient_search_select",
        inline_registration_query: searchText,
      },
    });
  };

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
            <Checkbox
              checked={duplicateChecked}
              label="I checked these records and still need a new patient"
              mt={4}
              onChange={(event) => setDuplicateChecked(event.currentTarget.checked)}
            />
          </Stack>
        </Alert>
      )}

      <Group grow align="flex-start">
        <TextInput
          label="First name"
          required
          value={firstName}
          onChange={(event) => {
            setFirstName(event.currentTarget.value);
            setDuplicateChecked(false);
          }}
        />
        <TextInput
          label="Last name / initial"
          required
          value={lastName}
          onChange={(event) => {
            setLastName(event.currentTarget.value);
            setDuplicateChecked(false);
          }}
        />
      </Group>

      <Group grow align="flex-start">
        <TextInput
          label="Phone"
          inputMode="tel"
          value={phone}
          onChange={(event) => {
            setPhone(event.currentTarget.value);
            setDuplicateChecked(false);
          }}
        />
        <TextInput
          label="Date of birth"
          type="date"
          value={dateOfBirth}
          onChange={(event) => setDateOfBirth(event.currentTarget.value)}
        />
      </Group>

      <Select
        allowDeselect={false}
        data={genderOptions}
        label="Gender"
        value={gender}
        onChange={(value) => setGender((value as Gender | null) ?? "unknown")}
      />

      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          leftSection={<IconUserPlus size={16} />}
          loading={mutation.isPending}
          disabled={!canSubmit || isCheckingDuplicates}
          onClick={handleSubmit}
        >
          Register & select
        </Button>
      </Group>
    </Stack>
  );
}
