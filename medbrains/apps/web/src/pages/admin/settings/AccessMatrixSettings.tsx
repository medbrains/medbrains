import {
  Card,
  Group,
  Loader,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  AccessMatrixPlatform,
  AccessMatrixSurface,
  AccessMatrixSurfaceKind,
  ClinicalJourneyBlockingControl,
  CustomRole,
  FieldAccessLevel,
  FieldMasterFull,
  PermissionDef,
  SetupUser,
  WidgetAccessLevel,
} from "@medbrains/types";
import {
  ACCESS_MATRIX_SURFACES,
  ACCESS_MATRIX_WORKFLOW_EXPECTATIONS,
  CORE_PATIENT_JOURNEY_ACTIONS,
  FIELD_ACCESS_FIELDS,
  P,
  PERMISSIONS,
} from "@medbrains/types";
import {
  IconDeviceFloppy,
  IconSearch,
  IconShieldLock,
  IconUserShield,
  IconUsersGroup,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { OperationalSignal } from "@/components/OperationalSignal";
import { Alert, Badge, type BadgeTone, Button, Table } from "@/components/ui";
import { NAV_GROUPS } from "@/config/navigation";
import { usePacedQueryValue } from "@/hooks/usePacedQueryValue";
import { adminAccessService } from "@/services/adminAccess.service";
import {
  buildJourneyActionCoverage,
  JOURNEY_ACTION_COVERAGE_GAP_LABELS,
  summarizeJourneyActionCoverage,
} from "./access-matrix-actions";
import {
  ACCESS_MATRIX_PLATFORMS,
  type AccessFieldCoverageGap,
  type AccessFieldCoverageRow,
  type AccessSurfaceGovernanceGap,
  accessSurfacePlatformRoute,
  buildAccessFieldCoverage,
  buildAccessPlatformCoverage,
  buildAccessSurfaceGovernanceCoverage,
  buildAccessSurfaceGovernanceGapRows,
  buildNavRouteCoverage,
  buildPatientFlowGovernanceCoverage,
  buildWorkflowKindCoverage,
  buildWorkflowShapeGovernanceCoverage,
  type PatientFlowGovernanceGap,
  summarizeAccessFieldCoverage,
  summarizeAccessPlatformCoverage,
  summarizeAccessSurfaceGovernance,
  summarizeNavRouteCoverage,
  summarizePatientFlowGovernance,
  summarizeWorkflowKindCoverage,
  summarizeWorkflowShapeGovernance,
  type WorkflowShapeGovernanceGap,
} from "./access-matrix-coverage";
import {
  type PermissionSourceResolution,
  resolvePermissionSources,
} from "./access-matrix-permission-sources";
import {
  buildPrintableCoverage,
  PRINTABLE_COVERAGE_GAP_LABELS,
  summarizePrintableCoverage,
} from "./access-matrix-printables";
import {
  buildReportEventCoverage,
  REPORT_EVENT_COVERAGE_GAP_LABELS,
  summarizeReportEventCoverage,
} from "./report-event-coverage";

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

const ACCESS_SURFACE_GAP_LABELS: Record<AccessSurfaceGovernanceGap, string> = {
  "missing-route": "route",
  "missing-permission": "permission",
  "missing-field-keys": "field keys",
  "missing-table": "table",
  "missing-tab-anchor": "tab anchor",
  "missing-activation": "event",
  "missing-masking": "masking",
};

const ACCESS_FIELD_COVERAGE_GAP_LABELS: Record<AccessFieldCoverageGap, string> = {
  "missing-surface": "surface",
  "missing-route": "route",
  "missing-permission": "permission",
  "missing-masking": "masking",
};
const PATIENT_FLOW_GOVERNANCE_GAP_LABELS: Record<PatientFlowGovernanceGap, string> = {
  "missing-surface": "surface",
  "missing-platform": "platform",
  "missing-launch-target": "launch target",
  "missing-surface-kind": "surface type",
  "missing-permission": "permission",
  "missing-field-keys": "field keys",
  "missing-masking": "masking",
  "missing-activation": "event",
  "missing-print": "print",
  "missing-public-display-policy": "public display",
};
const WORKFLOW_SHAPE_GOVERNANCE_GAP_KEYS: Record<WorkflowShapeGovernanceGap, string> = {
  "missing-access-surface": "accessMatrix.shapeGovernance.gaps.accessSurface",
  "missing-event": "accessMatrix.shapeGovernance.gaps.event",
  "missing-masking": "accessMatrix.shapeGovernance.gaps.masking",
  "missing-platform": "accessMatrix.shapeGovernance.gaps.platform",
  "missing-semantic": "accessMatrix.shapeGovernance.gaps.semantic",
};

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

function journeyPermissionScopeLabel(scope: string, mode: "all" | "any") {
  const prefix = scope === "base" ? "base" : scope;
  return mode === "any" ? `${prefix} any` : prefix;
}

function journeyBlockingControlLabel(control: ClinicalJourneyBlockingControl) {
  switch (control) {
    case "configuration":
      return "configuration";
    case "context":
      return "context";
    case "masking":
      return "masking";
    case "regulatory":
      return "regulatory";
  }
}

function journeyBlockingControlTone(control: ClinicalJourneyBlockingControl): BadgeTone {
  switch (control) {
    case "configuration":
      return "accent";
    case "context":
      return "warning";
    case "masking":
      return "accent";
    case "regulatory":
      return "warning";
  }
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
  platformFilter: AccessMatrixPlatform | null,
) {
  if (moduleFilter && surface.module !== moduleFilter) return false;
  if (kindFilter && surface.kind !== kindFilter) return false;
  if (platformFilter && !surface.platforms.includes(platformFilter)) return false;
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
    ...surface.platforms,
    ...surface.requiredPermissions,
    ...surface.fieldAccessKeys,
    ...surface.activatesAfter,
    ...surface.printArtifacts,
    ...surface.printCopies,
    ...surface.printerProfiles,
    ...surface.platforms.map((platform) => accessSurfacePlatformRoute(surface, platform) ?? ""),
    ...surface.standardRefs,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function fieldCoverageMatches(
  row: AccessFieldCoverageRow,
  query: string,
  moduleFilter: string | null,
  kindFilter: AccessMatrixSurfaceKind | null,
  platformFilter: AccessMatrixPlatform | null,
) {
  if (
    moduleFilter &&
    row.module !== moduleFilter &&
    !row.surfaces.some((surface) => surface.module === moduleFilter)
  ) {
    return false;
  }
  if (kindFilter && row.kindCounts[kindFilter] === 0) return false;
  if (platformFilter && !row.platforms.includes(platformFilter)) return false;
  if (!query) return true;

  const haystack = [
    row.key,
    row.module,
    row.name,
    row.dataType,
    row.description ?? "",
    ...row.surfaces.map((surface) => surface.module),
    ...row.surfaceIds,
    ...row.platforms,
    ...row.maskingBehaviors,
    ...row.permissions,
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

function accessSurfacePlatformOptions() {
  return ACCESS_MATRIX_PLATFORMS.map((platform) => ({ value: platform, label: platform }));
}

function isAccessSurfaceKind(value: string): value is AccessMatrixSurfaceKind {
  return ACCESS_MATRIX_SURFACES.some((surface) => surface.kind === value);
}

function isAccessMatrixPlatform(value: string): value is AccessMatrixPlatform {
  return ACCESS_MATRIX_PLATFORMS.some((platform) => platform === value);
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
              tone="primary"
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
                            <Badge tone="neutral">{moduleFromPermission(permission.code)}</Badge>
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
                                <Badge tone="warning">{sharingRoles.length} roles</Badge>
                              </Tooltip>
                            ) : (
                              <Badge tone="neutral">Unique</Badge>
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
                              <Badge tone="neutral">{fieldModule(field)}</Badge>
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
                                  <Badge tone="warning">{restrictedRoles.length} roles</Badge>
                                </Tooltip>
                              ) : (
                                <Badge tone="neutral">None</Badge>
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
                        <Badge tone="neutral">
                          {summary.selected}/{summary.total}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge tone="warning">{summary.overlapping}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge tone="danger">{summary.restrictedFields}</Badge>
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
  const permissionSources = useMemo(
    () =>
      new Map(
        PERMISSIONS.map((permission) => [
          permission.code,
          resolvePermissionSources({
            bypassRole,
            denied: deniedPermissions.has(permission.code),
            extraGrant: extraPermissions.has(permission.code),
            groups: userGroups,
            permissionCode: permission.code,
            roleGrant: rolePermissionSet.has(permission.code),
            temporaryGrant: temporaryPermissions.has(permission.code),
          }),
        ]),
      ),
    [
      bypassRole,
      deniedPermissions,
      extraPermissions,
      rolePermissionSet,
      temporaryPermissions,
      userGroups,
    ],
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

  const sourceForPermission = useCallback(
    (permission: string): PermissionSourceResolution =>
      permissionSources.get(permission) ??
      resolvePermissionSources({
        bypassRole,
        denied: deniedPermissions.has(permission),
        extraGrant: extraPermissions.has(permission),
        groups: userGroups,
        permissionCode: permission,
        roleGrant: rolePermissionSet.has(permission),
        temporaryGrant: temporaryPermissions.has(permission),
      }),
    [
      bypassRole,
      deniedPermissions,
      extraPermissions,
      permissionSources,
      rolePermissionSet,
      temporaryPermissions,
      userGroups,
    ],
  );

  const permissionIsEffective = (permission: string) => sourceForPermission(permission).effective;

  const effectiveCount = PERMISSIONS.filter((permission) =>
    permissionIsEffective(permission.code),
  ).length;

  const overlapCount = PERMISSIONS.filter((permission) => {
    const source = sourceForPermission(permission.code);
    return source.duplicateGrant || source.deniedOverlap;
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
        const source = sourceForPermission(permission.code);
        return {
          ...source,
          permission,
        };
      }).filter((row) => row.duplicateGrant || row.deniedOverlap),
    [sourceForPermission],
  );
  const redundantExtraPermissions = useMemo(
    () =>
      PERMISSIONS.filter(
        (permission) => sourceForPermission(permission.code).redundantIndividualExtra,
      ),
    [sourceForPermission],
  );
  const deniedActiveGrantPermissions = useMemo(
    () => PERMISSIONS.filter((permission) => sourceForPermission(permission.code).deniedOverlap),
    [sourceForPermission],
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
      <Alert icon={<IconUserShield size={16} />} tone="info">
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
              {groupPermissions.size} unique group permission grants
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
              tone="primary"
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
            tone={
              redundantExtraPermissions.length > 0 || deniedActiveGrantPermissions.length > 0
                ? "warning"
                : "success"
            }
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
                <Text size="xs" c="dimmed">
                  Group overlap is counted per granting group, so two access groups granting the
                  same permission are visible before you add an individual override.
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
                  tone="secondary"
                  size="xs"
                  disabled={!canUpdate || bypassRole || redundantExtraPermissions.length === 0}
                  onClick={removeRedundantExtras}
                >
                  Remove duplicate extras
                </Button>
                <Button
                  tone="subtle-danger"
                  size="xs"
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
                      const source = sourceForPermission(permission.code);
                      const groupGrant = source.groupGrantCount > 0;
                      const overrideValue = source.denied
                        ? "deny"
                        : source.extraGrant
                          ? "extra"
                          : "inherit";
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
                              {bypassRole && <Badge tone="success">Bypass</Badge>}
                              {!bypassRole && source.roleGrant && <Badge tone="info">Role</Badge>}
                              {!bypassRole && groupGrant && (
                                <Tooltip
                                  label={source.groupGrantNames.join(", ")}
                                  multiline
                                  w={280}
                                >
                                  <Badge tone="info">
                                    {source.groupGrantCount > 1
                                      ? `Groups ${source.groupGrantCount}`
                                      : "Group"}
                                  </Badge>
                                </Tooltip>
                              )}
                              {!bypassRole && source.extraGrant && (
                                <Badge tone="success">Individual</Badge>
                              )}
                              {!bypassRole && source.temporaryGrant && (
                                <Badge tone="accent">Temporary</Badge>
                              )}
                              {!bypassRole && source.denied && <Badge tone="danger">Denied</Badge>}
                              {!bypassRole && userGroups.length > 0 && !groupGrant && (
                                <Tooltip label={groupNames(userGroups)} multiline w={280}>
                                  <Badge tone="info">Group scope</Badge>
                                </Tooltip>
                              )}
                              {!bypassRole && source.sourceCount === 0 && !source.denied && (
                                <Badge tone="neutral">None</Badge>
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
                            <Badge tone={source.effective ? "success" : "neutral"}>
                              {source.effective ? "Allowed" : "Not granted"}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            {source.duplicateGrant ? (
                              <Badge tone="warning">Duplicate grant</Badge>
                            ) : source.deniedOverlap ? (
                              <Badge tone="danger">Deny overrides</Badge>
                            ) : (
                              <Badge tone="neutral">Clean</Badge>
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
                  <Alert tone="success">
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
                                {row.roleGrant && <Badge tone="info">Role</Badge>}
                                {row.groupGrantCount > 0 && (
                                  <Tooltip label={row.groupGrantNames.join(", ")} multiline w={280}>
                                    <Badge tone="info">
                                      {row.groupGrantCount > 1
                                        ? `Groups ${row.groupGrantCount}`
                                        : "Group"}
                                    </Badge>
                                  </Tooltip>
                                )}
                                {row.extraGrant && <Badge tone="success">Individual</Badge>}
                                {row.temporaryGrant && <Badge tone="accent">Temporary</Badge>}
                                {row.denied && <Badge tone="danger">Denied</Badge>}
                                {userGroups.length > 0 && row.groupGrantCount === 0 && (
                                  <Tooltip label={groupNames(userGroups)} multiline w={280}>
                                    <Badge tone="info">Group scope</Badge>
                                  </Tooltip>
                                )}
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4}>
                                {row.duplicateGrant && (
                                  <Badge tone="warning">Duplicate grant</Badge>
                                )}
                                {row.deniedOverlap && (
                                  <Badge tone="danger">Deny overrides grant</Badge>
                                )}
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Badge tone={row.effective ? "success" : "neutral"}>
                                {row.effective ? "Allowed" : "Not granted"}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Group gap="xs">
                                {row.extraGrant && row.sourceCount > 1 && (
                                  <Button
                                    tone="secondary"
                                    size="xs"
                                    disabled={!canUpdate || bypassRole}
                                    onClick={() => removeExtraPermission(row.permission.code)}
                                  >
                                    Remove extra
                                  </Button>
                                )}
                                {row.deniedOverlap && (
                                  <Button
                                    tone="subtle-danger"
                                    size="xs"
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
                              <Badge tone={roleLevel === "edit" ? "neutral" : "warning"}>
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
                              <Badge tone={effectiveLevel === "edit" ? "success" : "danger"}>
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
  const { t } = useTranslation("admin");
  const [surfaceFilter, setSurfaceFilter] = useState("");
  const pacedSurfaceFilter = usePacedQueryValue(surfaceFilter, 200).trim().toLowerCase();
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<AccessMatrixSurfaceKind | null>(null);
  const [platformFilter, setPlatformFilter] = useState<AccessMatrixPlatform | null>(null);
  const fieldsByKey = useMemo(() => fieldByKey(), []);

  const visibleSurfaces = useMemo(
    () =>
      ACCESS_MATRIX_SURFACES.filter((surface) =>
        surfaceMatches(surface, pacedSurfaceFilter, moduleFilter, kindFilter, platformFilter),
      ),
    [kindFilter, moduleFilter, pacedSurfaceFilter, platformFilter],
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
    () => buildWorkflowKindCoverage(ACCESS_MATRIX_WORKFLOW_EXPECTATIONS, ACCESS_MATRIX_SURFACES),
    [],
  );
  const workflowCoverageSummary = useMemo(
    () => summarizeWorkflowKindCoverage(workflowCoverage),
    [workflowCoverage],
  );
  const patientFlowGovernanceRows = useMemo(
    () => buildPatientFlowGovernanceCoverage(ACCESS_MATRIX_SURFACES),
    [],
  );
  const patientFlowGovernanceSummary = useMemo(
    () => summarizePatientFlowGovernance(patientFlowGovernanceRows),
    [patientFlowGovernanceRows],
  );
  const workflowShapeGovernanceRows = useMemo(
    () => buildWorkflowShapeGovernanceCoverage(ACCESS_MATRIX_SURFACES),
    [],
  );
  const workflowShapeGovernanceSummary = useMemo(
    () => summarizeWorkflowShapeGovernance(workflowShapeGovernanceRows),
    [workflowShapeGovernanceRows],
  );
  const fieldKeysMissingFromRegistry = [...coveredFieldKeys].filter((key) => !fieldsByKey.has(key));
  const registeredFieldsNotMapped = FIELD_ACCESS_FIELDS.filter(
    (field) => !coveredFieldKeys.has(fieldKey(field)),
  );
  const fieldCoverageRows = useMemo(
    () => buildAccessFieldCoverage(FIELD_ACCESS_FIELDS, ACCESS_MATRIX_SURFACES),
    [],
  );
  const visibleFieldCoverageRows = useMemo(
    () =>
      fieldCoverageRows.filter((row) =>
        fieldCoverageMatches(row, pacedSurfaceFilter, moduleFilter, kindFilter, platformFilter),
      ),
    [fieldCoverageRows, kindFilter, moduleFilter, pacedSurfaceFilter, platformFilter],
  );
  const fieldCoverageSummary = useMemo(
    () => summarizeAccessFieldCoverage(fieldCoverageRows),
    [fieldCoverageRows],
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
  const routeCoverageRows = useMemo(
    () => buildNavRouteCoverage(NAV_GROUPS, ACCESS_MATRIX_SURFACES),
    [],
  );
  const routeCoverageSummary = useMemo(
    () => summarizeNavRouteCoverage(routeCoverageRows),
    [routeCoverageRows],
  );
  const routeCoverageGapRows = routeCoverageRows.filter((row) => row.status !== "covered");
  const printableCoverageRows = useMemo(() => buildPrintableCoverage(ACCESS_MATRIX_SURFACES), []);
  const printableCoverageSummary = useMemo(
    () => summarizePrintableCoverage(printableCoverageRows),
    [printableCoverageRows],
  );
  const journeyActionCoverageRows = useMemo(
    () => buildJourneyActionCoverage(CORE_PATIENT_JOURNEY_ACTIONS, ACCESS_MATRIX_SURFACES),
    [],
  );
  const journeyActionCoverageSummary = useMemo(
    () => summarizeJourneyActionCoverage(journeyActionCoverageRows),
    [journeyActionCoverageRows],
  );
  const reportEventCoverageRows = useMemo(() => buildReportEventCoverage(), []);
  const reportEventCoverageSummary = useMemo(
    () => summarizeReportEventCoverage(reportEventCoverageRows),
    [reportEventCoverageRows],
  );
  const surfaceGovernanceRows = useMemo(
    () => buildAccessSurfaceGovernanceCoverage(ACCESS_MATRIX_SURFACES),
    [],
  );
  const surfaceGovernanceGapRows = useMemo(
    () => buildAccessSurfaceGovernanceGapRows(ACCESS_MATRIX_SURFACES),
    [],
  );
  const surfaceGovernanceSummary = useMemo(
    () => summarizeAccessSurfaceGovernance(surfaceGovernanceRows),
    [surfaceGovernanceRows],
  );
  const platformCoverageRows = useMemo(
    () => buildAccessPlatformCoverage(ACCESS_MATRIX_SURFACES),
    [],
  );
  const platformCoverageSummary = useMemo(
    () => summarizeAccessPlatformCoverage(platformCoverageRows),
    [platformCoverageRows],
  );

  return (
    <Stack gap="md">
      <Alert icon={<IconShieldLock size={16} />} tone="info">
        <Text size="sm">
          This catalog maps routes, tabs, tables, columns, inputs, print actions and widgets to
          permissions plus field-access keys. Use it to find loose screens before adding role or
          user overrides.
        </Text>
      </Alert>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
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
            Field Governance
          </Text>
          <Text fw={700}>
            {fieldCoverageSummary.complete}/{fieldCoverageSummary.total}
          </Text>
          <Text size="xs" c="dimmed">
            {fieldCoverageSummary.edgeMapped} edge, {fieldCoverageSummary.printMapped} printable
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
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Route Coverage
          </Text>
          <Text fw={700}>
            {routeCoverageSummary.covered}/{routeCoverageSummary.total}
          </Text>
          <Text size="xs" c="dimmed">
            {routeCoverageSummary.unmapped} unmapped, {routeCoverageSummary.permissionGaps} gaps
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Printable Routing
          </Text>
          <Text fw={700}>
            {printableCoverageSummary.complete}/{printableCoverageSummary.total}
          </Text>
          <Text size="xs" c="dimmed">
            {printableCoverageSummary.customerOfficeRequired} customer-office,{" "}
            {printableCoverageSummary.printerRequired} printer required
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Action Matrix
          </Text>
          <Text fw={700}>
            {journeyActionCoverageSummary.covered}/{journeyActionCoverageSummary.total}
          </Text>
          <Text size="xs" c="dimmed">
            {journeyActionCoverageSummary.routeLinked} routed, {journeyActionCoverageSummary.gaps}{" "}
            gaps
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Report Events
          </Text>
          <Text fw={700}>
            {reportEventCoverageSummary.complete}/{reportEventCoverageSummary.total}
          </Text>
          <Text size="xs" c="dimmed">
            {reportEventCoverageSummary.reportTargets} reports,{" "}
            {reportEventCoverageSummary.indicatorTargets} indicators,{" "}
            {reportEventCoverageSummary.journeyActionLinks} journey actions
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Workflow Coverage
          </Text>
          <Text fw={700}>
            {workflowCoverageSummary.complete}/{workflowCoverageSummary.total}
          </Text>
          <Text size="xs" c="dimmed">
            {workflowCoverageSummary.gaps} kind gaps, {workflowCoverageSummary.eventDriven} event
            driven
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Patient Flow
          </Text>
          <Text fw={700}>
            {patientFlowGovernanceSummary.complete}/{patientFlowGovernanceSummary.total}
          </Text>
          <Text size="xs" c="dimmed">
            {patientFlowGovernanceSummary.edgeReady} edge-ready,{" "}
            {patientFlowGovernanceSummary.publicDisplayMapped} public-safe
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            {t("accessMatrix.shapeGovernance.summaryLabel")}
          </Text>
          <Text fw={700}>
            {workflowShapeGovernanceSummary.complete}/{workflowShapeGovernanceSummary.total}
          </Text>
          <Text size="xs" c="dimmed">
            {t("accessMatrix.shapeGovernance.summaryDetail", {
              bed: workflowShapeGovernanceSummary.bedAssignmentMapped,
              handoff: workflowShapeGovernanceSummary.handoffMapped,
              stop: workflowShapeGovernanceSummary.stopCheckMapped,
            })}
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Surface Governance
          </Text>
          <Text fw={700}>
            {surfaceGovernanceSummary.covered}/{surfaceGovernanceSummary.total}
          </Text>
          <Text size="xs" c="dimmed">
            {surfaceGovernanceSummary.gaps} screen, tab, table, input or action gaps
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Platform Matrix
          </Text>
          <Text fw={700}>
            {platformCoverageSummary.covered}/{platformCoverageSummary.total}
          </Text>
          <Text size="xs" c="dimmed">
            web, mobile, TV and kiosk surfaces mapped
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Edge Displays
          </Text>
          <Text fw={700}>
            {platformCoverageSummary.tvSurfaces}/{platformCoverageSummary.kioskSurfaces}
          </Text>
          <Text size="xs" c="dimmed">
            TV / kiosk surfaces, {platformCoverageSummary.gaps} platform gaps
          </Text>
        </Card>
      </SimpleGrid>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>Patient Flow Governance</Text>
              <Text size="sm" c="dimmed">
                Tracks the real hospital chain from registration through OPD, IPD, emergency, camp,
                pharmacy and billing, including web, mobile, TV, kiosk, print and public-display
                governance evidence.
              </Text>
            </Stack>
            <Badge tone={patientFlowGovernanceSummary.gaps > 0 ? "warning" : "success"}>
              {patientFlowGovernanceSummary.gaps} flow gaps
            </Badge>
          </Group>

          <ScrollArea.Autosize mah={420}>
            <Table stickyHeader highlightOnHover verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Hospital step</Table.Th>
                  <Table.Th>Platforms</Table.Th>
                  <Table.Th>Launch targets</Table.Th>
                  <Table.Th>Surface types</Table.Th>
                  <Table.Th>Governance</Table.Th>
                  <Table.Th>Print / public display</Table.Th>
                  <Table.Th>Gaps</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {patientFlowGovernanceRows.map((row) => (
                  <Table.Tr key={row.key}>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {row.label}
                      </Text>
                      <Group gap={4} mt={4}>
                        {row.modules.map((module) => (
                          <Badge tone="neutral" key={module}>
                            {module}
                          </Badge>
                        ))}
                        <Badge tone="neutral">{row.surfaces.length} surfaces</Badge>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {row.requiredPlatforms.map((platform) => (
                          <Badge
                            tone={row.missingPlatforms.includes(platform) ? "warning" : "info"}
                            key={platform}
                          >
                            {platform}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {row.requiredPlatforms.map((platform) => (
                          <Badge
                            tone={
                              row.missingLaunchTargetPlatforms.includes(platform)
                                ? "warning"
                                : "success"
                            }
                            key={platform}
                          >
                            {platform}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Group gap={4}>
                          {row.requiredKinds.map((kind) => (
                            <Badge
                              tone={row.missingKinds.includes(kind) ? "warning" : "neutral"}
                              key={kind}
                            >
                              {kind}
                            </Badge>
                          ))}
                        </Group>
                        <Text size="xs" c="dimmed">
                          {row.presentKinds.length} mapped surface types
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Badge tone={row.permissionMapped > 0 ? "success" : "warning"}>
                          {row.permissionMapped} permission
                        </Badge>
                        <Badge tone={row.fieldMapped > 0 ? "info" : "warning"}>
                          {row.fieldMapped} field maps
                        </Badge>
                        <Badge tone={row.maskingMapped > 0 ? "accent" : "warning"}>
                          {row.maskingMapped} masking
                        </Badge>
                        <Badge tone={row.eventActivated > 0 ? "success" : "warning"}>
                          {row.eventActivated} events
                        </Badge>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Badge tone={row.printSurfaces > 0 ? "info" : "neutral"}>
                          {row.printSurfaces} print
                        </Badge>
                        <Badge
                          tone={
                            !row.requiresPublicDisplayPolicy || row.publicDisclosureMapped > 0
                              ? "success"
                              : "warning"
                          }
                        >
                          {row.publicDisclosureMapped}/{row.publicDisplaySurfaces} public-safe
                        </Badge>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      {row.gaps.length > 0 ? (
                        <Group gap={4}>
                          {row.gaps.map((gap) => (
                            <Badge tone="warning" key={gap}>
                              {PATIENT_FLOW_GOVERNANCE_GAP_LABELS[gap]}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        <Badge tone="success">complete</Badge>
                      )}
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
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>{t("accessMatrix.shapeGovernance.title")}</Text>
              <Text size="sm" c="dimmed">
                {t("accessMatrix.shapeGovernance.description")}
              </Text>
            </Stack>
            <Badge tone={workflowShapeGovernanceSummary.gaps > 0 ? "warning" : "success"}>
              {t("accessMatrix.shapeGovernance.gapBadge", {
                count: workflowShapeGovernanceSummary.gaps,
              })}
            </Badge>
          </Group>

          <ScrollArea.Autosize mah={420}>
            <Table stickyHeader highlightOnHover verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("accessMatrix.shapeGovernance.columns.workflow")}</Table.Th>
                  <Table.Th>{t("accessMatrix.shapeGovernance.columns.shapeCues")}</Table.Th>
                  <Table.Th>{t("accessMatrix.shapeGovernance.columns.semantics")}</Table.Th>
                  <Table.Th>{t("accessMatrix.shapeGovernance.columns.platforms")}</Table.Th>
                  <Table.Th>{t("accessMatrix.shapeGovernance.columns.accessEvidence")}</Table.Th>
                  <Table.Th>{t("accessMatrix.shapeGovernance.columns.gaps")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {workflowShapeGovernanceRows.map((row) => (
                  <Table.Tr key={row.key}>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {t(row.labelKey)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t(row.descriptionKey)}
                      </Text>
                      <Group gap={4} mt={4}>
                        {row.modules.map((module) => (
                          <Badge tone="neutral" key={module}>
                            {module}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        {row.scenarios.map((scenario) => (
                          <OperationalSignal
                            key={scenario.key}
                            label={t(scenario.labelKey)}
                            shape={scenario.shape}
                            size="xs"
                            tone={scenario.tone}
                          />
                        ))}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        {row.requiredSemantics.map((semantic) => (
                          <Badge
                            tone={row.missingSemantics.includes(semantic) ? "warning" : "info"}
                            key={semantic}
                          >
                            {t(`accessMatrix.shapeGovernance.semantics.${semantic}`)}
                          </Badge>
                        ))}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {row.requiredPlatforms.map((platform) => (
                          <Badge
                            tone={row.missingPlatforms.includes(platform) ? "warning" : "success"}
                            key={platform}
                          >
                            {platform}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Badge tone={row.accessSurfaceCount > 0 ? "info" : "warning"}>
                          {t("accessMatrix.shapeGovernance.evidence.surfaces", {
                            count: row.accessSurfaceCount,
                          })}
                        </Badge>
                        <Badge tone={row.maskingMapped > 0 ? "accent" : "warning"}>
                          {t("accessMatrix.shapeGovernance.evidence.masking", {
                            count: row.maskingMapped,
                          })}
                        </Badge>
                        <Badge tone={row.eventActivated > 0 ? "success" : "warning"}>
                          {t("accessMatrix.shapeGovernance.evidence.events", {
                            count: row.eventActivated,
                          })}
                        </Badge>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      {row.gaps.length > 0 ? (
                        <Group gap={4}>
                          {row.gaps.map((gap) => (
                            <Badge tone="warning" key={gap}>
                              {t(WORKFLOW_SHAPE_GOVERNANCE_GAP_KEYS[gap])}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        <Badge tone="success">{t("accessMatrix.shapeGovernance.complete")}</Badge>
                      )}
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
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>Critical Workflow Coverage</Text>
              <Text size="sm" c="dimmed">
                Checks whether the main patient journey has mapped screens, tabs, tables, inputs,
                actions, print surfaces, widgets, permissions, and event activations.
              </Text>
            </Stack>
            <Badge tone={workflowCoverageSummary.gaps > 0 ? "warning" : "success"}>
              {workflowCoverageSummary.gaps} workflow gaps
            </Badge>
          </Group>
          <ScrollArea.Autosize mah={360}>
            <Table stickyHeader highlightOnHover verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Workflow</Table.Th>
                  <Table.Th>Modules</Table.Th>
                  <Table.Th>Mapped surfaces</Table.Th>
                  <Table.Th>Surface types</Table.Th>
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
                          <Badge tone="neutral" key={module}>
                            {module}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge tone={workflow.surfaces.length > 0 ? "info" : "danger"}>
                        {workflow.surfaces.length}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {workflow.presentKinds.map((kind) => (
                          <Badge tone="neutral" key={kind}>
                            {kind}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge tone={workflow.activatedSurfaces > 0 ? "success" : "warning"}>
                        {workflow.activatedSurfaces}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Badge tone={workflow.printSurfaces > 0 ? "accent" : "neutral"}>
                          {workflow.printSurfaces} print
                        </Badge>
                        {workflow.printerRequired > 0 && (
                          <Badge tone="info">{workflow.printerRequired} printer</Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {workflow.missingKinds.length > 0 ? (
                        <Group gap={4}>
                          {workflow.missingKinds.map((kind) => (
                            <Badge tone="warning" key={kind}>
                              {kind}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        <Badge tone="success">complete</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge tone={workflow.permissions.size > 0 ? "success" : "danger"}>
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
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>Report Event Source Coverage</Text>
              <Text size="sm" c="dimmed">
                Shows which workflow events and payload keys feed report and indicator readiness so
                operational dashboards stay connected to registration, OPD, IPD, ER, camp, pharmacy,
                billing and NABH evidence.
              </Text>
            </Stack>
            <Badge tone={reportEventCoverageSummary.gaps > 0 ? "warning" : "success"}>
              {reportEventCoverageSummary.gaps} event source gaps
            </Badge>
          </Group>

          <ScrollArea.Autosize mah={420}>
            <Table stickyHeader highlightOnHover verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Source</Table.Th>
                  <Table.Th>Events</Table.Th>
                  <Table.Th>Journey actions</Table.Th>
                  <Table.Th>Payload evidence</Table.Th>
                  <Table.Th>Reports / indicators</Table.Th>
                  <Table.Th>Gaps</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {reportEventCoverageRows.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      <Group gap={6} mb={2}>
                        <Badge tone="neutral">{row.family}</Badge>
                        <Badge tone={row.readiness === "event_backed" ? "success" : "warning"}>
                          {row.readiness === "event_backed" ? "event backed" : "capture needed"}
                        </Badge>
                      </Group>
                      <Text size="sm" fw={600}>
                        {row.label}
                      </Text>
                      <Text size="xs" ff="var(--font-mono, monospace)" c="dimmed">
                        {row.id}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {row.sourceEvents.map((eventName) => (
                          <Badge
                            tone={row.missingEvents.includes(eventName) ? "warning" : "info"}
                            key={eventName}
                          >
                            {eventName}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Group gap={4}>
                          {row.journeyActionIds.length === 0 ? (
                            <Badge tone="neutral">direct event source</Badge>
                          ) : (
                            row.journeyActionIds.map((actionId) => (
                              <Badge
                                tone={
                                  row.missingJourneyActionIds.includes(actionId)
                                    ? "warning"
                                    : "success"
                                }
                                key={actionId}
                              >
                                {actionId}
                              </Badge>
                            ))
                          )}
                        </Group>
                        {row.journeyActionEvents.length > 0 && (
                          <Group gap={4}>
                            {row.journeyActionEvents.map((eventName) => (
                              <Badge
                                tone={
                                  row.missingJourneyActionEvents.includes(eventName)
                                    ? "warning"
                                    : "info"
                                }
                                key={eventName}
                              >
                                emits {eventName}
                              </Badge>
                            ))}
                          </Group>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Group gap={4}>
                          {row.requiredPayloadKeys.map((key) => (
                            <Badge
                              tone={row.missingPayloadKeys.includes(key) ? "warning" : "success"}
                              key={key}
                            >
                              {key}
                            </Badge>
                          ))}
                        </Group>
                        <Text size="xs" c="dimmed">
                          {row.availablePayloadKeys.length} registered payload keys available
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Group gap={4}>
                          {row.reportTargets.map((reportId) => (
                            <Badge tone="accent" key={reportId}>
                              {reportId}
                            </Badge>
                          ))}
                        </Group>
                        <Group gap={4}>
                          {row.indicatorTargets.map((indicatorId) => (
                            <Badge tone="info" key={indicatorId}>
                              {indicatorId}
                            </Badge>
                          ))}
                        </Group>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      {row.gaps.length > 0 ? (
                        <Group gap={4}>
                          {row.gaps.map((gap) => (
                            <Badge tone="warning" key={gap}>
                              {REPORT_EVENT_COVERAGE_GAP_LABELS[gap]}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        <Badge tone="success">complete</Badge>
                      )}
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
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>Field-Level Masking Coverage</Text>
              <Text size="sm" c="dimmed">
                Shows every registered sensitive field and the surfaces that govern it, including
                screens, tabs, tables, columns, inputs, actions, printables and edge-device targets.
              </Text>
            </Stack>
            <Group gap={6}>
              <Badge tone="info">{visibleFieldCoverageRows.length} visible</Badge>
              <Badge tone={fieldCoverageSummary.gaps > 0 ? "warning" : "success"}>
                {fieldCoverageSummary.gaps} field gaps
              </Badge>
            </Group>
          </Group>

          <ScrollArea.Autosize mah={420}>
            <Table stickyHeader highlightOnHover verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Field</Table.Th>
                  <Table.Th>Surface types</Table.Th>
                  <Table.Th>Platforms / routes</Table.Th>
                  <Table.Th>Masking / print</Table.Th>
                  <Table.Th>Permissions / events</Table.Th>
                  <Table.Th>Gaps</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visibleFieldCoverageRows.map((row) => (
                  <Table.Tr key={row.key}>
                    <Table.Td>
                      <Group gap={6} mb={2}>
                        <Badge tone="neutral">{row.module}</Badge>
                        <Badge tone="neutral">{row.dataType}</Badge>
                      </Group>
                      <Text size="sm" fw={600}>
                        {row.name}
                      </Text>
                      <Text size="xs" ff="var(--font-mono, monospace)" c="dimmed">
                        {row.key}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {Object.entries(row.kindCounts)
                          .filter(([, count]) => count > 0)
                          .map(([kind, count]) => (
                            <Badge tone="neutral" key={kind}>
                              {kind}: {count}
                            </Badge>
                          ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Group gap={4}>
                          {row.platforms.map((platform) => (
                            <Badge tone="info" key={platform}>
                              {platform}
                            </Badge>
                          ))}
                        </Group>
                        <Group gap={4}>
                          <Badge
                            tone={row.routeMapped === row.surfaces.length ? "success" : "warning"}
                          >
                            {row.routeMapped}/{row.surfaces.length} routes
                          </Badge>
                          <Badge tone={row.edgeMapped > 0 ? "info" : "neutral"}>
                            {row.edgeMapped} edge
                          </Badge>
                        </Group>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Group gap={4}>
                          {row.maskingBehaviors.map((masking) => (
                            <Badge tone="accent" key={masking}>
                              {masking}
                            </Badge>
                          ))}
                        </Group>
                        <Badge tone={row.printMapped > 0 ? "info" : "neutral"}>
                          {row.printMapped} print
                        </Badge>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Badge tone={row.permissions.length > 0 ? "success" : "warning"}>
                          {row.permissions.length} permissions
                        </Badge>
                        <Badge tone={row.eventActivated > 0 ? "info" : "neutral"}>
                          {row.eventActivated} event surfaces
                        </Badge>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      {row.gaps.length > 0 ? (
                        <Group gap={4}>
                          {row.gaps.map((gap) => (
                            <Badge tone="warning" key={gap}>
                              {ACCESS_FIELD_COVERAGE_GAP_LABELS[gap]}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        <Badge tone="success">complete</Badge>
                      )}
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
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>Platform Surface Coverage</Text>
              <Text size="sm" c="dimmed">
                Shows whether access surfaces are mapped for web, mobile, TV and kiosk. Edge
                displays should stay token-only or masked, but still need route, permission, field
                and masking metadata.
              </Text>
            </Stack>
            <Badge tone={platformCoverageSummary.gaps > 0 ? "warning" : "success"}>
              {platformCoverageSummary.gaps} platform gaps
            </Badge>
          </Group>

          <ScrollArea.Autosize mah={360}>
            <Table stickyHeader highlightOnHover verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Platform</Table.Th>
                  <Table.Th>Surfaces</Table.Th>
                  <Table.Th>Modules</Table.Th>
                  <Table.Th>Surface types</Table.Th>
                  <Table.Th>Route / permission</Table.Th>
                  <Table.Th>Field / masking</Table.Th>
                  <Table.Th>Event activation</Table.Th>
                  <Table.Th>Gaps</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {platformCoverageRows.map((row) => (
                  <Table.Tr key={row.platform}>
                    <Table.Td>
                      <Badge tone="info">{row.platform}</Badge>
                    </Table.Td>
                    <Table.Td>{row.surfaces.length}</Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {row.modules.map((module) => (
                          <Badge tone="neutral" key={module}>
                            {module}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {Object.entries(row.kindCounts)
                          .filter(([, count]) => count > 0)
                          .map(([kind, count]) => (
                            <Badge tone="neutral" key={kind}>
                              {kind}: {count}
                            </Badge>
                          ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Badge
                          tone={row.routeMapped === row.surfaces.length ? "success" : "neutral"}
                        >
                          {row.routeMapped} routes
                        </Badge>
                        <Badge
                          tone={
                            row.platformRouteMapped === row.surfaces.length ? "success" : "warning"
                          }
                        >
                          {row.platformRouteMapped} launch targets
                        </Badge>
                        <Badge
                          tone={
                            row.permissionMapped === row.surfaces.length ? "success" : "warning"
                          }
                        >
                          {row.permissionMapped} permissions
                        </Badge>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Badge
                          tone={row.fieldMapped === row.surfaces.length ? "success" : "neutral"}
                        >
                          {row.fieldMapped} field maps
                        </Badge>
                        <Badge
                          tone={row.maskingMapped === row.surfaces.length ? "success" : "warning"}
                        >
                          {row.maskingMapped} masking
                        </Badge>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Badge tone={row.eventActivated > 0 ? "info" : "neutral"}>
                        {row.eventActivated}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge tone={row.governanceGapSurfaces > 0 ? "warning" : "success"}>
                        {row.governanceGapSurfaces}
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
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>Screen, Tab, Table and Input Governance</Text>
              <Text size="sm" c="dimmed">
                Pulls every registered surface type into one permission/masking matrix so admins can
                see whether routes, tabs, tables, columns, input boxes, action buttons and widgets
                have permissions, field-access keys, masking behavior and event activation.
              </Text>
            </Stack>
            <Badge tone={surfaceGovernanceSummary.gaps > 0 ? "warning" : "success"}>
              {surfaceGovernanceSummary.gaps} governance gaps
            </Badge>
          </Group>

          <ScrollArea.Autosize mah={360}>
            <Table stickyHeader highlightOnHover verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Surface type</Table.Th>
                  <Table.Th>Total</Table.Th>
                  <Table.Th>Routes</Table.Th>
                  <Table.Th>Permissions</Table.Th>
                  <Table.Th>Field keys</Table.Th>
                  <Table.Th>Masking</Table.Th>
                  <Table.Th>Event activation</Table.Th>
                  <Table.Th>Gaps</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {surfaceGovernanceRows.map((row) => (
                  <Table.Tr key={row.kind}>
                    <Table.Td>
                      <Badge tone="neutral">{row.kind}</Badge>
                    </Table.Td>
                    <Table.Td>{row.total}</Table.Td>
                    <Table.Td>{row.routeMapped}</Table.Td>
                    <Table.Td>{row.permissionMapped}</Table.Td>
                    <Table.Td>{row.fieldMapped}</Table.Td>
                    <Table.Td>{row.maskingMapped}</Table.Td>
                    <Table.Td>{row.eventActivated}</Table.Td>
                    <Table.Td>
                      <Badge tone={row.gapSurfaces > 0 ? "warning" : "success"}>
                        {row.gapSurfaces}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>

          {surfaceGovernanceGapRows.length > 0 ? (
            <ScrollArea.Autosize mah={360}>
              <Table stickyHeader highlightOnHover verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Surface</Table.Th>
                    <Table.Th>Route / table / tab</Table.Th>
                    <Table.Th>Gaps</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {surfaceGovernanceGapRows.map((row) => (
                    <Table.Tr key={row.surfaceId}>
                      <Table.Td>
                        <Group gap={4} mb={2}>
                          <Badge tone="neutral">{row.module}</Badge>
                          <Badge tone="neutral">{row.kind}</Badge>
                        </Group>
                        <Text size="sm" fw={600}>
                          {row.label}
                        </Text>
                        <Text size="xs" ff="var(--font-mono, monospace)" c="dimmed">
                          {row.surfaceId}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={2}>
                          <Text size="xs" ff="var(--font-mono, monospace)">
                            {row.route ?? "-"}
                          </Text>
                          {(row.table || row.tab) && (
                            <Text size="xs" c="dimmed">
                              {[
                                row.table ? `table: ${row.table}` : null,
                                row.tab ? `tab: ${row.tab}` : null,
                              ]
                                .filter(Boolean)
                                .join(" | ")}
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {row.gaps.map((gap) => (
                            <Badge tone="warning" key={gap}>
                              {ACCESS_SURFACE_GAP_LABELS[gap]}
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
            <Alert tone="success">
              Every registered access surface has the expected route, permission, masking, field,
              table, tab, and event metadata for its surface type.
            </Alert>
          )}
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>Journey Action Coverage</Text>
              <Text size="sm" c="dimmed">
                Compares patient handoff buttons against access-matrix surfaces so permissions and
                event activation stay aligned across registration, OPD, IPD, ER, camp, pharmacy and
                billing.
              </Text>
            </Stack>
            <Badge tone={journeyActionCoverageSummary.gaps > 0 ? "warning" : "success"}>
              {journeyActionCoverageSummary.gaps} action gaps
            </Badge>
          </Group>
          <Group gap={6}>
            <Badge tone="neutral">
              {journeyActionCoverageSummary.guardedActions} guarded actions
            </Badge>
            <Badge tone="info">{journeyActionCoverageSummary.routeLinked} route targets</Badge>
            <Badge tone="warning">{journeyActionCoverageSummary.contextControls} context</Badge>
            <Badge tone="accent">
              {journeyActionCoverageSummary.configurationControls} configuration
            </Badge>
            <Badge tone="accent">{journeyActionCoverageSummary.maskingControls} masking</Badge>
            <Badge tone="warning">
              {journeyActionCoverageSummary.regulatoryControls} regulatory
            </Badge>
          </Group>

          <ScrollArea.Autosize mah={360}>
            <Table stickyHeader highlightOnHover verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Action</Table.Th>
                  <Table.Th>Route targets</Table.Th>
                  <Table.Th>Permissions</Table.Th>
                  <Table.Th>Events</Table.Th>
                  <Table.Th>Controls</Table.Th>
                  <Table.Th>Mapped surfaces</Table.Th>
                  <Table.Th>Gaps</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {journeyActionCoverageRows.map((row) => (
                  <Table.Tr key={row.actionId}>
                    <Table.Td>
                      <Group gap={6} mb={2}>
                        <Badge tone="neutral">{row.module}</Badge>
                        {row.surfaces.map((surface) => (
                          <Badge tone="neutral" key={surface}>
                            {surface}
                          </Badge>
                        ))}
                      </Group>
                      <Text size="sm" fw={600}>
                        {row.label}
                      </Text>
                      <Text size="xs" ff="var(--font-mono, monospace)" c="dimmed">
                        {row.actionId}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {row.routeTargets.length > 0 ? (
                        <Stack gap={4}>
                          {row.routeTargets.map((route) => (
                            <Badge tone="info" key={route}>
                              {route}
                            </Badge>
                          ))}
                        </Stack>
                      ) : (
                        <Badge tone="neutral">component handler</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        {row.permissionCoverage.map((coverage) => (
                          <Group key={coverage.scope} gap={4} align="center">
                            <Badge tone={coverage.covered ? "neutral" : "warning"}>
                              {journeyPermissionScopeLabel(coverage.scope, coverage.permissionMode)}
                            </Badge>
                            {coverage.requiredPermissions.map((permission) => (
                              <Tooltip key={permission} label={permissionLabel(permission)}>
                                <Badge
                                  tone={
                                    coverage.missingPermissions.includes(permission)
                                      ? "warning"
                                      : "success"
                                  }
                                >
                                  {permission}
                                </Badge>
                              </Tooltip>
                            ))}
                          </Group>
                        ))}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {row.activationEvents.map((eventName) => (
                          <Badge
                            tone={
                              row.missingActivationEvents.includes(eventName) ? "warning" : "info"
                            }
                            key={eventName}
                          >
                            {eventName}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {row.blockingControls.length > 0 ? (
                        <Group gap={4}>
                          {row.blockingControls.map((control) => (
                            <Badge tone={journeyBlockingControlTone(control)} key={control}>
                              {journeyBlockingControlLabel(control)}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        <Badge tone="neutral">event/permission only</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {row.matchedSurfaceIds.length > 0 ? (
                        <Stack gap={4}>
                          <Group gap={4}>
                            {row.matchedSurfaceKinds.map((kind) => (
                              <Badge tone="neutral" key={kind}>
                                {kind}
                              </Badge>
                            ))}
                          </Group>
                          <Group gap={4}>
                            {row.matchedSurfaceIds.map((surfaceId) => (
                              <Badge tone="info" key={surfaceId}>
                                {surfaceId}
                              </Badge>
                            ))}
                          </Group>
                        </Stack>
                      ) : (
                        <Badge tone="danger">no surface</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {row.gaps.length > 0 ? (
                        <Group gap={4}>
                          {row.gaps.map((gap) => (
                            <Badge tone="warning" key={gap}>
                              {JOURNEY_ACTION_COVERAGE_GAP_LABELS[gap]}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        <Badge tone="success">complete</Badge>
                      )}
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
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>Printable Routing Coverage</Text>
              <Text size="sm" c="dimmed">
                Shows every printable sheet with customer, office, custody, reprint and printer
                routing so front-desk, pharmacy, billing, MRD and ward outputs stay explicit.
              </Text>
            </Stack>
            <Badge tone={printableCoverageSummary.gaps > 0 ? "warning" : "success"}>
              {printableCoverageSummary.gaps} printable gaps
            </Badge>
          </Group>

          <ScrollArea.Autosize mah={400}>
            <Table stickyHeader highlightOnHover verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Printable</Table.Th>
                  <Table.Th>Sheets</Table.Th>
                  <Table.Th>Copies</Table.Th>
                  <Table.Th>Printer</Table.Th>
                  <Table.Th>Gaps</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {printableCoverageRows.map((row) => (
                  <Table.Tr key={row.surfaceId}>
                    <Table.Td>
                      <Group gap={6} mb={2}>
                        <Badge tone="neutral">{row.module}</Badge>
                        {row.customerOfficeRequired && (
                          <Badge tone="accent">customer + office</Badge>
                        )}
                      </Group>
                      <Text size="sm" fw={600}>
                        {row.label}
                      </Text>
                      <Text size="xs" ff="var(--font-mono, monospace)" c="dimmed">
                        {row.route ?? row.surfaceId}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {row.artifacts.length > 0 ? (
                        <Group gap={4}>
                          {row.artifacts.map((artifact) => (
                            <Badge tone="neutral" key={artifact}>
                              {artifact}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        <Badge tone="warning">sheet not mapped</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {row.copies.length > 0 ? (
                        <Group gap={4}>
                          {row.copies.map((copy) => (
                            <Badge tone="accent" key={copy}>
                              {printCopyLabel(copy)}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        <Badge tone="warning">copy not mapped</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Badge tone={row.requiresPrinter ? "info" : "neutral"}>
                          {row.requiresPrinter ? "printer required" : "printer optional"}
                        </Badge>
                        {row.printerProfiles.length > 0 ? (
                          <Group gap={4}>
                            {row.printerProfiles.map((profile) => (
                              <Badge tone="info" key={profile}>
                                {profile}
                              </Badge>
                            ))}
                          </Group>
                        ) : (
                          <Badge tone={row.requiresPrinter ? "danger" : "neutral"}>
                            no printer profile
                          </Badge>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      {row.gaps.length > 0 ? (
                        <Group gap={4}>
                          {row.gaps.map((gap) => (
                            <Badge tone="warning" key={gap}>
                              {PRINTABLE_COVERAGE_GAP_LABELS[gap]}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        <Badge tone="success">complete</Badge>
                      )}
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
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>Navigation Route Coverage</Text>
              <Text size="sm" c="dimmed">
                Checks sidebar routes against the access-surface registry so screens do not stay
                outside role, group, individual, masking, printable, and printer governance.
              </Text>
            </Stack>
            <Badge tone={routeCoverageSummary.blocked > 0 ? "warning" : "success"}>
              {routeCoverageSummary.blocked} route gaps
            </Badge>
          </Group>

          {routeCoverageGapRows.length === 0 ? (
            <Alert tone="success">
              All navigation routes are mapped to access-matrix surfaces with matching permission
              requirements.
            </Alert>
          ) : (
            <ScrollArea.Autosize mah={360}>
              <Table stickyHeader highlightOnHover verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Route</Table.Th>
                    <Table.Th>Required permissions</Table.Th>
                    <Table.Th>Mapped surfaces</Table.Th>
                    <Table.Th>Missing</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {routeCoverageGapRows.map((row) => (
                    <Table.Tr key={row.path}>
                      <Table.Td>
                        <Text size="xs" ff="var(--font-mono, monospace)">
                          {row.path}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {row.labelKey}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {row.requiredPermissions.map((permission) => (
                            <Tooltip key={permission} label={permissionLabel(permission)}>
                              <Badge tone="success">{permission}</Badge>
                            </Tooltip>
                          ))}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        {row.surfaceIds.length > 0 ? (
                          <Group gap={4}>
                            {row.surfaceIds.map((surfaceId) => (
                              <Badge tone="info" key={surfaceId}>
                                {surfaceId}
                              </Badge>
                            ))}
                          </Group>
                        ) : (
                          <Badge tone="danger">no surface</Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {row.missingPermissions.length > 0 ? (
                          <Group gap={4}>
                            {row.missingPermissions.map((permission) => (
                              <Badge tone="warning" key={permission}>
                                {permission}
                              </Badge>
                            ))}
                          </Group>
                        ) : (
                          <Badge tone={row.status === "unmapped" ? "danger" : "success"}>
                            {row.status}
                          </Badge>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          )}
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-end">
            <Group gap="sm" align="flex-end">
              <TextInput
                label="Surface search"
                placeholder="Search screen, tab, table, input, field, permission or event"
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
              <Select
                label="Platform"
                placeholder="All platforms"
                data={accessSurfacePlatformOptions()}
                value={platformFilter}
                onChange={(value) =>
                  setPlatformFilter(value && isAccessMatrixPlatform(value) ? value : null)
                }
                clearable
              />
            </Group>
            <Badge tone="info">{visibleSurfaces.length} visible</Badge>
          </Group>

          <ScrollArea.Autosize mah="58vh">
            <Table stickyHeader highlightOnHover verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Surface</Table.Th>
                  <Table.Th>Platforms</Table.Th>
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
                        <Badge tone="neutral">{surface.module}</Badge>
                        <Badge tone="neutral">{surface.kind}</Badge>
                      </Group>
                      <Text size="sm" fw={600}>
                        {surface.label}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {surface.area}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {surface.platforms.map((platform) => (
                          <Badge tone="info" key={platform}>
                            {platform}
                          </Badge>
                        ))}
                      </Group>
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
                        <Group gap={4}>
                          {surface.platforms
                            .map((platform) => ({
                              platform,
                              target: accessSurfacePlatformRoute(surface, platform),
                            }))
                            .filter(
                              (item): item is { platform: AccessMatrixPlatform; target: string } =>
                                Boolean(item.target),
                            )
                            .map((item) => (
                              <Tooltip key={item.platform} label={item.target}>
                                <Badge tone="info">{item.platform} target</Badge>
                              </Tooltip>
                            ))}
                        </Group>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        {surface.requiredPermissions.map((permission) => (
                          <Tooltip key={permission} label={permissionLabel(permission)}>
                            <Badge tone="success">{permission}</Badge>
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
                                <Badge tone={field ? "warning" : "danger"}>{key}</Badge>
                              </Tooltip>
                            );
                          })}
                        </Stack>
                      ) : (
                        <Badge tone="neutral">none</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {surface.activatesAfter.length > 0 ? (
                        <Stack gap={4}>
                          {surface.activatesAfter.map((eventName) => (
                            <Badge tone="info" key={eventName}>
                              {eventName}
                            </Badge>
                          ))}
                        </Stack>
                      ) : (
                        <Badge tone="neutral">always</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {surface.kind === "print" || surface.requiresPrinter ? (
                        <Stack gap={4}>
                          <Group gap={4}>
                            {surface.printArtifacts.length > 0 ? (
                              surface.printArtifacts.map((artifact) => (
                                <Badge tone="neutral" key={artifact}>
                                  {artifact}
                                </Badge>
                              ))
                            ) : (
                              <Badge tone="warning">sheet not mapped</Badge>
                            )}
                          </Group>
                          <Group gap={4}>
                            {surface.printCopies.length > 0 ? (
                              surface.printCopies.map((copy) => (
                                <Badge tone="accent" key={copy}>
                                  {printCopyLabel(copy)}
                                </Badge>
                              ))
                            ) : (
                              <Badge tone="warning">copy not mapped</Badge>
                            )}
                          </Group>
                          <Group gap={4}>
                            {surface.printerProfiles.length > 0 ? (
                              surface.printerProfiles.map((profile) => (
                                <Badge tone="info" key={profile}>
                                  {profile}
                                </Badge>
                              ))
                            ) : (
                              <Badge tone={surface.requiresPrinter ? "danger" : "neutral"}>
                                no printer profile
                              </Badge>
                            )}
                          </Group>
                        </Stack>
                      ) : (
                        <Badge tone="neutral">none</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Badge tone="accent">{surface.masking}</Badge>
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
                      <Badge tone="neutral">{module}</Badge>
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
                  <Badge tone="warning" key={field.id}>
                    {fieldKey(field)}
                  </Badge>
                ))
              ) : (
                <Badge tone="success">all registered fields mapped</Badge>
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
      <Alert icon={<IconUsersGroup size={16} />} tone="info">
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
                        <Badge tone={group.is_active ? "success" : "neutral"}>
                          {group.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge tone="info">{members.length} members</Badge>
                      </Table.Td>
                      <Table.Td>
                        {permissions.length > 0 ? (
                          <Stack gap={4}>
                            <Badge tone="success">{permissions.length} grants</Badge>
                            <Group gap={4}>
                              {permissions.slice(0, 4).map((permission) => (
                                <Tooltip key={permission} label={permissionLabel(permission)}>
                                  <Badge tone="neutral">{permission}</Badge>
                                </Tooltip>
                              ))}
                              {permissions.length > 4 && (
                                <Badge tone="neutral">+{permissions.length - 4}</Badge>
                              )}
                            </Group>
                          </Stack>
                        ) : (
                          <Badge tone="neutral">Resource scope only</Badge>
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
            <Badge tone="info">ReBAC scope</Badge>
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
                            <Badge tone="info" key={relation}>
                              {relation}
                            </Badge>
                          ))}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {resource.permissions.map((permission) => (
                            <Badge tone="info" key={permission}>
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
            <Badge tone="info">Role defaults</Badge>
            <Badge tone="success">User overrides</Badge>
            <Badge tone="info">Group scope</Badge>
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
