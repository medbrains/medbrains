import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  AccessMatrixSurface,
  AccessMatrixSurfaceKind,
  CustomRole,
  FieldAccessLevel,
  FieldMasterFull,
  PermissionDef,
  SetupUser,
  WidgetAccessLevel,
} from "@medbrains/types";
import { ACCESS_MATRIX_SURFACES, FIELD_ACCESS_FIELDS, P, PERMISSIONS } from "@medbrains/types";
import {
  IconDeviceFloppy,
  IconSearch,
  IconShieldLock,
  IconUserShield,
  IconUsersGroup,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { usePacedQueryValue } from "../../../hooks/usePacedQueryValue";
import { adminAccessService } from "../../../services/adminAccess.service";

const FIELD_LEVELS: { label: string; value: FieldAccessLevel }[] = [
  { label: "Edit", value: "edit" },
  { label: "View", value: "view" },
  { label: "Mask", value: "mask" },
  { label: "Hidden", value: "hidden" },
];
const FIELD_OVERRIDE_LEVELS: { label: string; value: FieldOverrideLevel }[] = [
  { label: "Inherit", value: "inherit" },
  ...FIELD_LEVELS,
];
const FIELD_LEVEL_VALUES: ReadonlySet<string> = new Set(FIELD_LEVELS.map((level) => level.value));
const WIDGET_LEVEL_VALUES: ReadonlySet<string> = new Set(["visible", "hidden"]);

const CRITICAL_WORKFLOW_EXPECTATIONS: {
  key: string;
  label: string;
  modules: readonly string[];
  requiredKinds: readonly AccessMatrixSurfaceKind[];
}[] = [
  {
    key: "registration",
    label: "Patient registration",
    modules: ["patients"],
    requiredKinds: ["screen", "tab", "column", "input", "action", "print"],
  },
  {
    key: "opd",
    label: "OPD encounter",
    modules: ["opd"],
    requiredKinds: ["screen", "tab", "column", "input", "action", "print"],
  },
  {
    key: "ipd",
    label: "IPD admission",
    modules: ["ipd"],
    requiredKinds: ["screen", "tab", "input", "action", "print"],
  },
  {
    key: "emergency",
    label: "Emergency care",
    modules: ["emergency"],
    requiredKinds: ["screen", "table", "input", "action", "print"],
  },
  {
    key: "camp",
    label: "Camp workflow",
    modules: ["camp"],
    requiredKinds: ["screen", "tab", "input", "action", "print"],
  },
  {
    key: "pharmacy",
    label: "Pharmacy",
    modules: ["pharmacy"],
    requiredKinds: ["screen", "table", "column", "input", "action", "print"],
  },
  {
    key: "billing",
    label: "Billing",
    modules: ["billing"],
    requiredKinds: ["screen", "tab", "column", "action", "print"],
  },
  {
    key: "mrd",
    label: "MRD printables",
    modules: ["mrd"],
    requiredKinds: ["screen", "table", "column", "input", "action", "print"],
  },
  {
    key: "settings_reports",
    label: "Settings and reports",
    modules: ["admin", "analytics"],
    requiredKinds: ["screen", "tab", "widget"],
  },
];

type FieldOverrideLevel = FieldAccessLevel | "inherit";

type AccessGroupRow = Awaited<ReturnType<typeof adminAccessService.listAccessGroups>>[number];
type AccessGroupMemberRow = Awaited<
  ReturnType<typeof adminAccessService.listAccessGroupMembers>
>[number];
type AccessManifest = Awaited<ReturnType<typeof adminAccessService.getAccessManifest>>;

interface GroupMemberBundle {
  group: AccessGroupRow;
  members: AccessGroupMemberRow[];
}

interface GroupMemberIndex {
  byUser: Map<string, AccessGroupRow[]>;
}

function rolePermissions(role: CustomRole): Set<string> {
  if (Array.isArray(role.permissions)) {
    return new Set(
      role.permissions.filter((permission): permission is string => typeof permission === "string"),
    );
  }

  if (role.permissions && typeof role.permissions === "object") {
    return new Set(Object.keys(role.permissions).filter((key) => role.permissions[key]));
  }

  return new Set();
}

function isFieldAccessLevel(value: string): value is FieldAccessLevel {
  return FIELD_LEVEL_VALUES.has(value);
}

function parseFieldAccessLevel(value: string): FieldAccessLevel {
  return isFieldAccessLevel(value) ? value : "edit";
}

function parseFieldOverrideLevel(value: string): FieldOverrideLevel {
  return value === "inherit" ? "inherit" : parseFieldAccessLevel(value);
}

function isWidgetAccessLevel(value: string): value is WidgetAccessLevel {
  return WIDGET_LEVEL_VALUES.has(value);
}

function moduleFromPermission(code: string) {
  return code.split(".")[0] ?? "general";
}

function actionFromPermission(code: string) {
  return code.split(".").at(-1) ?? code;
}

function fieldKey(field: FieldMasterFull) {
  return `${field.db_table ?? "general"}.${field.code}`;
}

function fieldModule(field: FieldMasterFull) {
  return field.db_table ?? "general";
}

function roleOptions(roles: CustomRole[]) {
  return roles
    .filter((role) => role.is_active)
    .map((role) => ({
      value: role.id,
      label: `${role.name} (${role.code})`,
    }));
}

function userOptions(users: SetupUser[]) {
  return users
    .filter((user) => user.is_active)
    .map((user) => ({
      value: user.id,
      label: `${user.full_name} (${user.username}, ${user.role})`,
    }));
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value));
}

function matrixStringSet(matrix: Record<string, unknown>, key: string): Set<string> {
  return new Set(stringArray(matrix[key]));
}

function fieldAccessMap(value: unknown): Record<string, FieldAccessLevel> {
  const map: Record<string, FieldAccessLevel> = {};
  for (const [key, level] of Object.entries(objectRecord(value))) {
    if (typeof level === "string") {
      map[key] = parseFieldAccessLevel(level);
    }
  }
  return map;
}

function widgetAccessMap(value: unknown): Record<string, WidgetAccessLevel> {
  const map: Record<string, WidgetAccessLevel> = {};
  for (const [key, level] of Object.entries(objectRecord(value))) {
    if (typeof level === "string" && isWidgetAccessLevel(level)) {
      map[key] = level;
    }
  }
  return map;
}

function temporaryGrantIsActive(grant: unknown) {
  if (!grant || typeof grant !== "object") return false;
  const grantRecord = objectRecord(grant);
  if (typeof grantRecord.revoked_at === "string" && grantRecord.revoked_at.length > 0) {
    return false;
  }
  if (typeof grantRecord.expires_at === "string" && grantRecord.expires_at.length > 0) {
    const expiresAt = Date.parse(grantRecord.expires_at);
    return Number.isFinite(expiresAt) && expiresAt > Date.now();
  }
  return true;
}

function temporaryGrantPermissionSet(matrix: Record<string, unknown>): Set<string> {
  const grants = Array.isArray(matrix.temporary_grants) ? matrix.temporary_grants : [];
  const permissions = new Set<string>();

  for (const grant of grants) {
    if (!temporaryGrantIsActive(grant) || !grant || typeof grant !== "object") continue;
    const grantRecord = objectRecord(grant);
    for (const permission of stringArray(grantRecord.permissions)) {
      permissions.add(permission);
    }
  }

  return permissions;
}

function isBypassRole(roleCode: string) {
  return roleCode === "super_admin" || roleCode === "hospital_admin";
}

function buildRoleByCode(roles: CustomRole[]) {
  return new Map(roles.map((role) => [role.code, role]));
}

function buildGroupMemberIndex(bundles: GroupMemberBundle[]): GroupMemberIndex {
  const byUser = new Map<string, AccessGroupRow[]>();

  for (const bundle of bundles) {
    for (const member of bundle.members) {
      byUser.set(member.user_id, [...(byUser.get(member.user_id) ?? []), bundle.group]);
    }
  }

  return { byUser };
}

function groupNames(groups: AccessGroupRow[]) {
  return groups.map((group) => group.name).join(", ");
}

function groupPermissionSet(groups: AccessGroupRow[]) {
  return new Set(groups.flatMap((group) => stringArray(group.permissions)));
}

interface RoleOverlapIndex {
  permissionRoles: Map<string, CustomRole[]>;
  fieldRestrictionRoles: Map<string, CustomRole[]>;
}

function buildOverlapIndex(roles: CustomRole[]): RoleOverlapIndex {
  const permissionRoles = new Map<string, CustomRole[]>();
  const fieldRestrictionRoles = new Map<string, CustomRole[]>();

  for (const role of roles) {
    for (const permission of rolePermissions(role)) {
      permissionRoles.set(permission, [...(permissionRoles.get(permission) ?? []), role]);
    }

    for (const [key, level] of Object.entries(role.field_access_defaults ?? {})) {
      if (level !== "edit") {
        fieldRestrictionRoles.set(key, [...(fieldRestrictionRoles.get(key) ?? []), role]);
      }
    }
  }

  return { permissionRoles, fieldRestrictionRoles };
}

function roleNames(roles: CustomRole[]) {
  return roles.map((role) => role.name).join(", ");
}

function permissionLabel(code: string) {
  return PERMISSIONS.find((permission) => permission.code === code)?.label ?? code;
}

function printCopyLabel(copy: string) {
  if (copy === "duplicate") return "Duplicate/reprint";
  return `${copy.replace(/_/g, " ")} copy`;
}

function fieldByKey() {
  return new Map(FIELD_ACCESS_FIELDS.map((field) => [fieldKey(field), field]));
}

function surfaceMatches(
  surface: AccessMatrixSurface,
  query: string,
  moduleFilter: string | null,
  kindFilter: string | null,
) {
  if (moduleFilter && surface.module !== moduleFilter) return false;
  if (kindFilter && surface.kind !== kindFilter) return false;
  if (!query) return true;

  const haystack = [
    surface.id,
    surface.module,
    surface.area,
    surface.label,
    surface.kind,
    surface.route ?? "",
    surface.tab ?? "",
    surface.table ?? "",
    ...surface.requiredPermissions,
    ...surface.fieldAccessKeys,
    ...surface.activatesAfter,
    ...surface.printArtifacts,
    ...surface.printCopies,
    ...surface.printerProfiles,
    ...surface.standardRefs,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function accessSurfaceKindOptions() {
  return [...new Set(ACCESS_MATRIX_SURFACES.map((surface) => surface.kind))]
    .sort()
    .map((kind) => ({ value: kind, label: kind }));
}

function accessSurfaceModuleOptions() {
  return [...new Set(ACCESS_MATRIX_SURFACES.map((surface) => surface.module))]
    .sort()
    .map((module) => ({ value: module, label: module }));
}

function isAccessSurfaceKind(value: string): value is AccessMatrixSurfaceKind {
  return ACCESS_MATRIX_SURFACES.some((surface) => surface.kind === value);
}

function permissionMatches(permission: PermissionDef, query: string, moduleFilter: string | null) {
  if (moduleFilter && moduleFromPermission(permission.code) !== moduleFilter) {
    return false;
  }

  if (!query) {
    return true;
  }

  const haystack = [permission.code, permission.label, permission.description]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function fieldMatches(field: FieldMasterFull, query: string, moduleFilter: string | null) {
  if (moduleFilter && fieldModule(field) !== moduleFilter) {
    return false;
  }

  if (!query) {
    return true;
  }

  const haystack = [fieldKey(field), field.name, field.description ?? ""].join(" ").toLowerCase();
  return haystack.includes(query);
}

function RoleMatrixEditor({
  role,
  roles,
  canUpdate,
}: {
  role: CustomRole;
  roles: CustomRole[];
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const [permissionFilter, setPermissionFilter] = useState("");
  const pacedPermissionFilter = usePacedQueryValue(permissionFilter, 200).trim().toLowerCase();
  const [fieldFilter, setFieldFilter] = useState("");
  const pacedFieldFilter = usePacedQueryValue(fieldFilter, 200).trim().toLowerCase();
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState(() => rolePermissions(role));
  const [fieldAccess, setFieldAccess] = useState<Record<string, FieldAccessLevel>>(
    role.field_access_defaults ?? {},
  );

  const overlap = useMemo(() => buildOverlapIndex(roles), [roles]);
  const moduleOptions = useMemo(() => {
    const modules = new Set<string>();
    for (const permission of PERMISSIONS) modules.add(moduleFromPermission(permission.code));
    for (const field of FIELD_ACCESS_FIELDS) modules.add(fieldModule(field));
    return [...modules].sort().map((module) => ({ value: module, label: module }));
  }, []);

  const visiblePermissions = useMemo(
    () =>
      PERMISSIONS.filter((permission) =>
        permissionMatches(permission, pacedPermissionFilter, moduleFilter),
      ),
    [moduleFilter, pacedPermissionFilter],
  );
  const visibleFields = useMemo(
    () =>
      FIELD_ACCESS_FIELDS.filter((field) => fieldMatches(field, pacedFieldFilter, moduleFilter)),
    [moduleFilter, pacedFieldFilter],
  );

  const moduleSummaries = useMemo(() => {
    const modules = new Map<
      string,
      { total: number; selected: number; overlapping: number; restrictedFields: number }
    >();

    for (const permission of PERMISSIONS) {
      const module = moduleFromPermission(permission.code);
      const current = modules.get(module) ?? {
        total: 0,
        selected: 0,
        overlapping: 0,
        restrictedFields: 0,
      };
      current.total += 1;
      if (selectedPermissions.has(permission.code)) current.selected += 1;
      if ((overlap.permissionRoles.get(permission.code)?.length ?? 0) > 1) current.overlapping += 1;
      modules.set(module, current);
    }

    for (const field of FIELD_ACCESS_FIELDS) {
      const module = fieldModule(field);
      const current = modules.get(module) ?? {
        total: 0,
        selected: 0,
        overlapping: 0,
        restrictedFields: 0,
      };
      if ((fieldAccess[fieldKey(field)] ?? "edit") !== "edit") current.restrictedFields += 1;
      modules.set(module, current);
    }

    return [...modules.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [fieldAccess, overlap.permissionRoles, selectedPermissions]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        adminAccessService.updateRolePermissions(role.id, [...selectedPermissions]),
        adminAccessService.updateRoleFieldAccess(role.id, fieldAccess),
      ]);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      notifications.show({
        title: "Access matrix saved",
        message: `${role.name} permissions and masking defaults were updated.`,
        color: "success",
      });
    },
  });

  const togglePermission = (code: string, checked: boolean) => {
    setSelectedPermissions((previous) => {
      const next = new Set(previous);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  };

  const updateFieldAccess = (key: string, level: FieldAccessLevel) => {
    setFieldAccess((previous) => {
      const next = { ...previous };
      if (level === "edit") delete next[key];
      else next[key] = level;
      return next;
    });
  };

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Role
          </Text>
          <Text fw={700}>{role.name}</Text>
          <Text size="xs" c="dimmed">
            {role.code}
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Granted
          </Text>
          <Text fw={700}>{selectedPermissions.size}</Text>
          <Text size="xs" c="dimmed">
            of {PERMISSIONS.length} permissions
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Masking Overrides
          </Text>
          <Text fw={700}>
            {Object.values(fieldAccess).filter((level) => level !== "edit").length}
          </Text>
          <Text size="xs" c="dimmed">
            field-level defaults
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Role Overlap
          </Text>
          <Text fw={700}>
            {
              [...selectedPermissions].filter(
                (permission) => (overlap.permissionRoles.get(permission)?.length ?? 0) > 1,
              ).length
            }
          </Text>
          <Text size="xs" c="dimmed">
            shared with another role
          </Text>
        </Card>
      </SimpleGrid>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-end">
            <Group gap="sm" align="flex-end">
              <TextInput
                label="Permission search"
                placeholder="Search permission, screen, table or action"
                leftSection={<IconSearch size={14} />}
                value={permissionFilter}
                onChange={(event) => setPermissionFilter(event.currentTarget.value)}
              />
              <Select
                label="Module"
                placeholder="All modules"
                data={moduleOptions}
                value={moduleFilter}
                onChange={setModuleFilter}
                clearable
                searchable
              />
            </Group>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              disabled={!canUpdate}
            >
              Save Matrix
            </Button>
          </Group>

          <Tabs defaultValue="permissions" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="permissions">Permissions</Tabs.Tab>
              <Tabs.Tab value="masking">Field Masking</Tabs.Tab>
              <Tabs.Tab value="overlap">Overlaps</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="permissions" pt="sm">
              <ScrollArea.Autosize mah="56vh">
                <Table stickyHeader highlightOnHover verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Permission</Table.Th>
                      <Table.Th>Module</Table.Th>
                      <Table.Th>Action</Table.Th>
                      <Table.Th>Selected</Table.Th>
                      <Table.Th>Role overlap</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {visiblePermissions.map((permission) => {
                      const sharingRoles = overlap.permissionRoles.get(permission.code) ?? [];
                      return (
                        <Table.Tr key={permission.code}>
                          <Table.Td>
                            <Text size="sm" fw={600}>
                              {permission.label}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {permission.code}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light">{moduleFromPermission(permission.code)}</Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{actionFromPermission(permission.code)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <SegmentedControl
                              size="xs"
                              value={selectedPermissions.has(permission.code) ? "grant" : "deny"}
                              onChange={(value) =>
                                togglePermission(permission.code, value === "grant")
                              }
                              data={[
                                { label: "Grant", value: "grant" },
                                { label: "Deny", value: "deny" },
                              ]}
                              disabled={!canUpdate}
                            />
                          </Table.Td>
                          <Table.Td>
                            {sharingRoles.length > 1 ? (
                              <Tooltip label={roleNames(sharingRoles)} multiline w={280}>
                                <Badge color="orange" variant="light">
                                  {sharingRoles.length} roles
                                </Badge>
                              </Tooltip>
                            ) : (
                              <Badge color="gray" variant="light">
                                Unique
                              </Badge>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea.Autosize>
            </Tabs.Panel>

            <Tabs.Panel value="masking" pt="sm">
              <Stack gap="sm">
                <TextInput
                  label="Field search"
                  placeholder="Search fields, tables, inputs and sensitive values"
                  leftSection={<IconSearch size={14} />}
                  value={fieldFilter}
                  onChange={(event) => setFieldFilter(event.currentTarget.value)}
                />
                <ScrollArea.Autosize mah="52vh">
                  <Table stickyHeader highlightOnHover verticalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Field</Table.Th>
                        <Table.Th>Module</Table.Th>
                        <Table.Th>Data</Table.Th>
                        <Table.Th>Default access</Table.Th>
                        <Table.Th>Restricted in roles</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {visibleFields.map((field) => {
                        const key = fieldKey(field);
                        const restrictedRoles = overlap.fieldRestrictionRoles.get(key) ?? [];
                        return (
                          <Table.Tr key={field.id}>
                            <Table.Td>
                              <Text size="sm" fw={600}>
                                {field.name}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {key}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge variant="light">{fieldModule(field)}</Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{field.data_type}</Text>
                            </Table.Td>
                            <Table.Td>
                              <SegmentedControl
                                size="xs"
                                value={fieldAccess[key] ?? "edit"}
                                onChange={(value) =>
                                  updateFieldAccess(key, parseFieldAccessLevel(value))
                                }
                                data={FIELD_LEVELS}
                                disabled={!canUpdate}
                              />
                            </Table.Td>
                            <Table.Td>
                              {restrictedRoles.length > 0 ? (
                                <Tooltip label={roleNames(restrictedRoles)} multiline w={280}>
                                  <Badge color="orange" variant="light">
                                    {restrictedRoles.length} roles
                                  </Badge>
                                </Tooltip>
                              ) : (
                                <Badge color="gray" variant="light">
                                  None
                                </Badge>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </ScrollArea.Autosize>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="overlap" pt="sm">
              <Table highlightOnHover verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Module</Table.Th>
                    <Table.Th>Granted</Table.Th>
                    <Table.Th>Overlaps</Table.Th>
                    <Table.Th>Masked fields</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {moduleSummaries.map(([module, summary]) => (
                    <Table.Tr key={module}>
                      <Table.Td>
                        <Text fw={700} tt="capitalize">
                          {module}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light">
                          {summary.selected}/{summary.total}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge color="orange" variant="light">
                          {summary.overlapping}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge color="red" variant="light">
                          {summary.restrictedFields}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Card>
    </Stack>
  );
}

function EffectiveUserAccessMatrix({
  user,
  role,
  userGroups,
  canUpdate,
}: {
  user: SetupUser;
  role: CustomRole | null;
  userGroups: AccessGroupRow[];
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const [permissionFilter, setPermissionFilter] = useState("");
  const pacedPermissionFilter = usePacedQueryValue(permissionFilter, 200).trim().toLowerCase();
  const [fieldFilter, setFieldFilter] = useState("");
  const pacedFieldFilter = usePacedQueryValue(fieldFilter, 200).trim().toLowerCase();
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const bypassRole = isBypassRole(user.role);
  const rolePermissionSet = useMemo(
    () => (role ? rolePermissions(role) : new Set<string>()),
    [role],
  );
  const [extraPermissions, setExtraPermissions] = useState(() =>
    matrixStringSet(user.access_matrix, "extra"),
  );
  const [deniedPermissions, setDeniedPermissions] = useState(() =>
    matrixStringSet(user.access_matrix, "denied"),
  );
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, FieldAccessLevel>>(() =>
    fieldAccessMap(user.access_matrix.field_access),
  );
  const groupPermissions = useMemo(() => groupPermissionSet(userGroups), [userGroups]);
  const temporaryPermissions = useMemo(
    () => temporaryGrantPermissionSet(user.access_matrix),
    [user.access_matrix],
  );
  const preservedWidgetAccess = useMemo(
    () => widgetAccessMap(user.access_matrix.widget_access),
    [user.access_matrix],
  );
  const roleFieldAccess = role?.field_access_defaults ?? {};

  const moduleOptions = useMemo(() => {
    const modules = new Set<string>();
    for (const permission of PERMISSIONS) modules.add(moduleFromPermission(permission.code));
    for (const field of FIELD_ACCESS_FIELDS) modules.add(fieldModule(field));
    return [...modules].sort().map((module) => ({ value: module, label: module }));
  }, []);

  const visibleFields = useMemo(
    () =>
      FIELD_ACCESS_FIELDS.filter((field) => fieldMatches(field, pacedFieldFilter, moduleFilter)),
    [moduleFilter, pacedFieldFilter],
  );

  const grantSourceCount = (permission: string) =>
    Number(rolePermissionSet.has(permission)) +
    Number(groupPermissions.has(permission)) +
    Number(extraPermissions.has(permission)) +
    Number(temporaryPermissions.has(permission));

  const permissionIsEffective = (permission: string) =>
    bypassRole || (!deniedPermissions.has(permission) && grantSourceCount(permission) > 0);

  const effectiveCount = bypassRole
    ? PERMISSIONS.length
    : PERMISSIONS.filter((permission) => permissionIsEffective(permission.code)).length;

  const overlapCount = bypassRole
    ? 0
    : PERMISSIONS.filter((permission) => {
        const grants = grantSourceCount(permission.code);
        return grants > 1 || (grants > 0 && deniedPermissions.has(permission.code));
      }).length;

  const visiblePermissions = useMemo(
    () =>
      PERMISSIONS.filter((permission) =>
        permissionMatches(permission, pacedPermissionFilter, moduleFilter),
      ),
    [moduleFilter, pacedPermissionFilter],
  );
  const overlapRows = useMemo(
    () =>
      PERMISSIONS.map((permission) => {
        const roleGrant = rolePermissionSet.has(permission.code);
        const groupGrant = groupPermissions.has(permission.code);
        const extraGrant = extraPermissions.has(permission.code);
        const temporaryGrant = temporaryPermissions.has(permission.code);
        const denied = deniedPermissions.has(permission.code);
        const grants =
          Number(roleGrant) + Number(groupGrant) + Number(extraGrant) + Number(temporaryGrant);
        return {
          denied,
          deniedOverlap: denied && grants > 0 && !bypassRole,
          duplicateGrant: grants > 1,
          effective: bypassRole || (!denied && grants > 0),
          extraGrant,
          groupGrant,
          grants,
          permission,
          roleGrant,
          temporaryGrant,
        };
      }).filter((row) => row.duplicateGrant || row.deniedOverlap),
    [
      bypassRole,
      deniedPermissions,
      extraPermissions,
      groupPermissions,
      rolePermissionSet,
      temporaryPermissions,
    ],
  );
  const redundantExtraPermissions = useMemo(
    () =>
      PERMISSIONS.filter(
        (permission) =>
          extraPermissions.has(permission.code) &&
          (rolePermissionSet.has(permission.code) ||
            groupPermissions.has(permission.code) ||
            temporaryPermissions.has(permission.code)),
      ),
    [extraPermissions, groupPermissions, rolePermissionSet, temporaryPermissions],
  );
  const deniedActiveGrantPermissions = useMemo(
    () =>
      PERMISSIONS.filter((permission) => {
        if (!deniedPermissions.has(permission.code)) return false;
        return (
          rolePermissionSet.has(permission.code) ||
          groupPermissions.has(permission.code) ||
          extraPermissions.has(permission.code) ||
          temporaryPermissions.has(permission.code)
        );
      }),
    [
      deniedPermissions,
      extraPermissions,
      groupPermissions,
      rolePermissionSet,
      temporaryPermissions,
    ],
  );

  const roleFieldRestrictionCount = Object.values(roleFieldAccess).filter(
    (level) => level !== "edit",
  ).length;
  const userFieldOverrideCount = Object.keys(fieldOverrides).length;

  const setPermissionOverride = (permission: string, value: string) => {
    setExtraPermissions((previousExtra) => {
      const nextExtra = new Set(previousExtra);
      if (value === "extra") nextExtra.add(permission);
      else nextExtra.delete(permission);
      return nextExtra;
    });
    setDeniedPermissions((previousDenied) => {
      const nextDenied = new Set(previousDenied);
      if (value === "deny") nextDenied.add(permission);
      else nextDenied.delete(permission);
      return nextDenied;
    });
  };

  const removeExtraPermission = (permission: string) => {
    setExtraPermissions((previousExtra) => {
      const nextExtra = new Set(previousExtra);
      nextExtra.delete(permission);
      return nextExtra;
    });
  };

  const clearDeniedPermission = (permission: string) => {
    setDeniedPermissions((previousDenied) => {
      const nextDenied = new Set(previousDenied);
      nextDenied.delete(permission);
      return nextDenied;
    });
  };

  const removeRedundantExtras = () => {
    const redundantCodes = new Set(redundantExtraPermissions.map((permission) => permission.code));
    setExtraPermissions((previousExtra) => {
      const nextExtra = new Set(previousExtra);
      for (const permission of redundantCodes) {
        nextExtra.delete(permission);
      }
      return nextExtra;
    });
  };

  const clearDeniedActiveGrants = () => {
    const deniedCodes = new Set(deniedActiveGrantPermissions.map((permission) => permission.code));
    setDeniedPermissions((previousDenied) => {
      const nextDenied = new Set(previousDenied);
      for (const permission of deniedCodes) {
        nextDenied.delete(permission);
      }
      return nextDenied;
    });
  };

  const setFieldOverride = (key: string, value: string) => {
    const level = parseFieldOverrideLevel(value);
    setFieldOverrides((previous) => {
      const next = { ...previous };
      if (level === "inherit") delete next[key];
      else next[key] = level;
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const widgetAccess =
        Object.keys(preservedWidgetAccess).length > 0 ? preservedWidgetAccess : undefined;
      return adminAccessService.updateUserAccessMatrix(user.id, {
        extra_permissions: [...extraPermissions],
        denied_permissions: [...deniedPermissions],
        field_access: Object.keys(fieldOverrides).length > 0 ? fieldOverrides : undefined,
        widget_access: widgetAccess,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["setup-users"] });
      notifications.show({
        title: "User access matrix saved",
        message: `${user.full_name} effective permission overrides were updated.`,
        color: "success",
      });
    },
  });

  return (
    <Stack gap="md">
      <Alert icon={<IconUserShield size={16} />} color="blue" variant="light">
        <Text size="sm">
          Effective permissions resolve as role grants plus individual extras and active temporary
          grants, plus access-group global grants, minus individual denied permissions. Access
          groups also remain resource/team scope through SpiceDB relationships.
        </Text>
      </Alert>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }}>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            User
          </Text>
          <Text fw={700}>{user.full_name}</Text>
          <Text size="xs" c="dimmed">
            {user.username}
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Role
          </Text>
          <Text fw={700}>{role?.name ?? user.role}</Text>
          <Text size="xs" c="dimmed">
            {bypassRole ? "Bypass role" : `${rolePermissionSet.size} role grants`}
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Effective
          </Text>
          <Text fw={700}>{effectiveCount}</Text>
          <Text size="xs" c="dimmed">
            of {PERMISSIONS.length} permissions
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            User Overrides
          </Text>
          <Text fw={700}>{extraPermissions.size + deniedPermissions.size}</Text>
          <Text size="xs" c="dimmed">
            {extraPermissions.size} extra, {deniedPermissions.size} denied
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Overlaps
          </Text>
          <Text fw={700}>{overlapCount}</Text>
          <Text size="xs" c="dimmed">
            duplicate or denied grants
          </Text>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Groups
          </Text>
          <Text fw={700}>{userGroups.length}</Text>
          <Text size="xs" c="dimmed">
            {userGroups.length > 0 ? groupNames(userGroups) : "No resource groups"}
          </Text>
          {groupPermissions.size > 0 && (
            <Text size="xs" c="dimmed">
              {groupPermissions.size} group permission grants
            </Text>
          )}
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Temporary
          </Text>
          <Text fw={700}>{temporaryPermissions.size}</Text>
          <Text size="xs" c="dimmed">
            active IAM grant permissions
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Field Masking
          </Text>
          <Text fw={700}>{roleFieldRestrictionCount + userFieldOverrideCount}</Text>
          <Text size="xs" c="dimmed">
            {roleFieldRestrictionCount} role, {userFieldOverrideCount} user
          </Text>
        </Card>
      </SimpleGrid>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-end">
            <Group gap="sm" align="flex-end">
              <TextInput
                label="Permission search"
                placeholder="Search permission, screen, table or action"
                leftSection={<IconSearch size={14} />}
                value={permissionFilter}
                onChange={(event) => setPermissionFilter(event.currentTarget.value)}
              />
              <Select
                label="Module"
                placeholder="All modules"
                data={moduleOptions}
                value={moduleFilter}
                onChange={setModuleFilter}
                clearable
                searchable
              />
            </Group>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              disabled={!canUpdate}
            >
              Save User Matrix
            </Button>
          </Group>

          <Alert
            icon={<IconShieldLock size={16} />}
            color={
              redundantExtraPermissions.length > 0 || deniedActiveGrantPermissions.length > 0
                ? "orange"
                : "green"
            }
            variant="light"
          >
            <Group justify="space-between" align="flex-start" gap="md">
              <Stack gap={3}>
                <Text fw={700} size="sm">
                  Cleanup recommendations
                </Text>
                <Text size="sm">
                  {redundantExtraPermissions.length} redundant individual extras and{" "}
                  {deniedActiveGrantPermissions.length} deny conflicts found for this user.
                </Text>
                {userGroups.length > 0 && (
                  <Text size="xs" c="dimmed">
                    Group memberships also scope resources through SpiceDB: {groupNames(userGroups)}
                    .
                  </Text>
                )}
              </Stack>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="light"
                  disabled={!canUpdate || bypassRole || redundantExtraPermissions.length === 0}
                  onClick={removeRedundantExtras}
                >
                  Remove duplicate extras
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  disabled={!canUpdate || bypassRole || deniedActiveGrantPermissions.length === 0}
                  onClick={clearDeniedActiveGrants}
                >
                  Clear deny conflicts
                </Button>
              </Group>
            </Group>
          </Alert>

          <Tabs defaultValue="permissions" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="permissions">Permissions</Tabs.Tab>
              <Tabs.Tab value="overlaps">Overlap Review</Tabs.Tab>
              <Tabs.Tab value="fields">Field Masking</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="permissions" pt="sm">
              <ScrollArea.Autosize mah="56vh">
                <Table stickyHeader highlightOnHover verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Permission</Table.Th>
                      <Table.Th>Sources</Table.Th>
                      <Table.Th>User override</Table.Th>
                      <Table.Th>Effective</Table.Th>
                      <Table.Th>Overlap</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {visiblePermissions.map((permission) => {
                      const roleGrant = rolePermissionSet.has(permission.code);
                      const groupGrant = groupPermissions.has(permission.code);
                      const extraGrant = extraPermissions.has(permission.code);
                      const temporaryGrant = temporaryPermissions.has(permission.code);
                      const denied = deniedPermissions.has(permission.code);
                      const grants = grantSourceCount(permission.code);
                      const effective = permissionIsEffective(permission.code);
                      const duplicateGrant = grants > 1;
                      const deniedOverlap = denied && grants > 0 && !bypassRole;
                      const overrideValue = denied ? "deny" : extraGrant ? "extra" : "inherit";
                      return (
                        <Table.Tr key={permission.code}>
                          <Table.Td>
                            <Text size="sm" fw={600}>
                              {permission.label}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {permission.code}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4}>
                              {bypassRole && (
                                <Badge color="green" variant="light">
                                  Bypass
                                </Badge>
                              )}
                              {!bypassRole && roleGrant && (
                                <Badge color="blue" variant="light">
                                  Role
                                </Badge>
                              )}
                              {!bypassRole && groupGrant && (
                                <Tooltip label={groupNames(userGroups)} multiline w={280}>
                                  <Badge color="cyan" variant="light">
                                    Group
                                  </Badge>
                                </Tooltip>
                              )}
                              {!bypassRole && extraGrant && (
                                <Badge color="teal" variant="light">
                                  Individual
                                </Badge>
                              )}
                              {!bypassRole && temporaryGrant && (
                                <Badge color="grape" variant="light">
                                  Temporary
                                </Badge>
                              )}
                              {!bypassRole && denied && (
                                <Badge color="red" variant="light">
                                  Denied
                                </Badge>
                              )}
                              {!bypassRole && userGroups.length > 0 && !groupGrant && (
                                <Tooltip label={groupNames(userGroups)} multiline w={280}>
                                  <Badge color="cyan" variant="light">
                                    Group scope
                                  </Badge>
                                </Tooltip>
                              )}
                              {!bypassRole && grants === 0 && !denied && (
                                <Badge color="gray" variant="light">
                                  None
                                </Badge>
                              )}
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <SegmentedControl
                              size="xs"
                              value={overrideValue}
                              onChange={(value) => setPermissionOverride(permission.code, value)}
                              data={[
                                { label: "Inherit", value: "inherit" },
                                { label: "Extra", value: "extra" },
                                { label: "Deny", value: "deny" },
                              ]}
                              disabled={!canUpdate || bypassRole}
                            />
                          </Table.Td>
                          <Table.Td>
                            <Badge color={effective ? "green" : "gray"} variant="light">
                              {effective ? "Allowed" : "Not granted"}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            {duplicateGrant ? (
                              <Badge color="orange" variant="light">
                                Duplicate grant
                              </Badge>
                            ) : deniedOverlap ? (
                              <Badge color="red" variant="light">
                                Deny overrides
                              </Badge>
                            ) : (
                              <Badge color="gray" variant="light">
                                Clean
                              </Badge>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea.Autosize>
            </Tabs.Panel>

            <Tabs.Panel value="overlaps" pt="sm">
              <Stack gap="sm">
                {overlapRows.length === 0 ? (
                  <Alert color="green" variant="light">
                    <Text size="sm">
                      No duplicate individual grants or denied active grants for this user.
                    </Text>
                  </Alert>
                ) : (
                  <ScrollArea.Autosize mah="52vh">
                    <Table stickyHeader highlightOnHover verticalSpacing="xs">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Permission</Table.Th>
                          <Table.Th>Grant sources</Table.Th>
                          <Table.Th>Conflict</Table.Th>
                          <Table.Th>Effective</Table.Th>
                          <Table.Th>Clean up</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {overlapRows.map((row) => (
                          <Table.Tr key={row.permission.code}>
                            <Table.Td>
                              <Text size="sm" fw={600}>
                                {row.permission.label}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {row.permission.code}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4}>
                                {row.roleGrant && (
                                  <Badge color="blue" variant="light">
                                    Role
                                  </Badge>
                                )}
                                {row.groupGrant && (
                                  <Tooltip label={groupNames(userGroups)} multiline w={280}>
                                    <Badge color="cyan" variant="light">
                                      Group
                                    </Badge>
                                  </Tooltip>
                                )}
                                {row.extraGrant && (
                                  <Badge color="teal" variant="light">
                                    Individual
                                  </Badge>
                                )}
                                {row.temporaryGrant && (
                                  <Badge color="grape" variant="light">
                                    Temporary
                                  </Badge>
                                )}
                                {row.denied && (
                                  <Badge color="red" variant="light">
                                    Denied
                                  </Badge>
                                )}
                                {userGroups.length > 0 && !row.groupGrant && (
                                  <Tooltip label={groupNames(userGroups)} multiline w={280}>
                                    <Badge color="cyan" variant="light">
                                      Group scope
                                    </Badge>
                                  </Tooltip>
                                )}
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4}>
                                {row.duplicateGrant && (
                                  <Badge color="orange" variant="light">
                                    Duplicate grant
                                  </Badge>
                                )}
                                {row.deniedOverlap && (
                                  <Badge color="red" variant="light">
                                    Deny overrides grant
                                  </Badge>
                                )}
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Badge color={row.effective ? "green" : "gray"} variant="light">
                                {row.effective ? "Allowed" : "Not granted"}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Group gap="xs">
                                {row.extraGrant && row.grants > 1 && (
                                  <Button
                                    size="xs"
                                    variant="light"
                                    disabled={!canUpdate || bypassRole}
                                    onClick={() => removeExtraPermission(row.permission.code)}
                                  >
                                    Remove extra
                                  </Button>
                                )}
                                {row.deniedOverlap && (
                                  <Button
                                    size="xs"
                                    variant="light"
                                    color="red"
                                    disabled={!canUpdate || bypassRole}
                                    onClick={() => clearDeniedPermission(row.permission.code)}
                                  >
                                    Clear deny
                                  </Button>
                                )}
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea.Autosize>
                )}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="fields" pt="sm">
              <Stack gap="sm">
                <TextInput
                  label="Field search"
                  placeholder="Search fields, tables, inputs and sensitive values"
                  leftSection={<IconSearch size={14} />}
                  value={fieldFilter}
                  onChange={(event) => setFieldFilter(event.currentTarget.value)}
                />
                <ScrollArea.Autosize mah="52vh">
                  <Table stickyHeader highlightOnHover verticalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Field</Table.Th>
                        <Table.Th>Role default</Table.Th>
                        <Table.Th>User override</Table.Th>
                        <Table.Th>Effective</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {visibleFields.map((field) => {
                        const key = fieldKey(field);
                        const roleLevel = roleFieldAccess[key] ?? "edit";
                        const userLevel = fieldOverrides[key];
                        const effectiveLevel = userLevel ?? roleLevel;
                        return (
                          <Table.Tr key={field.id}>
                            <Table.Td>
                              <Text size="sm" fw={600}>
                                {field.name}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {key}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                color={roleLevel === "edit" ? "gray" : "orange"}
                                variant="light"
                              >
                                {roleLevel}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <SegmentedControl
                                size="xs"
                                value={userLevel ?? "inherit"}
                                onChange={(value) => setFieldOverride(key, value)}
                                data={FIELD_OVERRIDE_LEVELS}
                                disabled={!canUpdate || bypassRole}
                              />
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                color={effectiveLevel === "edit" ? "green" : "red"}
                                variant="light"
                              >
                                {effectiveLevel}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </ScrollArea.Autosize>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Card>
    </Stack>
  );
}

function SurfaceCoverageMatrix() {
  const [surfaceFilter, setSurfaceFilter] = useState("");
  const pacedSurfaceFilter = usePacedQueryValue(surfaceFilter, 200).trim().toLowerCase();
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<AccessMatrixSurfaceKind | null>(null);
  const fieldsByKey = useMemo(() => fieldByKey(), []);

  const visibleSurfaces = useMemo(
    () =>
      ACCESS_MATRIX_SURFACES.filter((surface) =>
        surfaceMatches(surface, pacedSurfaceFilter, moduleFilter, kindFilter),
      ),
    [kindFilter, moduleFilter, pacedSurfaceFilter],
  );
  const coveredPermissions = useMemo(
    () => new Set(ACCESS_MATRIX_SURFACES.flatMap((surface) => [...surface.requiredPermissions])),
    [],
  );
  const coveredFieldKeys = useMemo(
    () => new Set(ACCESS_MATRIX_SURFACES.flatMap((surface) => [...surface.fieldAccessKeys])),
    [],
  );
  const moduleSummaries = useMemo(() => {
    const modules = new Map<
      string,
      { surfaces: number; permissions: Set<string>; fields: Set<string> }
    >();

    for (const surface of ACCESS_MATRIX_SURFACES) {
      const summary = modules.get(surface.module) ?? {
        surfaces: 0,
        permissions: new Set<string>(),
        fields: new Set<string>(),
      };
      summary.surfaces += 1;
      for (const permission of surface.requiredPermissions) summary.permissions.add(permission);
      for (const fieldKeyValue of surface.fieldAccessKeys) summary.fields.add(fieldKeyValue);
      modules.set(surface.module, summary);
    }

    return [...modules.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, []);
  const workflowCoverage = useMemo(
    () =>
      CRITICAL_WORKFLOW_EXPECTATIONS.map((workflow) => {
        const surfaces = ACCESS_MATRIX_SURFACES.filter((surface) =>
          workflow.modules.includes(surface.module),
        );
        const coveredKinds = new Set(surfaces.map((surface) => surface.kind));
        const missingKinds = workflow.requiredKinds.filter((kind) => !coveredKinds.has(kind));
        const activatedSurfaces = surfaces.filter((surface) => surface.activatesAfter.length > 0);
        const permissions = new Set(
          surfaces.flatMap((surface) => [...surface.requiredPermissions]),
        );
        const printSurfaces = surfaces.filter((surface) => surface.kind === "print");
        const printerRequired = printSurfaces.filter((surface) => surface.requiresPrinter);
        return {
          ...workflow,
          activatedSurfaces: activatedSurfaces.length,
          missingKinds,
          permissions,
          printerRequired: printerRequired.length,
          printSurfaces: printSurfaces.length,
          surfaces,
        };
      }),
    [],
  );
  const workflowGapCount = workflowCoverage.filter(
    (workflow) => workflow.missingKinds.length > 0,
  ).length;
  const fieldKeysMissingFromRegistry = [...coveredFieldKeys].filter((key) => !fieldsByKey.has(key));
  const registeredFieldsNotMapped = FIELD_ACCESS_FIELDS.filter(
    (field) => !coveredFieldKeys.has(fieldKey(field)),
  );
  const printSurfaces = ACCESS_MATRIX_SURFACES.filter((surface) => surface.kind === "print");
  const printerRequiredSurfaces = printSurfaces.filter((surface) => surface.requiresPrinter);
  const printArtifacts = new Set(printSurfaces.flatMap((surface) => [...surface.printArtifacts]));
  const copyMappedSurfaces = printSurfaces.filter((surface) => surface.printCopies.length > 0);
  const customerCopySurfaces = printSurfaces.filter((surface) =>
    surface.printCopies.includes("customer"),
  );
  const officeCopySurfaces = printSurfaces.filter((surface) =>
    surface.printCopies.includes("office"),
  );
  const printRoutingGapSurfaces = printSurfaces.filter(
    (surface) =>
      surface.printArtifacts.length === 0 ||
      surface.printCopies.length === 0 ||
      (surface.requiresPrinter && surface.printerProfiles.length === 0),
  );

  return (
    <Stack gap="md">
      <Alert icon={<IconShieldLock size={16} />} color="blue" variant="light">
        <Text size="sm">
          This catalog maps routes, tabs, tables, columns, inputs, print actions and widgets to
          permissions plus field-access keys. Use it to find loose screens before adding role or
          user overrides.
        </Text>
      </Alert>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 6 }}>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Surfaces
          </Text>
          <Text fw={700}>{ACCESS_MATRIX_SURFACES.length}</Text>
          <Text size="xs" c="dimmed">
            screens, tabs, tables, inputs and actions
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Permissions Mapped
          </Text>
          <Text fw={700}>{coveredPermissions.size}</Text>
          <Text size="xs" c="dimmed">
            referenced by UI surfaces
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Field Keys Mapped
          </Text>
          <Text fw={700}>{coveredFieldKeys.size}</Text>
          <Text size="xs" c="dimmed">
            table columns and input fields
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Registry Gaps
          </Text>
          <Text fw={700}>{fieldKeysMissingFromRegistry.length}</Text>
          <Text size="xs" c="dimmed">
            mapped keys missing from field registry
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Print Maps
          </Text>
          <Text fw={700}>{printSurfaces.length}</Text>
          <Text size="xs" c="dimmed">
            {printArtifacts.size} sheets, {printerRequiredSurfaces.length} printer mapped
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Copy Routes
          </Text>
          <Text fw={700}>{copyMappedSurfaces.length}</Text>
          <Text size="xs" c="dimmed">
            {customerCopySurfaces.length} customer / {officeCopySurfaces.length} office,{" "}
            {printRoutingGapSurfaces.length} gaps
          </Text>
        </Card>
      </SimpleGrid>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>Critical Workflow Coverage</Text>
              <Text size="sm" c="dimmed">
                Checks whether the main patient journey has mapped screens, tabs, tables, inputs,
                actions, print surfaces, widgets, permissions, and event activations.
              </Text>
            </Stack>
            <Badge color={workflowGapCount > 0 ? "orange" : "green"} variant="light">
              {workflowGapCount} workflow gaps
            </Badge>
          </Group>
          <ScrollArea.Autosize mah={360}>
            <Table stickyHeader highlightOnHover verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Workflow</Table.Th>
                  <Table.Th>Modules</Table.Th>
                  <Table.Th>Mapped surfaces</Table.Th>
                  <Table.Th>Event driven</Table.Th>
                  <Table.Th>Print map</Table.Th>
                  <Table.Th>Missing surface types</Table.Th>
                  <Table.Th>Permissions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {workflowCoverage.map((workflow) => (
                  <Table.Tr key={workflow.key}>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {workflow.label}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {workflow.modules.map((module) => (
                          <Badge key={module} variant="light">
                            {module}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={workflow.surfaces.length > 0 ? "blue" : "red"} variant="light">
                        {workflow.surfaces.length}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={workflow.activatedSurfaces > 0 ? "green" : "orange"}
                        variant="light"
                      >
                        {workflow.activatedSurfaces}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Badge
                          color={workflow.printSurfaces > 0 ? "violet" : "gray"}
                          variant="light"
                        >
                          {workflow.printSurfaces} print
                        </Badge>
                        {workflow.printerRequired > 0 && (
                          <Badge color="blue" variant="light">
                            {workflow.printerRequired} printer
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {workflow.missingKinds.length > 0 ? (
                        <Group gap={4}>
                          {workflow.missingKinds.map((kind) => (
                            <Badge key={kind} color="orange" variant="light">
                              {kind}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        <Badge color="green" variant="light">
                          complete
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={workflow.permissions.size > 0 ? "teal" : "red"} variant="light">
                        {workflow.permissions.size}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-end">
            <Group gap="sm" align="flex-end">
              <TextInput
                label="Surface search"
                placeholder="Search screen, tab, table, input, permission or event"
                leftSection={<IconSearch size={14} />}
                value={surfaceFilter}
                onChange={(event) => setSurfaceFilter(event.currentTarget.value)}
              />
              <Select
                label="Module"
                placeholder="All modules"
                data={accessSurfaceModuleOptions()}
                value={moduleFilter}
                onChange={setModuleFilter}
                clearable
                searchable
              />
              <Select
                label="Surface"
                placeholder="All surfaces"
                data={accessSurfaceKindOptions()}
                value={kindFilter}
                onChange={(value) =>
                  setKindFilter(value && isAccessSurfaceKind(value) ? value : null)
                }
                clearable
              />
            </Group>
            <Badge color="blue" variant="light">
              {visibleSurfaces.length} visible
            </Badge>
          </Group>

          <ScrollArea.Autosize mah="58vh">
            <Table stickyHeader highlightOnHover verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Surface</Table.Th>
                  <Table.Th>Route / table</Table.Th>
                  <Table.Th>Permissions</Table.Th>
                  <Table.Th>Field access keys</Table.Th>
                  <Table.Th>Activation</Table.Th>
                  <Table.Th>Print / printer</Table.Th>
                  <Table.Th>Standards</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visibleSurfaces.map((surface) => (
                  <Table.Tr key={surface.id}>
                    <Table.Td>
                      <Group gap={6} mb={2}>
                        <Badge variant="light">{surface.module}</Badge>
                        <Badge color="gray" variant="light">
                          {surface.kind}
                        </Badge>
                      </Group>
                      <Text size="sm" fw={600}>
                        {surface.label}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {surface.area}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text size="xs" ff="var(--font-mono, monospace)">
                          {surface.route ?? "-"}
                        </Text>
                        {(surface.table || surface.tab) && (
                          <Text size="xs" c="dimmed">
                            {[
                              surface.table ? `table: ${surface.table}` : null,
                              surface.tab ? `tab: ${surface.tab}` : null,
                            ]
                              .filter(Boolean)
                              .join(" | ")}
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        {surface.requiredPermissions.map((permission) => (
                          <Tooltip key={permission} label={permissionLabel(permission)}>
                            <Badge color="teal" variant="light">
                              {permission}
                            </Badge>
                          </Tooltip>
                        ))}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      {surface.fieldAccessKeys.length > 0 ? (
                        <Stack gap={4}>
                          {surface.fieldAccessKeys.map((key) => {
                            const field = fieldsByKey.get(key);
                            return (
                              <Tooltip
                                key={key}
                                label={field ? field.name : "Not registered in FIELD_ACCESS_FIELDS"}
                              >
                                <Badge color={field ? "orange" : "red"} variant="light">
                                  {key}
                                </Badge>
                              </Tooltip>
                            );
                          })}
                        </Stack>
                      ) : (
                        <Badge color="gray" variant="light">
                          none
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {surface.activatesAfter.length > 0 ? (
                        <Stack gap={4}>
                          {surface.activatesAfter.map((eventName) => (
                            <Badge key={eventName} color="blue" variant="light">
                              {eventName}
                            </Badge>
                          ))}
                        </Stack>
                      ) : (
                        <Badge color="gray" variant="light">
                          always
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {surface.kind === "print" || surface.requiresPrinter ? (
                        <Stack gap={4}>
                          <Group gap={4}>
                            {surface.printArtifacts.length > 0 ? (
                              surface.printArtifacts.map((artifact) => (
                                <Badge key={artifact} color="gray" variant="light">
                                  {artifact}
                                </Badge>
                              ))
                            ) : (
                              <Badge color="orange" variant="light">
                                sheet not mapped
                              </Badge>
                            )}
                          </Group>
                          <Group gap={4}>
                            {surface.printCopies.length > 0 ? (
                              surface.printCopies.map((copy) => (
                                <Badge key={copy} color="violet" variant="light">
                                  {printCopyLabel(copy)}
                                </Badge>
                              ))
                            ) : (
                              <Badge color="orange" variant="light">
                                copy not mapped
                              </Badge>
                            )}
                          </Group>
                          <Group gap={4}>
                            {surface.printerProfiles.length > 0 ? (
                              surface.printerProfiles.map((profile) => (
                                <Badge key={profile} color="blue" variant="light">
                                  {profile}
                                </Badge>
                              ))
                            ) : (
                              <Badge
                                color={surface.requiresPrinter ? "red" : "gray"}
                                variant="light"
                              >
                                no printer profile
                              </Badge>
                            )}
                          </Group>
                        </Stack>
                      ) : (
                        <Badge color="gray" variant="light">
                          none
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Badge color="violet" variant="light">
                          {surface.masking}
                        </Badge>
                        {surface.standardRefs.slice(0, 2).map((standard) => (
                          <Text key={standard} size="xs" c="dimmed" lineClamp={1}>
                            {standard}
                          </Text>
                        ))}
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Card withBorder padding="md">
          <Stack gap="sm">
            <Text fw={700}>Module Coverage</Text>
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Module</Table.Th>
                  <Table.Th>Surfaces</Table.Th>
                  <Table.Th>Permissions</Table.Th>
                  <Table.Th>Field keys</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {moduleSummaries.map(([module, summary]) => (
                  <Table.Tr key={module}>
                    <Table.Td>
                      <Badge variant="light">{module}</Badge>
                    </Table.Td>
                    <Table.Td>{summary.surfaces}</Table.Td>
                    <Table.Td>{summary.permissions.size}</Table.Td>
                    <Table.Td>{summary.fields.size}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        </Card>
        <Card withBorder padding="md">
          <Stack gap="sm">
            <Text fw={700}>Field Registry Review</Text>
            <Text size="sm" c="dimmed">
              Registered fields not mapped to a surface should be connected before relying on the
              matrix for complete table-column or input masking.
            </Text>
            <Group gap={4}>
              {registeredFieldsNotMapped.length > 0 ? (
                registeredFieldsNotMapped.slice(0, 12).map((field) => (
                  <Badge key={field.id} color="orange" variant="light">
                    {fieldKey(field)}
                  </Badge>
                ))
              ) : (
                <Badge color="green" variant="light">
                  all registered fields mapped
                </Badge>
              )}
            </Group>
            {registeredFieldsNotMapped.length > 12 && (
              <Text size="xs" c="dimmed">
                +{registeredFieldsNotMapped.length - 12} more field keys
              </Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

function GroupScopeMatrix({
  groups,
  bundles,
  manifest,
  isLoading,
}: {
  groups: AccessGroupRow[];
  bundles: GroupMemberBundle[];
  manifest: AccessManifest | null;
  isLoading: boolean;
}) {
  const membersByGroup = useMemo(
    () => new Map(bundles.map((bundle) => [bundle.group.id, bundle.members])),
    [bundles],
  );

  return (
    <Stack gap="md">
      <Alert icon={<IconUsersGroup size={16} />} color="cyan" variant="light">
        <Text size="sm">
          Group membership is visible here to prevent duplicate user overrides. Groups can grant
          shared global permissions and still scope resource relationships through SpiceDB.
        </Text>
      </Alert>

      <SimpleGrid cols={{ base: 1, lg: 3 }}>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Access Groups
          </Text>
          <Text fw={700}>{groups.length}</Text>
          <Text size="xs" c="dimmed">
            team permissions and resource-scoped memberships
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            SpiceDB Resources
          </Text>
          <Text fw={700}>{manifest?.resources.length ?? 0}</Text>
          <Text size="xs" c="dimmed">
            object types with relations and permissions
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Role Policies
          </Text>
          <Text fw={700}>{manifest?.policies.length ?? 0}</Text>
          <Text size="xs" c="dimmed">
            defaults that guide group assignment
          </Text>
        </Card>
      </SimpleGrid>

      <Card withBorder padding="md">
        {isLoading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : groups.length === 0 ? (
          <Text c="dimmed">No access groups are configured.</Text>
        ) : (
          <ScrollArea.Autosize mah="56vh">
            <Table stickyHeader highlightOnHover verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Group</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Members</Table.Th>
                  <Table.Th>Global permissions</Table.Th>
                  <Table.Th>Member preview</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {groups.map((group) => {
                  const members = membersByGroup.get(group.id) ?? [];
                  const permissions = stringArray(group.permissions);
                  const preview = members
                    .slice(0, 4)
                    .map((member) => member.full_name)
                    .join(", ");
                  return (
                    <Table.Tr key={group.id}>
                      <Table.Td>
                        <Text size="sm" fw={600}>
                          {group.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {group.code}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={group.is_active ? "green" : "gray"} variant="light">
                          {group.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge color="cyan" variant="light">
                          {members.length} members
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {permissions.length > 0 ? (
                          <Stack gap={4}>
                            <Badge color="teal" variant="light">
                              {permissions.length} grants
                            </Badge>
                            <Group gap={4}>
                              {permissions.slice(0, 4).map((permission) => (
                                <Tooltip key={permission} label={permissionLabel(permission)}>
                                  <Badge color="gray" variant="light">
                                    {permission}
                                  </Badge>
                                </Tooltip>
                              ))}
                              {permissions.length > 4 && (
                                <Badge color="gray" variant="light">
                                  +{permissions.length - 4}
                                </Badge>
                              )}
                            </Group>
                          </Stack>
                        ) : (
                          <Badge color="gray" variant="light">
                            Resource scope only
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c={preview ? undefined : "dimmed"} lineClamp={1}>
                          {preview || "No members"}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        )}
      </Card>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>SpiceDB Resource Model</Text>
              <Text size="sm" c="dimmed">
                Global module permissions decide which screens/actions can open. These resource
                relations decide which specific patients, admissions, invoices, orders, or shared
                objects are visible.
              </Text>
            </Stack>
            <Badge color="cyan" variant="light">
              ReBAC scope
            </Badge>
          </Group>
          {manifest && manifest.resources.length > 0 ? (
            <ScrollArea.Autosize mah={360}>
              <Table stickyHeader highlightOnHover verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Object</Table.Th>
                    <Table.Th>Relations</Table.Th>
                    <Table.Th>Permissions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {manifest.resources.map((resource) => (
                    <Table.Tr key={resource.object_type}>
                      <Table.Td>
                        <Text size="sm" fw={600}>
                          {resource.object_type}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {resource.relations.map((relation) => (
                            <Badge key={relation} color="cyan" variant="light">
                              {relation}
                            </Badge>
                          ))}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {resource.permissions.map((permission) => (
                            <Badge key={permission} color="blue" variant="light">
                              {permission}
                            </Badge>
                          ))}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          ) : (
            <Text c="dimmed">The access manifest did not return SpiceDB resources.</Text>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

export function AccessMatrixSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const canUpdateRoles = useHasPermission(P.ADMIN.ROLES.UPDATE);
  const canUpdateUsers = useHasPermission(P.ADMIN.USERS.UPDATE);
  const canViewRoles = useHasPermission(P.ADMIN.ROLES.LIST);
  const canViewUsers = useHasPermission(P.ADMIN.USERS.LIST);
  const initialMatrixTab =
    searchParams.get("user") || (!canViewRoles && canViewUsers) ? "users" : "roles";
  const [activeMatrixTab, setActiveMatrixTab] = useState<string | null>(initialMatrixTab);
  const [selectedRoleId, setSelectedRoleId] = useState(searchParams.get("role"));
  const [selectedUserId, setSelectedUserId] = useState(searchParams.get("user"));
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => adminAccessService.listRoles(),
    enabled: canViewRoles,
  });
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => adminAccessService.listUsers(),
    enabled: canViewUsers,
  });
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["access-groups"],
    queryFn: () => adminAccessService.listAccessGroups(),
    enabled: canViewUsers,
  });
  const { data: accessManifest = null, isLoading: accessManifestLoading } = useQuery({
    queryKey: ["access-manifest"],
    queryFn: () => adminAccessService.getAccessManifest(),
  });
  const groupMemberBundlesQuery = useQuery({
    queryKey: ["access-group-member-index", groups.map((group) => group.id).sort()],
    queryFn: async (): Promise<GroupMemberBundle[]> =>
      Promise.all(
        groups.map(async (group) => ({
          group,
          members: await adminAccessService.listAccessGroupMembers(group.id),
        })),
      ),
    enabled: groups.length > 0,
  });

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null;
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? users[0] ?? null;
  const roleByCode = useMemo(() => buildRoleByCode(roles), [roles]);
  const selectedUserRole = selectedUser ? (roleByCode.get(selectedUser.role) ?? null) : null;
  const groupMemberBundles = groupMemberBundlesQuery.data ?? [];
  const groupMemberIndex = useMemo(
    () => buildGroupMemberIndex(groupMemberBundles),
    [groupMemberBundles],
  );
  const selectedUserGroups = selectedUser
    ? (groupMemberIndex.byUser.get(selectedUser.id) ?? [])
    : [];

  if (rolesLoading || usersLoading || groupsLoading || accessManifestLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  if (!selectedRole && !selectedUser) {
    return (
      <Card withBorder padding="lg">
        <Text c="dimmed">No roles or users are available for access-matrix configuration.</Text>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      <Card withBorder padding="md">
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            <IconShieldLock size={20} />
            <Stack gap={2}>
              <Text fw={700}>Permission Matrix</Text>
              <Text size="sm" c="dimmed">
                Review role, group, individual, and temporary permission sources in one settings
                surface.
              </Text>
            </Stack>
          </Group>
          <Group gap="xs">
            <Badge color="blue" variant="light">
              Role defaults
            </Badge>
            <Badge color="teal" variant="light">
              User overrides
            </Badge>
            <Badge color="cyan" variant="light">
              Group scope
            </Badge>
          </Group>
        </Group>
      </Card>

      <Tabs value={activeMatrixTab} onChange={setActiveMatrixTab} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="roles" leftSection={<IconShieldLock size={14} />}>
            Role defaults
          </Tabs.Tab>
          <Tabs.Tab value="users" leftSection={<IconUserShield size={14} />}>
            User effective access
          </Tabs.Tab>
          <Tabs.Tab value="groups" leftSection={<IconUsersGroup size={14} />}>
            Group scope
          </Tabs.Tab>
          <Tabs.Tab value="coverage" leftSection={<IconSearch size={14} />}>
            UI coverage
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="roles" pt="md">
          {selectedRole ? (
            <Stack gap="md">
              <Card withBorder padding="md">
                <Select
                  label="Role"
                  data={roleOptions(roles)}
                  value={selectedRole.id}
                  onChange={(value) => {
                    setSelectedRoleId(value);
                    const next = new URLSearchParams(searchParams);
                    if (value) next.set("role", value);
                    else next.delete("role");
                    setSearchParams(next, { replace: true });
                  }}
                  searchable
                  allowDeselect={false}
                />
              </Card>
              <RoleMatrixEditor
                key={selectedRole.id}
                role={selectedRole}
                roles={roles}
                canUpdate={canUpdateRoles}
              />
            </Stack>
          ) : (
            <Card withBorder padding="lg">
              <Text c="dimmed">No roles are available.</Text>
            </Card>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="users" pt="md">
          {selectedUser ? (
            <Stack gap="md">
              <Card withBorder padding="md">
                <Select
                  label="User"
                  data={userOptions(users)}
                  value={selectedUser.id}
                  onChange={(value) => {
                    setSelectedUserId(value);
                    const next = new URLSearchParams(searchParams);
                    if (value) next.set("user", value);
                    else next.delete("user");
                    setSearchParams(next, { replace: true });
                  }}
                  searchable
                  allowDeselect={false}
                />
              </Card>
              <EffectiveUserAccessMatrix
                key={selectedUser.id}
                user={selectedUser}
                role={selectedUserRole}
                userGroups={selectedUserGroups}
                canUpdate={canUpdateUsers}
              />
            </Stack>
          ) : (
            <Card withBorder padding="lg">
              <Text c="dimmed">No users are available.</Text>
            </Card>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="groups" pt="md">
          <GroupScopeMatrix
            groups={groups}
            bundles={groupMemberBundles}
            manifest={accessManifest}
            isLoading={groupMemberBundlesQuery.isLoading}
          />
        </Tabs.Panel>

        <Tabs.Panel value="coverage" pt="md">
          <SurfaceCoverageMatrix />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
