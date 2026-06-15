import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Menu, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { AdminCreateRoleFormInput, EditRoleFormInput } from "@medbrains/schemas";
import { adminCreateRoleFormSchema, editRoleFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CustomRole } from "@medbrains/types";
import { P, ROLE_TEMPLATES } from "@medbrains/types";
import { IconDots, IconEdit, IconPlus, IconShield, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { PageHeader } from "@/components";
import { OfflineWriteBanner } from "@/components/OfflineWriteBanner";
import { Badge, Button, IconButton, Table } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { adminAccessService } from "@/services/adminAccess.service";

// ── Edit Role Modal ────────────────────────────────────────

function EditRoleModal({
  opened,
  onClose,
  role,
}: {
  opened: boolean;
  onClose: () => void;
  role: CustomRole | null;
}) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EditRoleFormInput>({
    resolver: zodResolver(editRoleFormSchema),
    defaultValues: {
      name: role?.name ?? "",
      description: role?.description ?? "",
    },
    mode: "onTouched",
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; description?: string }) => {
      if (!role) throw new Error("No role selected");
      return adminAccessService.updateRole(role.id, data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      onClose();
    },
  });

  const submitRole = handleSubmit((values) => {
    updateMutation.mutate({
      name: values.name.trim(),
      description: values.description.trim() || undefined,
    });
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Edit Role" size="md">
      <Stack gap="sm">
        <TextInput label="Code" value={role?.code ?? ""} disabled />
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextInput
              label="Name"
              placeholder="Role name"
              value={field.value}
              onChange={field.onChange}
              error={errors.name?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <TextInput
              label="Description"
              placeholder="Optional description"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        {updateMutation.isError && (
          <Text size="sm" c="danger">
            {updateMutation.error.message}
          </Text>
        )}

        <Group justify="flex-end" gap="sm" mt="md">
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            onClick={() => void submitRole()}
            loading={updateMutation.isPending}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Create Role Modal ──────────────────────────────────────

function CreateRoleModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdminCreateRoleFormInput>({
    resolver: zodResolver(adminCreateRoleFormSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      template: null,
    },
    mode: "onTouched",
  });

  const createMutation = useMutation({
    mutationFn: (values: AdminCreateRoleFormInput) => {
      const templatePerms = values.template
        ? ROLE_TEMPLATES[values.template]?.permissions
        : undefined;
      const permissions = templatePerms
        ? templatePerms.reduce<Record<string, unknown>>((acc, p) => {
            acc[p] = true;
            return acc;
          }, {})
        : {};
      return adminAccessService.createRole({
        code: values.code.trim(),
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        permissions,
      });
    },
    onSuccess: async (newRole, values) => {
      // If a template was selected, also update the permissions as an array
      if (values.template) {
        const templatePerms = ROLE_TEMPLATES[values.template]?.permissions ?? [];
        await adminAccessService.updateRolePermissions(newRole.id, templatePerms);
      }
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      reset();
      onClose();
    },
  });

  const templateOptions = Object.entries(ROLE_TEMPLATES).map(([key, val]) => ({
    value: key,
    label: `${val.label} (${val.permissions.length} permissions)`,
  }));

  const submitRole = handleSubmit((values) => {
    createMutation.mutate(values);
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Create Role" size="md">
      <Stack gap="md">
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <TextInput
              label="Role Code"
              placeholder="e.g. senior_nurse"
              value={field.value}
              onChange={field.onChange}
              error={errors.code?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextInput
              label="Role Name"
              placeholder="e.g. Senior Nurse"
              value={field.value}
              onChange={field.onChange}
              error={errors.name?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <TextInput
              label="Description"
              placeholder="Optional description"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="template"
          render={({ field }) => (
            <Select
              label="Permission Template"
              placeholder="Start with a template (optional)"
              data={templateOptions}
              value={field.value}
              onChange={field.onChange}
              clearable
            />
          )}
        />

        {createMutation.isError && (
          <Text size="sm" c="danger">
            {createMutation.error.message}
          </Text>
        )}

        <Group justify="flex-end" gap="sm">
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            onClick={() => void submitRole()}
            loading={createMutation.isPending}
          >
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Main Roles Page ─────────────────────────────────────────

export function RolesPage() {
  useRequirePermission(P.ADMIN.ROLES.LIST);
  const canCreate = useHasPermission(P.ADMIN.ROLES.CREATE);
  const canUpdate = useHasPermission(P.ADMIN.ROLES.UPDATE);
  const canDelete = useHasPermission(P.ADMIN.ROLES.DELETE);
  const navigate = useNavigate();

  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);

  const queryClient = useQueryClient();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => adminAccessService.listRoles(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAccessService.deleteRole(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });

  const handleEditPermissions = (role: CustomRole) => {
    navigate(`/admin/settings?role=${encodeURIComponent(role.id)}#access-matrix`);
  };

  const handleEditRole = (role: CustomRole) => {
    setEditingRole(role);
    openEditModal();
  };

  const getPermissionCount = (role: CustomRole): number => {
    if (Array.isArray(role.permissions)) {
      return role.permissions.length;
    }
    if (role.permissions && typeof role.permissions === "object") {
      return Object.keys(role.permissions).length;
    }
    return 0;
  };

  return (
    <div>
      <PageHeader title="Roles & Permissions" subtitle="Manage roles and assign permissions" />
      <OfflineWriteBanner resource="role permission" />

      <Group justify="flex-end" mb="md">
        <Button
          tone="primary"
          leftSection={<IconPlus size={16} />}
          onClick={openCreate}
          disabled={!canCreate}
        >
          Add Role
        </Button>
      </Group>

      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Code</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Description</Table.Th>
            <Table.Th>Permissions</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th w={80}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed" size="sm" ta="center">
                  Loading...
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
          {roles.map((role) => (
            <Table.Tr key={role.id}>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {role.code}
                </Text>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Text size="sm">{role.name}</Text>
                  {role.is_system && (
                    <Badge size="xs" tone="primary">
                      System
                    </Badge>
                  )}
                </Group>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed" lineClamp={1}>
                  {role.description ?? "-"}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge
                  size="sm"
                  tone={getPermissionCount(role) > 0 ? "success" : "neutral"}
                  style={{ cursor: canUpdate ? "pointer" : "default" }}
                  onClick={() => canUpdate && handleEditPermissions(role)}
                >
                  {getPermissionCount(role)} permissions
                </Badge>
              </Table.Td>
              <Table.Td>
                <Badge size="sm" tone={role.is_active ? "success" : "danger"}>
                  {role.is_active ? "Active" : "Inactive"}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Menu shadow="md" width={160}>
                  <Menu.Target>
                    <IconButton tone="default" size="sm" aria-label="More actions">
                      <IconDots size={16} />
                    </IconButton>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconShield size={14} />}
                      onClick={() => handleEditPermissions(role)}
                      disabled={!canUpdate}
                    >
                      Permissions
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconEdit size={14} />}
                      onClick={() => handleEditRole(role)}
                      disabled={!canUpdate}
                    >
                      Edit Role
                    </Menu.Item>
                    {!role.is_system && (
                      <Menu.Item
                        leftSection={<IconTrash size={14} />}
                        color="danger"
                        onClick={() => deleteMutation.mutate(role.id)}
                        disabled={!canDelete}
                      >
                        Delete
                      </Menu.Item>
                    )}
                  </Menu.Dropdown>
                </Menu>
              </Table.Td>
            </Table.Tr>
          ))}
          {!isLoading && roles.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed" size="sm" ta="center">
                  No roles found
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <CreateRoleModal opened={createOpened} onClose={closeCreate} />
      {editModalOpened && (
        <EditRoleModal
          key={editingRole?.id ?? "edit-role"}
          opened={editModalOpened}
          onClose={closeEditModal}
          role={editingRole}
        />
      )}
    </div>
  );
}
