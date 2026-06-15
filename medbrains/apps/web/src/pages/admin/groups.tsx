/**
 * Access Groups admin — `/admin/groups`.
 *
 * CRUD for `access_groups` + member management. Each membership write
 * bumps `users.perm_version` and emits a SpiceDB tuple (or attempts to
 * — Watch consumer reconciles eventually if SpiceDB was briefly down).
 */

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Card,
  Group,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { AccessGroupFormInput, AccessGroupMemberFormInput } from "@medbrains/schemas";
import { accessGroupFormSchema, accessGroupMemberFormSchema } from "@medbrains/schemas";
import { P, PERMISSIONS } from "@medbrains/types";
import { IconPencil, IconPlus, IconTrash, IconUsers } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { PageHeader } from "@/components";
import { Badge, Button, Table } from "@/components/ui";
import {
  accessGroupFormToRequest,
  accessGroupMemberFormToRequest,
  accessGroupRowToFormValues,
  defaultAccessGroupFormValues,
  defaultAccessGroupMemberFormValues,
} from "@/forms/admin-groups.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { adminAccessService } from "@/services/adminAccess.service";

interface GroupRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_active: boolean;
}

const PERMISSION_OPTIONS = PERMISSIONS.map((permission) => ({
  value: permission.code,
  label: `${permission.label} (${permission.code})`,
}));

export default function GroupsPage() {
  useRequirePermission(P.ADMIN.USERS.LIST);

  const qc = useQueryClient();
  const [editTarget, setEditTarget] = useState<GroupRow | null>(null);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [memberPanelGroup, setMemberPanelGroup] = useState<GroupRow | null>(null);

  const groupsQuery = useQuery({
    queryKey: ["access-groups"],
    queryFn: () => adminAccessService.listAccessGroups(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAccessService.deleteAccessGroup(id),
    onSuccess: () => {
      notifications.show({ message: "Group deactivated", color: "green" });
      qc.invalidateQueries({ queryKey: ["access-groups"] });
    },
    onError: (e: Error) => notifications.show({ message: e.message, color: "red" }),
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="Access Groups"
        subtitle="Care teams, on-call rotations, and privilege escalations. Membership feeds SpiceDB tuples for resource scoping."
        actions={
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New group
          </Button>
        }
      />

      <Table withTableBorder striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Code</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Description</Table.Th>
            <Table.Th>Permissions</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(groupsQuery.data ?? []).map((g) => (
            <Table.Tr key={g.id} data-selected={memberPanelGroup?.id === g.id || undefined}>
              <Table.Td>
                <Text size="sm" ff="monospace">
                  {g.code}
                </Text>
              </Table.Td>
              <Table.Td>{g.name}</Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed" lineClamp={2}>
                  {g.description ?? "—"}
                </Text>
              </Table.Td>
              <Table.Td>
                <Tooltip
                  label={
                    g.permissions.length > 0
                      ? g.permissions.map((permission) => permission).join(", ")
                      : "No global permission grants"
                  }
                  multiline
                  w={320}
                >
                  <Badge tone={g.permissions.length > 0 ? "success" : "neutral"}>
                    {g.permissions.length} grants
                  </Badge>
                </Tooltip>
              </Table.Td>
              <Table.Td>
                <Badge tone={g.is_active ? "success" : "neutral"}>
                  {g.is_active ? "active" : "deactivated"}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Tooltip label="Members">
                    <ActionIcon variant="subtle" onClick={() => setMemberPanelGroup(g)}>
                      <IconUsers size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Edit">
                    <ActionIcon variant="subtle" onClick={() => setEditTarget(g)}>
                      <IconPencil size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Deactivate">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => deleteMutation.mutate(g.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <GroupFormModal
        key={editTarget?.id ?? (createOpened ? "create" : "closed")}
        opened={createOpened || editTarget !== null}
        onClose={() => {
          closeCreate();
          setEditTarget(null);
        }}
        target={editTarget}
      />

      {memberPanelGroup && (
        <GroupMembersPanel
          key={memberPanelGroup.id}
          group={memberPanelGroup}
          onClose={() => setMemberPanelGroup(null)}
        />
      )}
    </Stack>
  );
}

// ── Create / edit modal ────────────────────────────────────────────

function GroupFormModal({
  opened,
  onClose,
  target,
}: {
  opened: boolean;
  onClose: () => void;
  target: GroupRow | null;
}) {
  const qc = useQueryClient();
  const isEdit = target !== null;
  const form = useForm<AccessGroupFormInput>({
    resolver: zodResolver(accessGroupFormSchema),
    defaultValues: target ? accessGroupRowToFormValues(target) : defaultAccessGroupFormValues,
    mode: "onTouched",
  });

  const createMutation = useMutation({
    mutationFn: (values: AccessGroupFormInput) =>
      adminAccessService.createAccessGroup(accessGroupFormToRequest(values)),
    onSuccess: () => {
      notifications.show({ message: "Group created", color: "green" });
      qc.invalidateQueries({ queryKey: ["access-groups"] });
      onClose();
    },
    onError: (e: Error) => notifications.show({ message: e.message, color: "red" }),
  });

  const updateMutation = useMutation({
    mutationFn: (values: AccessGroupFormInput) => {
      if (!target) throw new Error("No access group selected");
      return adminAccessService.updateAccessGroup(target.id, accessGroupFormToRequest(values));
    },
    onSuccess: () => {
      notifications.show({ message: "Group updated", color: "green" });
      qc.invalidateQueries({ queryKey: ["access-groups"] });
      onClose();
    },
    onError: (e: Error) => notifications.show({ message: e.message, color: "red" }),
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Title order={4}>{isEdit ? "Edit access group" : "New access group"}</Title>}
      size="lg"
    >
      <Stack
        component="form"
        gap="sm"
        onSubmit={form.handleSubmit((values) =>
          isEdit ? updateMutation.mutate(values) : createMutation.mutate(values),
        )}
      >
        <TextInput
          label="Code"
          description="Stable identifier — used in role policies + SpiceDB. e.g. lab_seniors, code_blue_team"
          {...form.register("code")}
          error={form.formState.errors.code?.message}
          disabled={isEdit}
          required
        />
        <TextInput
          label="Display name"
          {...form.register("name")}
          error={form.formState.errors.name?.message}
          required
        />
        <Textarea
          label="Description"
          {...form.register("description")}
          error={form.formState.errors.description?.message}
          autosize
          minRows={2}
        />
        <Controller
          control={form.control}
          name="permissions"
          render={({ field, fieldState }) => (
            <MultiSelect
              label="Global permission grants"
              description="Use these for shared team capabilities. Keep patient/object visibility in SpiceDB resource scope."
              data={PERMISSION_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              searchable
              clearable
              maxDropdownHeight={320}
              nothingFoundMessage="No permissions found"
            />
          )}
        />
        <Group justify="flex-end" mt="sm">
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            type="submit"
            loading={createMutation.isPending || updateMutation.isPending}
            disabled={!form.formState.isValid}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Inline members panel ────────────────────────────────────────────

function GroupMembersPanel({ group, onClose }: { group: GroupRow; onClose: () => void }) {
  const qc = useQueryClient();
  const form = useForm<AccessGroupMemberFormInput>({
    resolver: zodResolver(accessGroupMemberFormSchema),
    defaultValues: defaultAccessGroupMemberFormValues,
    mode: "onTouched",
  });

  const usersQuery = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => adminAccessService.listUsers(),
  });

  const membersQuery = useQuery({
    queryKey: ["access-group-members", group.id],
    queryFn: () => adminAccessService.listAccessGroupMembers(group.id),
  });

  const addMutation = useMutation({
    mutationFn: (values: AccessGroupMemberFormInput) =>
      adminAccessService.addAccessGroupMember(group.id, accessGroupMemberFormToRequest(values)),
    onSuccess: () => {
      notifications.show({ message: "Member added", color: "green" });
      qc.invalidateQueries({ queryKey: ["access-group-members", group.id] });
      form.reset(defaultAccessGroupMemberFormValues);
    },
    onError: (e: Error) => notifications.show({ message: e.message, color: "red" }),
  });

  const removeMutation = useMutation({
    mutationFn: (uid: string) => adminAccessService.removeAccessGroupMember(group.id, uid),
    onSuccess: () => {
      notifications.show({ message: "Member removed", color: "green" });
      qc.invalidateQueries({ queryKey: ["access-group-members", group.id] });
    },
    onError: (e: Error) => notifications.show({ message: e.message, color: "red" }),
  });

  return (
    <Card withBorder padding="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Title order={4}>{group.name} members</Title>
            <Text size="sm" c="dimmed">
              Membership writes bump permission versions and publish access_group member tuples for
              SpiceDB-backed resource scope.
            </Text>
          </Stack>
          <Button
            tone="secondary"
            onClick={() => {
              form.reset(defaultAccessGroupMemberFormValues);
              onClose();
            }}
          >
            Close
          </Button>
        </Group>

        <Stack gap="sm">
          <Title order={5}>Add member</Title>
          <Stack
            component="form"
            gap="sm"
            onSubmit={form.handleSubmit((values) => addMutation.mutate(values))}
          >
            <Controller
              control={form.control}
              name="user_id"
              render={({ field, fieldState }) => (
                <Select
                  label="User"
                  data={(usersQuery.data ?? []).map((u) => ({
                    value: u.id,
                    label: `${u.full_name} (${u.username}, ${u.role})`,
                  }))}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={fieldState.error?.message}
                  searchable
                  clearable
                />
              )}
            />
            <Controller
              control={form.control}
              name="expires_at"
              render={({ field, fieldState }) => (
                <DateTimePicker
                  label="Expires at (optional)"
                  description="Leave blank for permanent membership."
                  value={field.value}
                  onChange={(value) => field.onChange(value ? new Date(value) : null)}
                  error={fieldState.error?.message}
                  clearable
                />
              )}
            />
            <Group justify="flex-end">
              <Button
                tone="primary"
                type="submit"
                loading={addMutation.isPending}
                disabled={!form.formState.isValid}
              >
                Add
              </Button>
            </Group>
          </Stack>
        </Stack>

        <Stack gap="sm">
          <Title order={5}>Current members</Title>
          {membersQuery.data && membersQuery.data.length > 0 ? (
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Expires</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {membersQuery.data.map((m) => (
                  <Table.Tr key={m.user_id}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {m.full_name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        @{m.username}
                      </Text>
                    </Table.Td>
                    <Table.Td>{m.role}</Table.Td>
                    <Table.Td>
                      {m.expires_at ? new Date(m.expires_at).toLocaleString() : "permanent"}
                    </Table.Td>
                    <Table.Td>
                      <Button
                        tone="subtle-danger"
                        size="xs"
                        onClick={() => removeMutation.mutate(m.user_id)}
                        loading={removeMutation.isPending}
                      >
                        Remove
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text c="dimmed" size="sm">
              No members yet. Add users above to grant them this group's permissions.
            </Text>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
