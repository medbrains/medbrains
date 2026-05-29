/**
 * UserCreateDrawer — 4-tab Mantine Stepper for creating a new user.
 *
 * Step 1 — Identity:        username, email, password, full name, prefix, phone
 * Step 2 — Role + Depts:    role Select + departments MultiSelect
 * Step 3 — Groups:          access_groups MultiSelect (with description hover)
 * Step 4 — Overrides:       extra/denied permission tree on top of role grants
 *
 * Submit posts to `POST /api/setup/users` with `group_ids` + `access_matrix`.
 * Backend writes user row, group_member rows, access_matrix JSONB, and
 * SpiceDB `department:#member` + `access_group:#member` tuples in the
 * same transaction.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Drawer,
  Group,
  MultiSelect,
  PasswordInput,
  Select,
  Stack,
  Stepper,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { UserCreateDrawerFormInput } from "@medbrains/schemas";
import { userCreateDrawerFormSchema } from "@medbrains/schemas";
import { buildPermissionTree, PERMISSIONS } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, FormProvider, useForm, useFormContext } from "react-hook-form";
import { adminAccessService } from "@/services/adminAccess.service";

interface Props {
  opened: boolean;
  onClose: () => void;
}

interface RoleOptionSource {
  code: string;
  name: string;
}

interface DepartmentOptionSource {
  id: string;
  name: string;
  department_type?: string | null;
}

interface AccessGroupOptionSource {
  id: string;
  name: string;
  description?: string | null;
}

const USER_CREATE_DEFAULT_VALUES: UserCreateDrawerFormInput = {
  username: "",
  email: "",
  password: "",
  full_name: "",
  prefix: "",
  phone: "",
  role: null,
  departmentIds: [],
  groupIds: [],
  extra: [],
  denied: [],
};

export function UserCreateDrawer({ opened, onClose }: Props) {
  const qc = useQueryClient();

  const [active, setActive] = useState(0);
  const form = useForm<UserCreateDrawerFormInput>({
    resolver: zodResolver(userCreateDrawerFormSchema),
    defaultValues: USER_CREATE_DEFAULT_VALUES,
    mode: "onTouched",
  });
  const { handleSubmit, reset: resetForm, trigger, watch } = form;
  const values = watch();

  const rolesQuery = useQuery({
    queryKey: ["setup", "roles"],
    queryFn: () => adminAccessService.listRoles(),
    enabled: opened,
  });

  const deptsQuery = useQuery({
    queryKey: ["setup", "departments"],
    queryFn: () => adminAccessService.listDepartments(),
    enabled: opened,
  });

  const groupsQuery = useQuery({
    queryKey: ["access-groups"],
    queryFn: () => adminAccessService.listAccessGroups(),
    enabled: opened,
  });

  const tree = useMemo(() => buildPermissionTree(PERMISSIONS), []);

  const reset = () => {
    setActive(0);
    resetForm(USER_CREATE_DEFAULT_VALUES);
  };

  const createMutation = useMutation({
    mutationFn: (formValues: UserCreateDrawerFormInput) =>
      adminAccessService.createUser({
        username: formValues.username.trim(),
        email: formValues.email.trim(),
        password: formValues.password,
        full_name: formValues.full_name.trim(),
        role: formValues.role ?? "",
        department_ids: formValues.departmentIds,
        group_ids: formValues.groupIds,
        access_matrix: {
          extra: formValues.extra,
          denied: formValues.denied,
        },
      }),
    onSuccess: (_createdUser, formValues) => {
      notifications.show({
        message: `User ${formValues.username} created`,
        color: "green",
      });
      qc.invalidateQueries({ queryKey: ["setup-users"] });
      reset();
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({ message: err.message, color: "red" });
    },
  });

  const submitUser = handleSubmit((formValues) => {
    createMutation.mutate(formValues);
  });

  const advance = async () => {
    if (active === 0) {
      const valid = await trigger(["username", "email", "password", "full_name"]);
      if (!valid) return;
    }
    if (active === 1) {
      const valid = await trigger("role");
      if (!valid) return;
    }
    setActive((s) => s + 1);
  };

  return (
    <Drawer
      opened={opened}
      onClose={() => {
        reset();
        onClose();
      }}
      position="right"
      size="xl"
      title={<Title order={4}>Create user</Title>}
    >
      <FormProvider {...form}>
        <Stepper active={active} onStepClick={setActive} allowNextStepsSelect={false}>
          {/* ── Step 1: Identity ───────────────────────────── */}
          <Stepper.Step label="Identity" description="Login + name">
            <IdentityStep />
          </Stepper.Step>

          {/* ── Step 2: Role + Departments ───────────────────── */}
          <Stepper.Step label="Role + Depts" description="What they do, where">
            <RoleDepartmentsStep
              roles={rolesQuery.data ?? []}
              departments={deptsQuery.data ?? []}
            />
          </Stepper.Step>

          {/* ── Step 3: Groups ───────────────────────────────── */}
          <Stepper.Step label="Groups" description="Care teams, on-call">
            <GroupsStep groups={groupsQuery.data ?? []} />
          </Stepper.Step>

          {/* ── Step 4: Permission overrides ─────────────────── */}
          <Stepper.Step label="Overrides" description="Extra / Denied">
            <OverridesStep tree={tree} />
          </Stepper.Step>

          <Stepper.Completed>
            <Stack gap="sm" mt="md">
              <Title order={5}>Review</Title>
              <Text size="sm">
                <b>{values.full_name}</b> ({values.username}) — role: <b>{values.role ?? "—"}</b>
              </Text>
              <Text size="sm">
                Departments: {values.departmentIds.length} · Groups: {values.groupIds.length} ·
                Extra perms: {values.extra.length} · Denied perms: {values.denied.length}
              </Text>
              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={() => setActive(0)}>
                  Edit
                </Button>
                <Button onClick={() => void submitUser()} loading={createMutation.isPending}>
                  Create user
                </Button>
              </Group>
            </Stack>
          </Stepper.Completed>
        </Stepper>
      </FormProvider>

      <Group justify="space-between" mt="xl">
        <Button
          variant="default"
          onClick={() => setActive((s) => Math.max(0, s - 1))}
          disabled={active === 0}
        >
          Back
        </Button>
        {active < 4 && (
          <Button onClick={() => void advance()}>{active === 3 ? "Review" : "Next"}</Button>
        )}
      </Group>
    </Drawer>
  );
}

function IdentityStep() {
  const {
    control,
    formState: { errors },
  } = useFormContext<UserCreateDrawerFormInput>();

  return (
    <Stack gap="sm" mt="md">
      <Group grow>
        <Controller
          control={control}
          name="username"
          render={({ field }) => (
            <TextInput
              label="Username"
              value={field.value}
              onChange={field.onChange}
              required
              description="≥ 3 chars, unique within tenant"
              error={errors.username?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="prefix"
          render={({ field }) => (
            <TextInput
              label="Prefix"
              value={field.value}
              onChange={field.onChange}
              placeholder="Dr. / Nurse / Mr. / Ms."
              error={errors.prefix?.message}
            />
          )}
        />
      </Group>
      <Controller
        control={control}
        name="full_name"
        render={({ field }) => (
          <TextInput
            label="Full name"
            value={field.value}
            onChange={field.onChange}
            required
            error={errors.full_name?.message}
          />
        )}
      />
      <Group grow>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextInput
              label="Email"
              type="email"
              value={field.value}
              onChange={field.onChange}
              required
              error={errors.email?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <TextInput
              label="Phone"
              value={field.value}
              onChange={field.onChange}
              error={errors.phone?.message}
            />
          )}
        />
      </Group>
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <PasswordInput
            label="Password"
            value={field.value}
            onChange={field.onChange}
            required
            description="≥ 8 chars. User can change after first login."
            error={errors.password?.message}
          />
        )}
      />
    </Stack>
  );
}

function RoleDepartmentsStep({
  roles,
  departments,
}: {
  roles: RoleOptionSource[];
  departments: DepartmentOptionSource[];
}) {
  const {
    control,
    formState: { errors },
  } = useFormContext<UserCreateDrawerFormInput>();

  return (
    <Stack gap="sm" mt="md">
      <Controller
        control={control}
        name="role"
        render={({ field }) => (
          <Select
            label="Role"
            data={roles.map((r) => ({
              value: r.code,
              label: r.name,
            }))}
            value={field.value}
            onChange={field.onChange}
            searchable
            required
            description="Drives the default permission set."
            error={errors.role?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="departmentIds"
        render={({ field }) => (
          <MultiSelect
            label="Departments"
            data={departments.map((d) => ({
              value: d.id,
              label: `${d.name} (${d.department_type ?? "—"})`,
            }))}
            value={field.value}
            onChange={field.onChange}
            searchable
            clearable
            description="Determines dept_member tuples in SpiceDB → which scoped resources the user can see."
          />
        )}
      />
    </Stack>
  );
}

function GroupsStep({ groups }: { groups: AccessGroupOptionSource[] }) {
  const { control, watch } = useFormContext<UserCreateDrawerFormInput>();
  const groupIds = watch("groupIds");

  return (
    <Stack gap="sm" mt="md">
      <Controller
        control={control}
        name="groupIds"
        render={({ field }) => (
          <MultiSelect
            label="Access groups"
            data={groups.map((g) => ({
              value: g.id,
              label: g.description ? `${g.name} — ${g.description}` : g.name,
            }))}
            value={field.value}
            onChange={field.onChange}
            searchable
            clearable
            description="e.g. lab_seniors, code_blue_team, integrations_admin. Adds extra permissions on top of role."
          />
        )}
      />
      {groupIds.length === 0 && (
        <Text c="dimmed" size="sm">
          No groups selected — user gets only their role's permissions.
        </Text>
      )}
    </Stack>
  );
}

function OverridesStep({ tree }: { tree: ReturnType<typeof buildPermissionTree> }) {
  const { control } = useFormContext<UserCreateDrawerFormInput>();

  return (
    <Stack gap="sm" mt="md">
      <Text size="sm" c="dimmed">
        Optional fine-tuning on top of the role's permission set. Most users need none — leave
        blank.
      </Text>
      <Controller
        control={control}
        name="extra"
        render={({ field }) => (
          <PermissionPicker
            label="Extra permissions (grant)"
            color="green"
            tree={tree}
            selected={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="denied"
        render={({ field }) => (
          <PermissionPicker
            label="Denied permissions (revoke)"
            color="red"
            tree={tree}
            selected={field.value}
            onChange={field.onChange}
          />
        )}
      />
    </Stack>
  );
}

// ── Permission picker — flat module-grouped checkbox list ────────────

interface PermissionPickerProps {
  label: string;
  color: "green" | "red";
  tree: ReturnType<typeof buildPermissionTree>;
  selected: string[];
  onChange: (next: string[]) => void;
}

function PermissionPicker({ label, color, tree, selected, onChange }: PermissionPickerProps) {
  // Flatten the tree into top-level module groups for a MultiSelect.
  const data = useMemo(() => {
    const out: { value: string; label: string; group: string }[] = [];
    const walk = (nodes: ReturnType<typeof buildPermissionTree>, moduleLabel: string) => {
      for (const node of nodes) {
        for (const p of node.permissions) {
          out.push({
            value: p.code,
            label: p.code,
            group: moduleLabel || node.label,
          });
        }
        if (node.children.length > 0) {
          walk(node.children, moduleLabel || node.label);
        }
      }
    };
    walk(tree, "");
    return out;
  }, [tree]);

  return (
    <MultiSelect
      label={label}
      data={data}
      value={selected}
      onChange={onChange}
      searchable
      clearable
      maxDropdownHeight={300}
      styles={{ pill: { backgroundColor: color === "green" ? "#d3f9d8" : "#ffe3e3" } }}
    />
  );
}
