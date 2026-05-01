import {
  Accordion,
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Drawer,
  Group,
  Menu,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type { CustomRole, FieldAccessLevel, FieldMasterFull, PermissionGroup, WidgetAccessLevel, WidgetTemplate } from "@medbrains/types";
import { useRequirePermission } from "../../hooks/useRequirePermission";
import {
  P,
  PERMISSIONS,
  ROLE_TEMPLATES,
  buildPermissionTree,
} from "@medbrains/types";
import {
  IconDots,
  IconEdit,
  IconLayout,
  IconPlus,
  IconSearch,
  IconShield,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { PageHeader } from "../../components";
import { OfflineWriteBanner } from "../../components/OfflineWriteBanner";

// ── Permission Tree Components ──────────────────────────────

function countSelected(group: PermissionGroup, selected: Set<string>): { total: number; checked: number } {
  let total = group.permissions.length;
  let checked = group.permissions.filter((p) => selected.has(p.code)).length;
  for (const child of group.children) {
    const sub = countSelected(child, selected);
    total += sub.total;
    checked += sub.checked;
  }
  return { total, checked };
}

function getAllCodes(group: PermissionGroup): string[] {
  const codes: string[] = group.permissions.map((p) => p.code);
  for (const child of group.children) {
    codes.push(...getAllCodes(child));
  }
  return codes;
}

function PermissionGroupNode({
  group,
  selected,
  onToggle,
  filter,
}: {
  group: PermissionGroup;
  selected: Set<string>;
  onToggle: (codes: string[], checked: boolean) => void;
  filter: string;
}) {
  const { total, checked } = countSelected(group, selected);
  const allCodes = useMemo(() => getAllCodes(group), [group]);

  // Filter: if there's a filter, check if any permissions match
  const matchesFilter = useMemo(() => {
    if (!filter) return true;
    const lower = filter.toLowerCase();
    return allCodes.some((code) => {
      const perm = PERMISSIONS.find((p) => p.code === code);
      return (
        code.toLowerCase().includes(lower) ||
        (perm?.label.toLowerCase().includes(lower) ?? false)
      );
    });
  }, [filter, allCodes]);

  if (!matchesFilter) return null;

  const indeterminate = checked > 0 && checked < total;
  const allChecked = total > 0 && checked === total;

  return (
    <Accordion.Item value={group.key}>
      <Accordion.Control>
        <Group gap="sm">
          <Checkbox
            checked={allChecked}
            indeterminate={indeterminate}
            onChange={(e) => {
              e.stopPropagation();
              onToggle(allCodes, e.currentTarget.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            size="sm"
          />
          <Text size="sm" fw={500}>{group.label}</Text>
          <Badge size="xs" variant="light" color={checked === total ? "success" : "slate"}>
            {checked}/{total}
          </Badge>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="xs" pl="md">
          {group.permissions.map((perm) => {
            if (filter) {
              const lower = filter.toLowerCase();
              if (
                !perm.code.toLowerCase().includes(lower) &&
                !perm.label.toLowerCase().includes(lower)
              ) {
                return null;
              }
            }
            return (
              <Checkbox
                key={perm.code}
                label={
                  <Tooltip label={perm.description} position="right" withArrow>
                    <Text size="sm">
                      {perm.label}{" "}
                      <Text span size="xs" c="dimmed">
                        ({perm.code.split(".").pop()})
                      </Text>
                    </Text>
                  </Tooltip>
                }
                checked={selected.has(perm.code)}
                onChange={(e) => onToggle([perm.code], e.currentTarget.checked)}
                size="sm"
              />
            );
          })}
          {group.children.map((child) => (
            <PermissionGroupNode
              key={child.key}
              group={child}
              selected={selected}
              onToggle={onToggle}
              filter={filter}
            />
          ))}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

// ── Permission Editor Drawer ────────────────────────────────

function PermissionEditor({
  role,
  opened,
  onClose,
}: {
  role: CustomRole | null;
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission(P.ADMIN.ROLES.UPDATE);

  // Initialize selected from the role's permissions
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  // Field access defaults state
  const [fieldAccess, setFieldAccess] = useState<Record<string, FieldAccessLevel>>({});
  const [fieldFilter, setFieldFilter] = useState("");

  // Widget access defaults state
  const [widgetAccess, setWidgetAccess] = useState<Record<string, WidgetAccessLevel>>({});
  const [widgetFilter, setWidgetFilter] = useState("");

  const allFields: FieldMasterFull[] = [];
  const widgetTemplates: WidgetTemplate[] = [];

  // Sync state when role changes
  const [loadedRoleId, setLoadedRoleId] = useState<string | null>(null);
  if (role && role.id !== loadedRoleId) {
    setLoadedRoleId(role.id);
    // Parse permissions from the role's permissions field (JSON array)
    const perms = Array.isArray(role.permissions)
      ? (role.permissions as string[])
      : [];
    setSelected(new Set(perms));
    setFilter("");
    // Initialize field access from role defaults
    setFieldAccess(role.field_access_defaults ?? {});
    setFieldFilter("");
    // Initialize widget access from role defaults
    setWidgetAccess((role.widget_access_defaults ?? {}) as Record<string, WidgetAccessLevel>);
    setWidgetFilter("");
  }

  const tree = useMemo(() => buildPermissionTree(PERMISSIONS), []);

  const handleToggle = useCallback((codes: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const code of codes) {
        if (checked) {
          next.add(code);
        } else {
          next.delete(code);
        }
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelected(new Set(PERMISSIONS.map((p) => p.code)));
      } else {
        setSelected(new Set());
      }
    },
    [],
  );

  // Group fields by module (derived from db_table)
  const fieldsByModule = useMemo(() => {
    const groups: Record<string, FieldMasterFull[]> = {};
    for (const field of allFields) {
      const module = field.db_table ?? "general";
      if (!groups[module]) {
        groups[module] = [];
      }
      groups[module].push(field);
    }
    // Sort module keys alphabetically
    const sorted: Record<string, FieldMasterFull[]> = {};
    for (const key of Object.keys(groups).sort()) {
      sorted[key] = groups[key] ?? [];
    }
    return sorted;
  }, [allFields]);

  // Filter fields by search
  const filteredFieldsByModule = useMemo(() => {
    if (!fieldFilter) return fieldsByModule;
    const lower = fieldFilter.toLowerCase();
    const result: Record<string, FieldMasterFull[]> = {};
    for (const [module, fields] of Object.entries(fieldsByModule)) {
      const matched = fields.filter(
        (f) =>
          f.name.toLowerCase().includes(lower) ||
          f.code.toLowerCase().includes(lower) ||
          module.toLowerCase().includes(lower),
      );
      if (matched.length > 0) {
        result[module] = matched;
      }
    }
    return result;
  }, [fieldsByModule, fieldFilter]);

  // Count overrides (fields not set to "edit")
  const overrideCount = useMemo(() => {
    return Object.values(fieldAccess).filter((v) => v !== "edit").length;
  }, [fieldAccess]);

  const handleFieldAccessChange = useCallback((fieldKey: string, level: FieldAccessLevel) => {
    setFieldAccess((prev) => {
      const next = { ...prev };
      if (level === "edit") {
        // "edit" is the default; remove from map to keep it clean
        delete next[fieldKey];
      } else {
        next[fieldKey] = level;
      }
      return next;
    });
  }, []);

  // Widget access helpers
  const templatesByCategory = useMemo(() => {
    const groups: Record<string, WidgetTemplate[]> = {};
    for (const tmpl of widgetTemplates) {
      const cat = tmpl.category || "general";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(tmpl);
    }
    return groups;
  }, [widgetTemplates]);

  const filteredTemplatesByCategory = useMemo(() => {
    if (!widgetFilter) return templatesByCategory;
    const lower = widgetFilter.toLowerCase();
    const result: Record<string, WidgetTemplate[]> = {};
    for (const [cat, tmpls] of Object.entries(templatesByCategory)) {
      const matched = tmpls.filter(
        (t) =>
          t.name.toLowerCase().includes(lower) ||
          cat.toLowerCase().includes(lower),
      );
      if (matched.length > 0) result[cat] = matched;
    }
    return result;
  }, [templatesByCategory, widgetFilter]);

  const widgetOverrideCount = useMemo(() => {
    return Object.keys(widgetAccess).length;
  }, [widgetAccess]);

  const handleWidgetAccessChange = useCallback((templateId: string, level: string) => {
    setWidgetAccess((prev) => {
      const next = { ...prev };
      if (level === "default") {
        // Remove explicit override — fall back to permission-based check
        delete next[templateId];
      } else {
        next[templateId] = level as WidgetAccessLevel;
      }
      return next;
    });
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!role) return;
      await Promise.all([
        api.updateRolePermissions(role.id, [...selected]),
        api.updateRoleFieldAccess(role.id, fieldAccess),
        api.updateRoleWidgetAccess(role.id, widgetAccess),
      ]);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      onClose();
    },
  });

  const allSelected = selected.size === PERMISSIONS.length;
  const someSelected = selected.size > 0 && !allSelected;

  // Build default open values for accordion
  const accordionValues = useMemo(
    () => tree.map((g) => g.key),
    [tree],
  );

  // Module accordion default values for field access
  const fieldModuleKeys = useMemo(
    () => Object.keys(filteredFieldsByModule),
    [filteredFieldsByModule],
  );

  // Widget category accordion default values
  const widgetCategoryKeys = useMemo(
    () => Object.keys(filteredTemplatesByCategory),
    [filteredTemplatesByCategory],
  );

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconShield size={20} />
          <Text fw={600}>{role?.name ?? "Permissions"}</Text>
        </Group>
      }
      size="100%"
      position="right"
      padding="md"
    >
      <Stack gap="md" h="calc(100vh - 140px)">
        <TextInput
          placeholder="Filter permissions..."
          leftSection={<IconSearch size={16} />}
          value={filter}
          onChange={(e) => setFilter(e.currentTarget.value)}
          size="sm"
        />

        <Group gap="xs">
          <Checkbox
            label="Select All"
            checked={allSelected}
            indeterminate={someSelected}
            onChange={(e) => handleSelectAll(e.currentTarget.checked)}
            size="sm"
          />
          <Badge size="sm" variant="light">
            {selected.size}/{PERMISSIONS.length}
          </Badge>
        </Group>

        <Box style={{ flex: 1, overflow: "auto" }}>
          <Accordion
            multiple
            defaultValue={accordionValues}
            variant="separated"
            chevronPosition="left"
          >
            {tree.map((group) => (
              <PermissionGroupNode
                key={group.key}
                group={group}
                selected={selected}
                onToggle={handleToggle}
                filter={filter}
              />
            ))}
          </Accordion>

          {/* ── Field Access Defaults Section ── */}
          <Divider
            my="lg"
            label={
              <Group gap="xs">
                <Text size="sm" fw={600}>Field Access Defaults</Text>
                {overrideCount > 0 && (
                  <Badge size="xs" variant="light" color="orange">
                    {overrideCount} override{overrideCount !== 1 ? "s" : ""}
                  </Badge>
                )}
              </Group>
            }
            labelPosition="left"
          />

          <TextInput
            placeholder="Filter fields..."
            leftSection={<IconSearch size={16} />}
            value={fieldFilter}
            onChange={(e) => setFieldFilter(e.currentTarget.value)}
            size="sm"
            mb="sm"
          />

          {allFields.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No fields configured yet.
            </Text>
          ) : Object.keys(filteredFieldsByModule).length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No fields match the filter.
            </Text>
          ) : (
            <Accordion
              multiple
              defaultValue={fieldModuleKeys}
              variant="separated"
              chevronPosition="left"
            >
              {Object.entries(filteredFieldsByModule).map(([module, fields]) => (
                <Accordion.Item key={module} value={module}>
                  <Accordion.Control>
                    <Group gap="sm">
                      <Text size="sm" fw={500} tt="capitalize">
                        {module}
                      </Text>
                      <Badge size="xs" variant="light" color="slate">
                        {fields.length} field{fields.length !== 1 ? "s" : ""}
                      </Badge>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="xs">
                      {fields.map((field) => {
                        const fieldKey = `${module}.${field.code}`;
                        const currentLevel = fieldAccess[fieldKey] ?? "edit";
                        return (
                          <Group key={field.id} justify="space-between" wrap="nowrap" gap="sm">
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              <Text size="sm" truncate>
                                {field.name}
                              </Text>
                              {field.description && (
                                <Text size="xs" c="dimmed" truncate>
                                  {field.description}
                                </Text>
                              )}
                            </Box>
                            <SegmentedControl
                              size="xs"
                              value={currentLevel}
                              onChange={(val) =>
                                handleFieldAccessChange(fieldKey, val as FieldAccessLevel)
                              }
                              data={[
                                { label: "Edit", value: "edit" },
                                { label: "View", value: "view" },
                                { label: "Hidden", value: "hidden" },
                              ]}
                            />
                          </Group>
                        );
                      })}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          )}

          {/* ── Widget Access Defaults Section ── */}
          <Divider
            my="lg"
            label={
              <Group gap="xs">
                <IconLayout size={14} />
                <Text size="sm" fw={600}>Widget Access Defaults</Text>
                {widgetOverrideCount > 0 && (
                  <Badge size="xs" variant="light" color="violet">
                    {widgetOverrideCount} set
                  </Badge>
                )}
              </Group>
            }
            labelPosition="left"
          />

          <Text size="xs" c="dimmed" mb="sm">
            Control which dashboard widgets this role can see. "Default" falls back to
            the template's required permissions.
          </Text>

          <TextInput
            placeholder="Filter widgets..."
            leftSection={<IconSearch size={16} />}
            value={widgetFilter}
            onChange={(e) => setWidgetFilter(e.currentTarget.value)}
            size="sm"
            mb="sm"
          />

          {widgetTemplates.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No widget templates configured yet.
            </Text>
          ) : Object.keys(filteredTemplatesByCategory).length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No widgets match the filter.
            </Text>
          ) : (
            <Accordion
              multiple
              defaultValue={widgetCategoryKeys}
              variant="separated"
              chevronPosition="left"
            >
              {Object.entries(filteredTemplatesByCategory).map(([category, templates]) => (
                <Accordion.Item key={category} value={category}>
                  <Accordion.Control>
                    <Group gap="sm">
                      <Text size="sm" fw={500} tt="capitalize">
                        {category}
                      </Text>
                      <Badge size="xs" variant="light" color="slate">
                        {templates.length} widget{templates.length !== 1 ? "s" : ""}
                      </Badge>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="xs">
                      {templates.map((tmpl) => {
                        const currentLevel = widgetAccess[tmpl.id] ?? "default";
                        return (
                          <Group key={tmpl.id} justify="space-between" wrap="nowrap" gap="sm">
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              <Text size="sm" truncate>
                                {tmpl.name}
                              </Text>
                              {tmpl.description && (
                                <Text size="xs" c="dimmed" truncate>
                                  {tmpl.description}
                                </Text>
                              )}
                            </Box>
                            <SegmentedControl
                              size="xs"
                              value={currentLevel}
                              onChange={(val) => handleWidgetAccessChange(tmpl.id, val)}
                              data={[
                                { label: "Default", value: "default" },
                                { label: "Visible", value: "visible" },
                                { label: "Hidden", value: "hidden" },
                              ]}
                            />
                          </Group>
                        );
                      })}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </Box>

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={!canUpdate}
          >
            Save Permissions
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}

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

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);

  if (role && role.id !== loadedId) {
    setLoadedId(role.id);
    setName(role.name);
    setDescription(role.description ?? "");
  }

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; description?: string }) =>
      api.updateRole(role!.id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      setLoadedId(null);
      onClose();
    },
  });

  const handleClose = () => {
    setLoadedId(null);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Edit Role" size="md">
      <Stack gap="sm">
        <TextInput label="Code" value={role?.code ?? ""} disabled />
        <TextInput
          label="Name"
          placeholder="Role name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Description"
          placeholder="Optional description"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />

        {updateMutation.isError && (
          <Text size="sm" c="danger">
            {updateMutation.error.message}
          </Text>
        )}

        <Group justify="flex-end" gap="sm" mt="md">
          <Button variant="default" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              updateMutation.mutate({
                name: name || undefined,
                description: description || undefined,
              })
            }
            loading={updateMutation.isPending}
            disabled={!name.trim()}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Create Role Modal ──────────────────────────────────────

function CreateRoleModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => {
      const templatePerms = template ? ROLE_TEMPLATES[template]?.permissions : undefined;
      const permissions = templatePerms
        ? templatePerms.reduce<Record<string, unknown>>((acc, p) => {
            acc[p] = true;
            return acc;
          }, {})
        : {};
      return api.createRole({ code, name, description: description || undefined, permissions });
    },
    onSuccess: async (newRole) => {
      // If a template was selected, also update the permissions as an array
      if (template) {
        const templatePerms = ROLE_TEMPLATES[template]?.permissions ?? [];
        await api.updateRolePermissions(newRole.id, templatePerms);
      }
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      setCode("");
      setName("");
      setDescription("");
      setTemplate(null);
      onClose();
    },
  });

  const templateOptions = Object.entries(ROLE_TEMPLATES).map(([key, val]) => ({
    value: key,
    label: `${val.label} (${val.permissions.length} permissions)`,
  }));

  return (
    <Modal opened={opened} onClose={onClose} title="Create Role" size="md">
      <Stack gap="md">
        <TextInput
          label="Role Code"
          placeholder="e.g. senior_nurse"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Role Name"
          placeholder="e.g. Senior Nurse"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Description"
          placeholder="Optional description"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <Select
          label="Permission Template"
          placeholder="Start with a template (optional)"
          data={templateOptions}
          value={template}
          onChange={setTemplate}
          clearable
        />

        {createMutation.isError && (
          <Text size="sm" c="danger">
            {createMutation.error.message}
          </Text>
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            loading={createMutation.isPending}
            disabled={!code.trim() || !name.trim()}
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

  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [editorOpened, { open: openEditor, close: closeEditor }] = useDisclosure(false);
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);

  const queryClient = useQueryClient();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.listRoles(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteRole(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });

  const handleEditPermissions = (role: CustomRole) => {
    setSelectedRole(role);
    openEditor();
  };

  const handleEditRole = (role: CustomRole) => {
    setEditingRole(role);
    openEditModal();
  };

  const getPermissionCount = (role: CustomRole): number => {
    if (Array.isArray(role.permissions)) {
      return (role.permissions as unknown[]).length;
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
                <Text c="dimmed" size="sm" ta="center">Loading...</Text>
              </Table.Td>
            </Table.Tr>
          )}
          {roles.map((role) => (
            <Table.Tr key={role.id}>
              <Table.Td>
                <Text size="sm" fw={500}>{role.code}</Text>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Text size="sm">{role.name}</Text>
                  {role.is_system && (
                    <Badge size="xs" variant="light" color="primary">System</Badge>
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
                  variant="light"
                  color={getPermissionCount(role) > 0 ? "success" : "slate"}
                  style={{ cursor: canUpdate ? "pointer" : "default" }}
                  onClick={() => canUpdate && handleEditPermissions(role)}
                >
                  {getPermissionCount(role)} permissions
                </Badge>
              </Table.Td>
              <Table.Td>
                <Badge
                  size="sm"
                  variant="light"
                  color={role.is_active ? "success" : "danger"}
                >
                  {role.is_active ? "Active" : "Inactive"}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Menu shadow="md" width={160}>
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="slate" size="sm" aria-label="More actions">
                      <IconDots size={16} />
                    </ActionIcon>
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
                <Text c="dimmed" size="sm" ta="center">No roles found</Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <CreateRoleModal opened={createOpened} onClose={closeCreate} />
      <EditRoleModal opened={editModalOpened} onClose={closeEditModal} role={editingRole} />
      <PermissionEditor
        role={selectedRole}
        opened={editorOpened}
        onClose={closeEditor}
      />
    </div>
  );
}
