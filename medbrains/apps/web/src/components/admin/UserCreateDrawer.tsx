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
import { api } from "@medbrains/api";
import { PERMISSIONS, buildPermissionTree } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

interface Props {
  opened: boolean;
  onClose: () => void;
}

interface IdentityForm {
  username: string;
  email: string;
  password: string;
  full_name: string;
  prefix: string;
  phone: string;
}

const EMPTY_IDENTITY: IdentityForm = {
  username: "",
  email: "",
  password: "",
  full_name: "",
  prefix: "",
  phone: "",
};

export function UserCreateDrawer({ opened, onClose }: Props) {
  const qc = useQueryClient();

  const [active, setActive] = useState(0);
  const [identity, setIdentity] = useState<IdentityForm>(EMPTY_IDENTITY);
  const [role, setRole] = useState<string | null>(null);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [extra, setExtra] = useState<Set<string>>(new Set());
  const [denied, setDenied] = useState<Set<string>>(new Set());

  const rolesQuery = useQuery({
    queryKey: ["setup", "roles"],
    queryFn: () => api.listRoles(),
    enabled: opened,
  });

  const deptsQuery = useQuery({
    queryKey: ["setup", "departments"],
    queryFn: () => api.listDepartments(),
    enabled: opened,
  });

  const groupsQuery = useQuery({
    queryKey: ["access-groups"],
    queryFn: () => api.listAccessGroups(),
    enabled: opened,
  });

  const tree = useMemo(() => buildPermissionTree(PERMISSIONS), []);

  const reset = () => {
    setActive(0);
    setIdentity(EMPTY_IDENTITY);
    setRole(null);
    setDepartmentIds([]);
    setGroupIds([]);
    setExtra(new Set());
    setDenied(new Set());
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.createSetupUser({
        username: identity.username.trim(),
        email: identity.email.trim(),
        password: identity.password,
        full_name: identity.full_name.trim(),
        role: role ?? "",
        department_ids: departmentIds,
        group_ids: groupIds,
        access_matrix: {
          extra: Array.from(extra),
          denied: Array.from(denied),
        },
      }),
    onSuccess: () => {
      notifications.show({
        message: `User ${identity.username} created`,
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

  const canAdvanceFromIdentity =
    identity.username.trim().length >= 3 &&
    identity.email.includes("@") &&
    identity.password.length >= 8 &&
    identity.full_name.trim().length > 0;

  const canAdvanceFromRole = role !== null;

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
      <Stepper active={active} onStepClick={setActive} allowNextStepsSelect={false}>
        {/* ── Step 1: Identity ───────────────────────────── */}
        <Stepper.Step label="Identity" description="Login + name">
          <Stack gap="sm" mt="md">
            <Group grow>
              <TextInput
                label="Username"
                value={identity.username}
                onChange={(e) =>
                  setIdentity({ ...identity, username: e.currentTarget.value })
                }
                required
                description="≥ 3 chars, unique within tenant"
              />
              <TextInput
                label="Prefix"
                value={identity.prefix}
                onChange={(e) =>
                  setIdentity({ ...identity, prefix: e.currentTarget.value })
                }
                placeholder="Dr. / Nurse / Mr. / Ms."
              />
            </Group>
            <TextInput
              label="Full name"
              value={identity.full_name}
              onChange={(e) =>
                setIdentity({ ...identity, full_name: e.currentTarget.value })
              }
              required
            />
            <Group grow>
              <TextInput
                label="Email"
                type="email"
                value={identity.email}
                onChange={(e) =>
                  setIdentity({ ...identity, email: e.currentTarget.value })
                }
                required
              />
              <TextInput
                label="Phone"
                value={identity.phone}
                onChange={(e) =>
                  setIdentity({ ...identity, phone: e.currentTarget.value })
                }
              />
            </Group>
            <PasswordInput
              label="Password"
              value={identity.password}
              onChange={(e) =>
                setIdentity({ ...identity, password: e.currentTarget.value })
              }
              required
              description="≥ 8 chars. User can change after first login."
            />
          </Stack>
        </Stepper.Step>

        {/* ── Step 2: Role + Departments ───────────────────── */}
        <Stepper.Step label="Role + Depts" description="What they do, where">
          <Stack gap="sm" mt="md">
            <Select
              label="Role"
              data={(rolesQuery.data ?? []).map((r) => ({
                value: r.code,
                label: r.name,
              }))}
              value={role}
              onChange={setRole}
              searchable
              required
              description="Drives the default permission set."
            />
            <MultiSelect
              label="Departments"
              data={(deptsQuery.data ?? []).map((d) => ({
                value: d.id,
                label: `${d.name} (${d.department_type ?? "—"})`,
              }))}
              value={departmentIds}
              onChange={setDepartmentIds}
              searchable
              clearable
              description="Determines dept_member tuples in SpiceDB → which scoped resources the user can see."
            />
          </Stack>
        </Stepper.Step>

        {/* ── Step 3: Groups ───────────────────────────────── */}
        <Stepper.Step label="Groups" description="Care teams, on-call">
          <Stack gap="sm" mt="md">
            <MultiSelect
              label="Access groups"
              data={(groupsQuery.data ?? []).map((g) => ({
                value: g.id,
                label: g.description ? `${g.name} — ${g.description}` : g.name,
              }))}
              value={groupIds}
              onChange={setGroupIds}
              searchable
              clearable
              description="e.g. lab_seniors, code_blue_team, integrations_admin. Adds extra permissions on top of role."
            />
            {groupIds.length === 0 && (
              <Text c="dimmed" size="sm">
                No groups selected — user gets only their role's permissions.
              </Text>
            )}
          </Stack>
        </Stepper.Step>

        {/* ── Step 4: Permission overrides ─────────────────── */}
        <Stepper.Step label="Overrides" description="Extra / Denied">
          <Stack gap="sm" mt="md">
            <Text size="sm" c="dimmed">
              Optional fine-tuning on top of the role's permission set. Most
              users need none — leave blank.
            </Text>
            <PermissionPicker
              label="Extra permissions (grant)"
              color="green"
              tree={tree}
              selected={extra}
              onChange={setExtra}
            />
            <PermissionPicker
              label="Denied permissions (revoke)"
              color="red"
              tree={tree}
              selected={denied}
              onChange={setDenied}
            />
          </Stack>
        </Stepper.Step>

        <Stepper.Completed>
          <Stack gap="sm" mt="md">
            <Title order={5}>Review</Title>
            <Text size="sm">
              <b>{identity.full_name}</b> ({identity.username}) — role:{" "}
              <b>{role ?? "—"}</b>
            </Text>
            <Text size="sm">
              Departments: {departmentIds.length} · Groups: {groupIds.length} ·
              Extra perms: {extra.size} · Denied perms: {denied.size}
            </Text>
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setActive(0)}>
                Edit
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                loading={createMutation.isPending}
              >
                Create user
              </Button>
            </Group>
          </Stack>
        </Stepper.Completed>
      </Stepper>

      <Group justify="space-between" mt="xl">
        <Button
          variant="default"
          onClick={() => setActive((s) => Math.max(0, s - 1))}
          disabled={active === 0}
        >
          Back
        </Button>
        {active < 4 && (
          <Button
            onClick={() => setActive((s) => s + 1)}
            disabled={
              (active === 0 && !canAdvanceFromIdentity) ||
              (active === 1 && !canAdvanceFromRole)
            }
          >
            {active === 3 ? "Review" : "Next"}
          </Button>
        )}
      </Group>
    </Drawer>
  );
}

// ── Permission picker — flat module-grouped checkbox list ────────────

interface PermissionPickerProps {
  label: string;
  color: "green" | "red";
  tree: ReturnType<typeof buildPermissionTree>;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

function PermissionPicker({
  label,
  color,
  tree,
  selected,
  onChange,
}: PermissionPickerProps) {
  // Flatten the tree into top-level module groups for a MultiSelect.
  const data = useMemo(() => {
    const out: { value: string; label: string; group: string }[] = [];
    const walk = (
      nodes: ReturnType<typeof buildPermissionTree>,
      moduleLabel: string,
    ) => {
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
      value={Array.from(selected)}
      onChange={(values) => onChange(new Set(values))}
      searchable
      clearable
      maxDropdownHeight={300}
      styles={{ pill: { backgroundColor: color === "green" ? "#d3f9d8" : "#ffe3e3" } }}
    />
  );
}
