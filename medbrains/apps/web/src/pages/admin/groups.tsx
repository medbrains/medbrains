/**
 * Access Groups admin — `/admin/groups`.
 *
 * CRUD for `access_groups` + member management. Each membership write
 * bumps `users.perm_version` and emits a SpiceDB tuple (or attempts to
 * — Watch consumer reconciles eventually if SpiceDB was briefly down).
 */

import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { IconPencil, IconPlus, IconTrash, IconUsers } from "@tabler/icons-react";
import { api } from "@medbrains/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { PageHeader } from "../../components";
import { useRequirePermission } from "../../hooks/useRequirePermission";

interface GroupRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export default function GroupsPage() {
  useRequirePermission("admin.users.list");

  const qc = useQueryClient();
  const [editTarget, setEditTarget] = useState<GroupRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [memberDrawerGroup, setMemberDrawerGroup] = useState<GroupRow | null>(null);

  const groupsQuery = useQuery({
    queryKey: ["access-groups"],
    queryFn: () => api.listAccessGroups(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAccessGroup(id),
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
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
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
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(groupsQuery.data ?? []).map((g) => (
            <Table.Tr key={g.id}>
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
                <Badge color={g.is_active ? "green" : "gray"} variant="light">
                  {g.is_active ? "active" : "deactivated"}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Tooltip label="Members">
                    <ActionIcon
                      variant="subtle"
                      onClick={() => setMemberDrawerGroup(g)}
                    >
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
        opened={createOpen || editTarget !== null}
        onClose={() => {
          setCreateOpen(false);
          setEditTarget(null);
        }}
        target={editTarget}
      />

      <GroupMembersDrawer
        group={memberDrawerGroup}
        onClose={() => setMemberDrawerGroup(null)}
      />
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
  const [code, setCode] = useState(target?.code ?? "");
  const [name, setName] = useState(target?.name ?? "");
  const [description, setDescription] = useState(target?.description ?? "");

  const reset = () => {
    setCode(target?.code ?? "");
    setName(target?.name ?? "");
    setDescription(target?.description ?? "");
  };

  // Sync state when target changes (e.g. opening edit on a different row)
  if (target && target.code !== code && code === "") {
    reset();
  }

  const createMutation = useMutation({
    mutationFn: () =>
      api.createAccessGroup({
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      notifications.show({ message: "Group created", color: "green" });
      qc.invalidateQueries({ queryKey: ["access-groups"] });
      onClose();
    },
    onError: (e: Error) => notifications.show({ message: e.message, color: "red" }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateAccessGroup(target!.id, {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
      }),
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
      size="md"
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          description="Stable identifier — used in role policies + SpiceDB. e.g. lab_seniors, code_blue_team"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
          disabled={isEdit}
          required
        />
        <TextInput
          label="Display name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Textarea
          label="Description"
          value={description ?? ""}
          onChange={(e) => setDescription(e.currentTarget.value)}
          autosize
          minRows={2}
        />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => (isEdit ? updateMutation.mutate() : createMutation.mutate())}
            loading={createMutation.isPending || updateMutation.isPending}
            disabled={!code.trim() || !name.trim()}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Members drawer ─────────────────────────────────────────────────

function GroupMembersDrawer({
  group,
  onClose,
}: {
  group: GroupRow | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  const usersQuery = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => api.listSetupUsers(),
    enabled: !!group,
  });

  const membersQuery = useQuery({
    queryKey: ["access-group-members", group?.id],
    queryFn: () => api.listAccessGroupMembers(group!.id),
    enabled: !!group,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      api.addAccessGroupMember(group!.id, {
        user_id: userId!,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
      }),
    onSuccess: () => {
      notifications.show({ message: "Member added", color: "green" });
      qc.invalidateQueries({ queryKey: ["access-group-members", group?.id] });
      setUserId(null);
      setExpiresAt(null);
    },
    onError: (e: Error) => notifications.show({ message: e.message, color: "red" }),
  });

  const removeMutation = useMutation({
    mutationFn: (uid: string) => api.removeAccessGroupMember(group!.id, uid),
    onSuccess: () => {
      notifications.show({ message: "Member removed", color: "green" });
      qc.invalidateQueries({ queryKey: ["access-group-members", group?.id] });
    },
    onError: (e: Error) => notifications.show({ message: e.message, color: "red" }),
  });

  return (
    <Drawer
      opened={group !== null}
      onClose={onClose}
      position="right"
      size="lg"
      title={<Title order={4}>{group?.name} — members</Title>}
    >
      <Stack gap="md">
        <Stack gap="sm">
          <Title order={5}>Add member</Title>
          <Select
            label="User"
            data={(usersQuery.data ?? []).map((u) => ({
              value: u.id,
              label: `${u.full_name} (${u.username}, ${u.role})`,
            }))}
            value={userId}
            onChange={setUserId}
            searchable
            clearable
          />
          <DateTimePicker
            label="Expires at (optional)"
            description="Leave blank for permanent membership."
            value={expiresAt}
            onChange={(v) => setExpiresAt(v ? new Date(v) : null)}
            clearable
          />
          <Group justify="flex-end">
            <Button
              onClick={() => addMutation.mutate()}
              loading={addMutation.isPending}
              disabled={!userId}
            >
              Add
            </Button>
          </Group>
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
                        variant="subtle"
                        color="red"
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
    </Drawer>
  );
}
