import {
  ActionIcon,
  Badge,
  Button,
  Modal,
  MultiSelect,
  NumberInput,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { createUserSchema, createRoleSchema } from "@medbrains/schemas";
import type { CreateUserInput, CreateRoleInput } from "@medbrains/schemas";
import { useOnboardingStore } from "@medbrains/stores";
import type { OnboardingDepartment, OnboardingRole, OnboardingUser } from "@medbrains/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { IconPlus, IconStethoscope, IconTrash, IconUpload, IconUser } from "@tabler/icons-react";
import { api } from "@medbrains/api";
import { CsvImportModal, SelectLabel } from "../../components";
import classes from "./onboarding.module.scss";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const systemRoles = [
  { value: "hospital_admin", label: "Hospital Admin" },
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "receptionist", label: "Receptionist" },
  { value: "lab_technician", label: "Lab Technician" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "billing_clerk", label: "Billing Clerk" },
  { value: "housekeeping_staff", label: "Housekeeping Staff" },
  { value: "facilities_manager", label: "Facilities Manager" },
  { value: "audit_officer", label: "Audit Officer" },
];

export function UsersStep({ onNext, onBack }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const users = useOnboardingStore((s) => s.users);
  const addUser = useOnboardingStore((s) => s.addUser);
  const removeUser = useOnboardingStore((s) => s.removeUser);
  const roles = useOnboardingStore((s) => s.roles);
  const addRole = useOnboardingStore((s) => s.addRole);
  const removeRole = useOnboardingStore((s) => s.removeRole);
  const departments = useOnboardingStore((s) => s.departments);

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      full_name: "",
      username: "",
      email: "",
      password: "",
      role: "doctor",
      specialization: "",
      medical_registration_number: "",
      qualification: "",
      consultation_fee: undefined,
      department_local_ids: [],
    },
  });

  const roleForm = useForm<CreateRoleInput>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
    },
  });

  const watchedRole = form.watch("role");
  const isDoctor = watchedRole === "doctor";

  const roleOptions = [
    ...systemRoles,
    ...roles.map((r: OnboardingRole) => ({
      value: r.code,
      label: r.name,
    })),
  ];

  const departmentOptions = departments.map((d: OnboardingDepartment) => ({
    value: d.local_id,
    label: d.name,
  }));

  const handleAddUser = form.handleSubmit((data) => {
    if (users.some((u) => u.username === data.username)) {
      form.setError("username", { message: "This username is already taken" });
      return;
    }
    if (users.some((u) => u.email === data.email)) {
      form.setError("email", { message: "This email is already in use" });
      return;
    }
    addUser({
      full_name: data.full_name,
      username: data.username,
      email: data.email,
      password: data.password,
      role: data.role,
      specialization: isDoctor ? data.specialization : undefined,
      medical_registration_number: isDoctor ? data.medical_registration_number : undefined,
      qualification: isDoctor ? data.qualification : undefined,
      consultation_fee: isDoctor ? data.consultation_fee : undefined,
      department_local_ids: isDoctor ? data.department_local_ids : undefined,
    });
    setShowModal(false);
    form.reset();
  });

  const handleAddRole = roleForm.handleSubmit((data) => {
    if (roles.some((r) => r.code === data.code)) {
      roleForm.setError("code", { message: "A role with this code already exists" });
      return;
    }
    addRole({
      code: data.code,
      name: data.name,
      description: data.description,
    });
    setShowRoleModal(false);
    roleForm.reset();
  });

  const openUserModal = () => {
    form.reset({
      full_name: "",
      username: "",
      email: "",
      password: "",
      role: "doctor",
      specialization: "",
      medical_registration_number: "",
      qualification: "",
      consultation_fee: undefined,
      department_local_ids: [],
    });
    setShowModal(true);
  };

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        The super admin was created during setup. Add additional staff accounts
        below. More users can be added later from the admin panel.
      </Text>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={openUserModal}
        >
          Add User
        </Button>
        <Button
          variant="subtle"
          onClick={() => {
            roleForm.reset();
            setShowRoleModal(true);
          }}
        >
          Add Custom Role
        </Button>
        <Button
          variant="subtle"
          leftSection={<IconUpload size={16} />}
          onClick={() => setShowImport(true)}
        >
          Import CSV
        </Button>
      </div>

      <CsvImportModal
        opened={showImport}
        onClose={() => setShowImport(false)}
        title="Import Users from CSV"
        requiredColumns={["username", "full_name", "email"]}
        optionalColumns={["password", "role"]}
        onImport={api.importUsers}
      />

      {roles.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb="xs">Custom Roles</Text>
          {roles.map((r: OnboardingRole) => (
            <div key={r.local_id} className={classes.facilityCard}>
              <div className={classes.facilityInfo}>
                <Text fw={600}>{r.name}</Text>
                <Text size="sm" c="dimmed">{r.code}</Text>
              </div>
              <ActionIcon
                variant="subtle"
                color="danger"
                onClick={() => removeRole(r.local_id)}
                aria-label="Delete"
              >
                <IconTrash size={16} />
              </ActionIcon>
            </div>
          ))}
        </div>
      )}

      {users.map((u: OnboardingUser) => (
        <div key={u.local_id} className={classes.facilityCard}>
          <div className={classes.facilityInfo}>
            <Text fw={600}>
              {u.role === "doctor" && <IconStethoscope size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />}
              {u.full_name}
            </Text>
            <Text size="sm" c="dimmed">
              {u.username} &middot; {u.email}
              {u.specialization && ` &middot; ${u.specialization}`}
            </Text>
            {u.consultation_fee != null && u.consultation_fee > 0 && (
              <Text size="xs" c="teal">Fee: ₹{u.consultation_fee}</Text>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge variant="light">{u.role.replace(/_/g, " ")}</Badge>
            <ActionIcon
              variant="subtle"
              color="danger"
              onClick={() => removeUser(u.local_id)}
              aria-label="Delete"
            >
              <IconTrash size={16} />
            </ActionIcon>
          </div>
        </div>
      ))}

      {/* Add User Modal */}
      <Modal
        opened={showModal}
        onClose={() => setShowModal(false)}
        title="Add User"
        size={isDoctor ? "lg" : "md"}
      >
        <form onSubmit={handleAddUser}>
          <Stack gap="sm">
            <TextInput
              label="Full Name"
              leftSection={<IconUser size={16} />}
              {...form.register("full_name")}
              error={form.formState.errors.full_name?.message}
            />
            <TextInput
              label="Username"
              {...form.register("username")}
              error={form.formState.errors.username?.message}
            />
            <TextInput
              label="Email"
              {...form.register("email")}
              error={form.formState.errors.email?.message}
              type="email"
            />
            <PasswordInput
              label="Password"
              {...form.register("password")}
              error={form.formState.errors.password?.message}
            />
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select
                  label={
                    <SelectLabel
                      label="Role"
                      onCreate={() => {
                        roleForm.reset();
                        setShowRoleModal(true);
                      }}
                    />
                  }
                  data={roleOptions}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "doctor")}
                  error={form.formState.errors.role?.message}
                />
              )}
            />

            {isDoctor && (
              <>
                <TextInput
                  label="Specialization"
                  placeholder="e.g., Cardiology, Orthopedics"
                  {...form.register("specialization")}
                  error={form.formState.errors.specialization?.message}
                />
                <TextInput
                  label="Medical Registration Number"
                  placeholder="e.g., MCI-12345"
                  {...form.register("medical_registration_number")}
                  error={form.formState.errors.medical_registration_number?.message}
                />
                <TextInput
                  label="Qualification"
                  placeholder="e.g., MBBS, MD, MS"
                  {...form.register("qualification")}
                  error={form.formState.errors.qualification?.message}
                />
                <Controller
                  control={form.control}
                  name="consultation_fee"
                  render={({ field }) => (
                    <NumberInput
                      label="Consultation Fee"
                      prefix="₹ "
                      min={0}
                      value={field.value ?? ""}
                      onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                      error={form.formState.errors.consultation_fee?.message}
                    />
                  )}
                />
                <Controller
                  control={form.control}
                  name="department_local_ids"
                  render={({ field }) => (
                    <MultiSelect
                      label="Departments"
                      placeholder="Select departments"
                      data={departmentOptions}
                      value={field.value ?? []}
                      onChange={field.onChange}
                    />
                  )}
                />
              </>
            )}

            <Button type="submit">
              Create User
            </Button>
          </Stack>
        </form>
      </Modal>

      {/* Add Role Modal */}
      <Modal
        opened={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title="Add Custom Role"
        size="sm"
      >
        <form onSubmit={handleAddRole}>
          <Stack gap="sm">
            <TextInput
              label="Role Code"
              description="Uppercase, e.g. CHIEF-PHARMACIST"
              {...roleForm.register("code", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  roleForm.setValue("code", e.currentTarget.value.toUpperCase());
                },
              })}
              error={roleForm.formState.errors.code?.message}
            />
            <TextInput
              label="Role Name"
              {...roleForm.register("name")}
              error={roleForm.formState.errors.name?.message}
            />
            <TextInput
              label="Description"
              {...roleForm.register("description")}
              error={roleForm.formState.errors.description?.message}
            />
            <Button type="submit">
              Create Role
            </Button>
          </Stack>
        </form>
      </Modal>

      <div className={classes.navButtons}>
        <Button variant="default" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </Stack>
  );
}
