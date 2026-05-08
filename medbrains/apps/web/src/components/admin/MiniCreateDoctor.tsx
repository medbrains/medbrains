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
import { api } from "@medbrains/api";
import type { SetupUser } from "@medbrains/types";
import { IconCheck, IconStethoscope } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

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
  const [fullName, setFullName] = useState(initialName);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState(() => inferUsername(initialName, ""));
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("doctor");
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [specialization, setSpecialization] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [qualification, setQualification] = useState("");
  const [consultationFee, setConsultationFee] = useState<number | string>("");

  const { data: roles = [] } = useQuery({
    queryKey: ["setup", "roles"],
    queryFn: () => api.listRoles(),
    staleTime: 300_000,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["setup", "departments"],
    queryFn: () => api.listDepartments(),
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
    mutationFn: () =>
      api.createSetupUser({
        username: username.trim(),
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        role: selectedRole,
        department_ids: departmentIds,
        specialization: specialization.trim() || undefined,
        medical_registration_number: registrationNumber.trim() || undefined,
        qualification: qualification.trim() || undefined,
        consultation_fee: typeof consultationFee === "number" ? consultationFee : undefined,
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
    fullName.trim().length > 0 &&
    username.trim().length >= 3 &&
    email.includes("@") &&
    password.length >= 8 &&
    selectedRole.length > 0;

  return (
    <Stack gap="sm">
      <TextInput
        label="Full name"
        required
        value={fullName}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setFullName(next);
          if (!username || username === inferUsername(fullName, email)) {
            setUsername(inferUsername(next, email));
          }
        }}
      />
      <Group grow align="flex-start">
        <TextInput
          label="Email"
          required
          type="email"
          value={email}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setEmail(next);
            if (!username || username === inferUsername(fullName, email)) {
              setUsername(inferUsername(fullName, next));
            }
          }}
        />
        <TextInput
          label="Username"
          required
          value={username}
          onChange={(event) => setUsername(event.currentTarget.value)}
        />
      </Group>
      <PasswordInput
        label="Temporary password"
        required
        value={password}
        onChange={(event) => setPassword(event.currentTarget.value)}
      />
      <Group grow align="flex-start">
        <Select
          allowDeselect={false}
          data={roleOptions}
          label="Role"
          required
          value={selectedRole}
          onChange={(value) => setRole(value ?? "doctor")}
        />
        <NumberInput
          label="Consultation fee"
          min={0}
          value={consultationFee}
          onChange={(value) => setConsultationFee(value)}
        />
      </Group>
      <MultiSelect
        clearable
        data={departmentOptions}
        label="Departments"
        searchable
        value={departmentIds}
        onChange={setDepartmentIds}
      />
      <Group grow align="flex-start">
        <TextInput
          label="Specialization"
          value={specialization}
          onChange={(event) => setSpecialization(event.currentTarget.value)}
        />
        <TextInput
          label="Registration no."
          value={registrationNumber}
          onChange={(event) => setRegistrationNumber(event.currentTarget.value)}
        />
      </Group>
      <TextInput
        label="Qualification"
        value={qualification}
        onChange={(event) => setQualification(event.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          leftSection={<IconStethoscope size={16} />}
          loading={mutation.isPending}
          disabled={!canSubmit}
          onClick={() => mutation.mutate()}
        >
          Create & select
        </Button>
      </Group>
    </Stack>
  );
}
