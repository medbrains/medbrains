import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Drawer,
  Group,
  Loader,
  Modal,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconLayout,
  IconPencil,
  IconPlus,
  IconSearch,
  IconShield,
  IconShieldCheck,
  IconTrash,
  IconUpload,
  IconUsers,
  IconInfoCircle,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  SetupUser,
  CustomRole,
  DepartmentRow,
  FieldAccessLevel,
  FieldMasterFull,
  PermissionGroup,
  WidgetAccessLevel,
  WidgetTemplate,
  BulkCreateUsersRequest,
} from "@medbrains/types";
import {
  P,
  PERMISSIONS,
  buildPermissionTree,
} from "@medbrains/types";
import { DataTable, PageHeader, SelectLabel, CreateRoleModal, CreateDepartmentModal, StatusDot } from "../../components";
import { UserCreateDrawer } from "../../components/admin/UserCreateDrawer";
import { OfflineWriteBanner } from "../../components/OfflineWriteBanner";
import { useRequirePermission } from "../../hooks/useRequirePermission";
import { useCreateInline } from "../../hooks/useCreateInline";

// ── Constants ─────────────────────────────────────────────

const BUILT_IN_ROLES = [
  { value: "super_admin", label: "Super Admin" },
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

const ROLE_COLORS: Record<string, string> = {
  super_admin: "danger",
  hospital_admin: "violet",
  doctor: "primary",
  nurse: "teal",
  receptionist: "success",
  lab_technician: "orange",
  pharmacist: "info",
  billing_clerk: "warning",
  housekeeping_staff: "slate",
  facilities_manager: "primary",
  audit_officer: "danger",
};

// ── Permission Tree Helpers ───────────────────────────────

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

// ── User Create/Edit Modal ────────────────────────────────

function UserModal({
  opened,
  onClose,
  editingUser,
}: {
  opened: boolean;
  onClose: () => void;
  editingUser: SetupUser | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editingUser;
  const canCreateRole = useHasPermission(P.ADMIN.ROLES.CREATE);
  const canCreateDept = useHasPermission(P.ADMIN.SETTINGS.DEPARTMENTS.CREATE);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [specialization, setSpecialization] = useState("");
  const [medRegNumber, setMedRegNumber] = useState("");
  const [qualification, setQualification] = useState("");
  const [consultationFee, setConsultationFee] = useState<number | string>("");
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);

  const roleInline = useCreateInline<CustomRole>({ queryKey: ["setup-roles"] });
  const deptInline = useCreateInline<DepartmentRow>({ queryKey: ["setup-departments"] });

  useEffect(() => {
    if (roleInline.pendingSelect) {
      setRole(roleInline.pendingSelect.code);
      roleInline.clearPendingSelect();
    }
  }, [roleInline.pendingSelect, roleInline.clearPendingSelect]);

  useEffect(() => {
    if (deptInline.pendingSelect) {
      setDepartmentIds((prev) => [...prev, deptInline.pendingSelect!.id]);
      deptInline.clearPendingSelect();
    }
  }, [deptInline.pendingSelect, deptInline.clearPendingSelect]);

  const { data: customRoles } = useQuery({
    queryKey: ["setup-roles"],
    queryFn: () => api.listRoles(),
    staleTime: 60_000,
    enabled: opened,
  });

  const { data: departments, isLoading: depsLoading } = useQuery({
    queryKey: ["setup-departments"],
    queryFn: () => api.listDepartments(),
    staleTime: 60_000,
    enabled: opened && role === "doctor",
  });

  const roleOptions = [
    ...BUILT_IN_ROLES,
    ...(customRoles ?? [])
      .filter((r: CustomRole) => r.is_active && !BUILT_IN_ROLES.some((b) => b.value === r.code))
      .map((r: CustomRole) => ({ value: r.code, label: r.name })),
  ];

  const departmentOptions = (departments ?? []).map((d: DepartmentRow) => ({
    value: d.id,
    label: `${d.name} (${d.code})`,
  }));

  const handleOpen = () => {
    if (editingUser) {
      setFullName(editingUser.full_name);
      setUsername(editingUser.username);
      setEmail(editingUser.email);
      setPassword("");
      setRole(editingUser.role);
      setIsActive(editingUser.is_active);
      setSpecialization(editingUser.specialization ?? "");
      setMedRegNumber(editingUser.medical_registration_number ?? "");
      setQualification(editingUser.qualification ?? "");
      setConsultationFee(editingUser.consultation_fee ?? "");
      setDepartmentIds(editingUser.department_ids ?? []);
    } else {
      setFullName("");
      setUsername("");
      setEmail("");
      setPassword("");
      setRole(null);
      setIsActive(true);
      setSpecialization("");
      setMedRegNumber("");
      setQualification("");
      setConsultationFee("");
      setDepartmentIds([]);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.createSetupUser>[0]) =>
      api.createSetupUser(data),
    onSuccess: () => {
      notifications.show({
        title: "User created",
        message: "User has been created successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-users"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Create failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.updateSetupUser(editingUser!.id, data),
    onSuccess: () => {
      notifications.show({
        title: "User updated",
        message: "User has been updated successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-users"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Update failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleSubmit = () => {
    if (!role) {
      notifications.show({
        title: "Missing role",
        message: "Please select a role for the user",
        color: "danger",
      });
      return;
    }

    const doctorFields =
      role === "doctor"
        ? {
            specialization: specialization || undefined,
            medical_registration_number: medRegNumber || undefined,
            qualification: qualification || undefined,
            consultation_fee:
              consultationFee !== "" ? Number(consultationFee) : undefined,
            department_ids: departmentIds.length > 0 ? departmentIds : undefined,
          }
        : {};

    if (isEdit) {
      updateMutation.mutate({
        full_name: fullName,
        email,
        role,
        is_active: isActive,
        ...doctorFields,
      });
    } else {
      if (!password) {
        notifications.show({
          title: "Missing password",
          message: "Please enter a password for the new user",
          color: "danger",
        });
        return;
      }
      createMutation.mutate({
        full_name: fullName,
        username,
        email,
        password,
        role,
        ...doctorFields,
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit User" : "Add User"}
      size="lg"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <TextInput
          label="Full Name"
          placeholder="Dr. John Smith"
          value={fullName}
          onChange={(e) => setFullName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Username"
          placeholder="john.smith"
          value={username}
          onChange={(e) => setUsername(e.currentTarget.value)}
          disabled={isEdit}
          required
        />
        <TextInput
          label="Email"
          placeholder="john.smith@hospital.com"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
        />
        {!isEdit && (
          <TextInput
            label="Password"
            placeholder="Enter password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
          />
        )}
        <Select
          label={
            <SelectLabel
              label="Role"
              onCreate={canCreateRole ? roleInline.openCreateModal : undefined}
            />
          }
          placeholder="Select role"
          data={roleOptions}
          value={role}
          onChange={setRole}
          searchable
          required
        />

        {isEdit && (
          <Switch
            label="Active"
            description="Inactive users cannot log in"
            checked={isActive}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
          />
        )}

        {role === "doctor" && (
          <>
            <TextInput
              label="Specialization"
              placeholder="Cardiology"
              value={specialization}
              onChange={(e) => setSpecialization(e.currentTarget.value)}
            />
            <TextInput
              label="Medical Registration Number"
              placeholder="MCI-12345"
              value={medRegNumber}
              onChange={(e) => setMedRegNumber(e.currentTarget.value)}
            />
            <TextInput
              label="Qualification"
              placeholder="MBBS, MD"
              value={qualification}
              onChange={(e) => setQualification(e.currentTarget.value)}
            />
            <NumberInput
              label="Consultation Fee"
              placeholder="500"
              prefix={"\u20B9"}
              value={consultationFee}
              onChange={setConsultationFee}
              min={0}
              decimalScale={2}
            />
            <MultiSelect
              label={
                <SelectLabel
                  label="Departments"
                  onCreate={canCreateDept ? deptInline.openCreateModal : undefined}
                />
              }
              placeholder="Select departments"
              data={departmentOptions}
              value={departmentIds}
              onChange={setDepartmentIds}
              searchable
              clearable
              rightSection={depsLoading ? <Loader size={16} /> : undefined}
              nothingFoundMessage="No departments found"
            />
          </>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending || updateMutation.isPending}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </Group>
      </Stack>

      <CreateRoleModal
        opened={roleInline.createModalOpened}
        onClose={roleInline.closeCreateModal}
        onCreated={roleInline.onCreated}
      />

      <CreateDepartmentModal
        opened={deptInline.createModalOpened}
        onClose={deptInline.closeCreateModal}
        onCreated={deptInline.onCreated}
      />
    </Modal>
  );
}

// ── Delete User Confirmation Modal ────────────────────────

function DeleteUserModal({
  opened,
  onClose,
  user,
}: {
  opened: boolean;
  onClose: () => void;
  user: SetupUser | null;
}) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteSetupUser(user!.id),
    onSuccess: () => {
      notifications.show({
        title: "User deleted",
        message: `User "${user!.full_name}" has been deleted`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-users"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Delete failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Delete User" size="sm">
      <Stack gap="md">
        <Text size="sm">
          Are you sure you want to delete user{" "}
          <Text span fw={600}>
            {user?.full_name}
          </Text>{" "}
          ({user?.username})? This action cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="danger"
            onClick={() => deleteMutation.mutate()}
            loading={deleteMutation.isPending}
          >
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── User Permission Override Drawer ───────────────────────

function UserPermissionOverrideDrawer({
  opened,
  onClose,
  user,
  roles,
}: {
  opened: boolean;
  onClose: () => void;
  user: SetupUser | null;
  roles: CustomRole[];
}) {
  const queryClient = useQueryClient();

  const [extraPerms, setExtraPerms] = useState<Set<string>>(new Set());
  const [deniedPerms, setDeniedPerms] = useState<Set<string>>(new Set());
  const [fieldAccessOverrides, setFieldAccessOverrides] = useState<Record<string, FieldAccessLevel>>({});
  const [widgetAccessOverrides, setWidgetAccessOverrides] = useState<Record<string, WidgetAccessLevel>>({});
  const [extraFilter, setExtraFilter] = useState("");
  const [deniedFilter, setDeniedFilter] = useState("");
  const [fieldFilter, setFieldFilter] = useState("");
  const [widgetFilter, setWidgetFilter] = useState("");
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  // Sync state when user changes
  if (user && user.id !== loadedUserId) {
    setLoadedUserId(user.id);
    const matrix = user.access_matrix ?? {};
    const extra = Array.isArray(matrix.extra) ? (matrix.extra as string[]) : [];
    const denied = Array.isArray(matrix.denied) ? (matrix.denied as string[]) : [];
    const fa = (matrix.field_access ?? {}) as Record<string, string>;
    const wa = (matrix.widget_access ?? {}) as Record<string, string>;
    setExtraPerms(new Set(extra));
    setDeniedPerms(new Set(denied));
    setFieldAccessOverrides(fa as Record<string, FieldAccessLevel>);
    setWidgetAccessOverrides(wa as Record<string, WidgetAccessLevel>);
    setExtraFilter("");
    setDeniedFilter("");
    setFieldFilter("");
    setWidgetFilter("");
  }

  const allFields: FieldMasterFull[] = [];
  const fieldsLoading = false;
  const widgetTemplates: WidgetTemplate[] = [];

  const tree = useMemo(() => buildPermissionTree(PERMISSIONS), []);
  const accordionValues = useMemo(() => tree.map((g) => g.key), [tree]);

  // Get the user's role permissions for display
  const rolePerms = useMemo(() => {
    if (!user) return new Set<string>();
    const role = roles.find((r) => r.code === user.role);
    if (!role) return new Set<string>();
    const perms = Array.isArray(role.permissions) ? (role.permissions as string[]) : [];
    return new Set(perms);
  }, [user, roles]);

  const effectiveCount = useMemo(() => {
    const effective = new Set(rolePerms);
    for (const code of extraPerms) effective.add(code);
    for (const code of deniedPerms) effective.delete(code);
    return effective.size;
  }, [rolePerms, extraPerms, deniedPerms]);

  // Group fields by module (derived from db_table)
  const fieldsByModule = useMemo(() => {
    if (!allFields) return new Map<string, FieldMasterFull[]>();
    const grouped = new Map<string, FieldMasterFull[]>();
    for (const field of allFields) {
      const module = field.db_table ?? "other";
      const existing = grouped.get(module);
      if (existing) {
        existing.push(field);
      } else {
        grouped.set(module, [field]);
      }
    }
    // Sort modules alphabetically
    return new Map([...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [allFields]);

  // Count field access overrides that differ from default "edit"
  const fieldOverrideCount = useMemo(() => {
    return Object.values(fieldAccessOverrides).filter((level) => level !== "edit").length;
  }, [fieldAccessOverrides]);

  // Filter fields by module for accordion display
  const filteredFieldsByModule = useMemo(() => {
    if (!fieldFilter) return fieldsByModule;
    const lower = fieldFilter.toLowerCase();
    const filtered = new Map<string, FieldMasterFull[]>();
    for (const [module, fields] of fieldsByModule) {
      const matching = fields.filter(
        (f) =>
          f.name.toLowerCase().includes(lower) ||
          f.code.toLowerCase().includes(lower) ||
          module.toLowerCase().includes(lower),
      );
      if (matching.length > 0) {
        filtered.set(module, matching);
      }
    }
    return filtered;
  }, [fieldsByModule, fieldFilter]);

  const fieldAccordionValues = useMemo(
    () => [...fieldsByModule.keys()],
    [fieldsByModule],
  );

  const handleExtraToggle = useCallback((codes: string[], checked: boolean) => {
    setExtraPerms((prev) => {
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

  const handleDeniedToggle = useCallback((codes: string[], checked: boolean) => {
    setDeniedPerms((prev) => {
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

  const handleExtraSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setExtraPerms(new Set(PERMISSIONS.map((p) => p.code)));
    } else {
      setExtraPerms(new Set());
    }
  }, []);

  const handleDeniedSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setDeniedPerms(new Set(PERMISSIONS.map((p) => p.code)));
    } else {
      setDeniedPerms(new Set());
    }
  }, []);

  const handleFieldAccessChange = useCallback(
    (module: string, fieldCode: string, level: FieldAccessLevel) => {
      const key = `${module}.${fieldCode}`;
      setFieldAccessOverrides((prev) => {
        const next = { ...prev };
        if (level === "edit") {
          // Remove the override when set back to default
          delete next[key];
        } else {
          next[key] = level;
        }
        return next;
      });
    },
    [],
  );

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
    return Object.keys(widgetAccessOverrides).length;
  }, [widgetAccessOverrides]);

  const widgetCategoryKeys = useMemo(
    () => Object.keys(filteredTemplatesByCategory),
    [filteredTemplatesByCategory],
  );

  const handleWidgetAccessChange = useCallback((templateId: string, level: string) => {
    setWidgetAccessOverrides((prev) => {
      const next = { ...prev };
      if (level === "default") {
        delete next[templateId];
      } else {
        next[templateId] = level as WidgetAccessLevel;
      }
      return next;
    });
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      // Only include field_access entries that differ from default "edit"
      const fieldAccess: Record<string, FieldAccessLevel> = {};
      for (const [key, level] of Object.entries(fieldAccessOverrides)) {
        if (level !== "edit") {
          fieldAccess[key] = level;
        }
      }
      await api.updateUserAccessMatrix(user.id, {
        extra_permissions: [...extraPerms],
        denied_permissions: [...deniedPerms],
        field_access: Object.keys(fieldAccess).length > 0 ? fieldAccess : undefined,
        widget_access: Object.keys(widgetAccessOverrides).length > 0 ? widgetAccessOverrides : undefined,
      });
    },
    onSuccess: () => {
      notifications.show({
        title: "Permissions updated",
        message: `Permission overrides for "${user?.full_name}" saved`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-users"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Save failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const extraAllSelected = extraPerms.size === PERMISSIONS.length;
  const extraSomeSelected = extraPerms.size > 0 && !extraAllSelected;
  const deniedAllSelected = deniedPerms.size === PERMISSIONS.length;
  const deniedSomeSelected = deniedPerms.size > 0 && !deniedAllSelected;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconShieldCheck size={20} />
          <div>
            <Text fw={600} size="sm">{user?.full_name ?? "Permissions"}</Text>
            {user && (
              <Badge size="xs" variant="light" color={ROLE_COLORS[user.role] ?? "slate"}>
                {user.role.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </Group>
      }
      size="xl"
      position="right"
      padding="md"
    >
      <Stack gap="md" h="calc(100vh - 140px)">
        <Alert
          icon={<IconInfoCircle size={16} />}
          variant="light"
          color="primary"
        >
          <Text size="xs">
            <Text span fw={600}>Extra permissions</Text> are granted to this user beyond
            their role. <Text span fw={600}>Denied permissions</Text> are revoked from this
            user despite their role. Effective permissions = (role permissions + extra) - denied.
          </Text>
          <Text size="xs" mt={4} c="dimmed">
            Role provides {rolePerms.size} permissions. Effective: {effectiveCount} permissions.
          </Text>
        </Alert>

        <Box style={{ flex: 1, overflow: "auto" }}>
          <Stack gap="lg">
            {/* Extra Permissions Section */}
            <Box>
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <Text size="sm" fw={600} c="success">Extra Permissions</Text>
                  <Badge size="xs" variant="light" color="success">
                    {extraPerms.size}
                  </Badge>
                </Group>
              </Group>
              <TextInput
                placeholder="Filter extra permissions..."
                leftSection={<IconSearch size={16} />}
                value={extraFilter}
                onChange={(e) => setExtraFilter(e.currentTarget.value)}
                size="xs"
                mb="xs"
              />
              <Group gap="xs" mb="xs">
                <Checkbox
                  label="Select All"
                  checked={extraAllSelected}
                  indeterminate={extraSomeSelected}
                  onChange={(e) => handleExtraSelectAll(e.currentTarget.checked)}
                  size="sm"
                />
              </Group>
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
                    selected={extraPerms}
                    onToggle={handleExtraToggle}
                    filter={extraFilter}
                  />
                ))}
              </Accordion>
            </Box>

            {/* Denied Permissions Section */}
            <Box>
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <Text size="sm" fw={600} c="danger">Denied Permissions</Text>
                  <Badge size="xs" variant="light" color="danger">
                    {deniedPerms.size}
                  </Badge>
                </Group>
              </Group>
              <TextInput
                placeholder="Filter denied permissions..."
                leftSection={<IconSearch size={16} />}
                value={deniedFilter}
                onChange={(e) => setDeniedFilter(e.currentTarget.value)}
                size="xs"
                mb="xs"
              />
              <Group gap="xs" mb="xs">
                <Checkbox
                  label="Select All"
                  checked={deniedAllSelected}
                  indeterminate={deniedSomeSelected}
                  onChange={(e) => handleDeniedSelectAll(e.currentTarget.checked)}
                  size="sm"
                />
              </Group>
              <Accordion
                multiple
                defaultValue={accordionValues}
                variant="separated"
                chevronPosition="left"
              >
                {tree.map((group) => (
                  <PermissionGroupNode
                    key={`denied-${group.key}`}
                    group={group}
                    selected={deniedPerms}
                    onToggle={handleDeniedToggle}
                    filter={deniedFilter}
                  />
                ))}
              </Accordion>
            </Box>

            {/* Field Access Overrides Section */}
            <Box>
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <Text size="sm" fw={600} c="orange">Field Access Overrides</Text>
                  <Badge size="xs" variant="light" color="orange">
                    {fieldOverrideCount}
                  </Badge>
                </Group>
              </Group>
              <TextInput
                placeholder="Filter fields..."
                leftSection={<IconSearch size={16} />}
                value={fieldFilter}
                onChange={(e) => setFieldFilter(e.currentTarget.value)}
                size="xs"
                mb="xs"
              />
              {fieldsLoading ? (
                <Group justify="center" py="md">
                  <Loader size="sm" />
                  <Text size="sm" c="dimmed">Loading fields...</Text>
                </Group>
              ) : filteredFieldsByModule.size === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  {fieldFilter ? "No fields match your filter" : "No fields available"}
                </Text>
              ) : (
                <Accordion
                  multiple
                  defaultValue={fieldAccordionValues}
                  variant="separated"
                  chevronPosition="left"
                >
                  {[...filteredFieldsByModule.entries()].map(([module, fields]) => {
                    const moduleOverrideCount = fields.filter((f) => {
                      const key = `${module}.${f.code}`;
                      const level = fieldAccessOverrides[key];
                      return level && level !== "edit";
                    }).length;

                    return (
                      <Accordion.Item key={module} value={module}>
                        <Accordion.Control>
                          <Group gap="sm">
                            <Text size="sm" fw={500} tt="capitalize">
                              {module.replace(/_/g, " ")}
                            </Text>
                            <Badge size="xs" variant="light" color="slate">
                              {fields.length} {fields.length === 1 ? "field" : "fields"}
                            </Badge>
                            {moduleOverrideCount > 0 && (
                              <Badge size="xs" variant="light" color="orange">
                                {moduleOverrideCount} {moduleOverrideCount === 1 ? "override" : "overrides"}
                              </Badge>
                            )}
                          </Group>
                        </Accordion.Control>
                        <Accordion.Panel>
                          <Stack gap="xs">
                            {fields.map((field) => {
                              const key = `${module}.${field.code}`;
                              const currentLevel = fieldAccessOverrides[key] ?? "edit";

                              return (
                                <Group key={field.id} justify="space-between" wrap="nowrap">
                                  <Box style={{ flex: 1, minWidth: 0 }}>
                                    <Text size="sm" truncate>
                                      {field.name}
                                    </Text>
                                    <Text size="xs" c="dimmed" truncate>
                                      {field.code}
                                      {field.description ? ` — ${field.description}` : ""}
                                    </Text>
                                  </Box>
                                  <SegmentedControl
                                    size="xs"
                                    value={currentLevel}
                                    onChange={(value) =>
                                      handleFieldAccessChange(
                                        module,
                                        field.code,
                                        value as FieldAccessLevel,
                                      )
                                    }
                                    data={[
                                      { label: "Edit", value: "edit" },
                                      { label: "View", value: "view" },
                                      { label: "Hidden", value: "hidden" },
                                    ]}
                                    style={{ flexShrink: 0 }}
                                  />
                                </Group>
                              );
                            })}
                          </Stack>
                        </Accordion.Panel>
                      </Accordion.Item>
                    );
                  })}
                </Accordion>
              )}
            </Box>

            {/* Widget Access Overrides Section */}
            <Box>
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <IconLayout size={14} />
                  <Text size="sm" fw={600} c="violet">Widget Access Overrides</Text>
                  <Badge size="xs" variant="light" color="violet">
                    {widgetOverrideCount}
                  </Badge>
                </Group>
              </Group>
              <Text size="xs" c="dimmed" mb="xs">
                Override which dashboard widgets this user can see. "Default" inherits
                from the user's role settings.
              </Text>
              <TextInput
                placeholder="Filter widgets..."
                leftSection={<IconSearch size={16} />}
                value={widgetFilter}
                onChange={(e) => setWidgetFilter(e.currentTarget.value)}
                size="xs"
                mb="xs"
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
                            const currentLevel = widgetAccessOverrides[tmpl.id] ?? "default";
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
                                  style={{ flexShrink: 0 }}
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
          </Stack>
        </Box>

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
          >
            Save Overrides
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}

// ── Bulk Import Modal ─────────────────────────────────────

function BulkImportModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [jsonInput, setJsonInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const bulkMutation = useMutation({
    mutationFn: (data: BulkCreateUsersRequest) => api.bulkCreateUsers(data),
    onSuccess: (result) => {
      notifications.show({
        title: "Bulk Import Complete",
        message: `${result.created} user(s) created successfully`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-users"] });
      setJsonInput("");
      setParseError(null);
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Bulk Import Failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleSubmit = () => {
    setParseError(null);
    try {
      const parsed = JSON.parse(jsonInput);
      const users = Array.isArray(parsed) ? parsed : parsed.users;
      if (!Array.isArray(users) || users.length === 0) {
        setParseError("JSON must be an array of user objects or { users: [...] }");
        return;
      }
      for (let i = 0; i < users.length; i++) {
        const u = users[i];
        if (!u.username || !u.email || !u.password || !u.full_name || !u.role_id) {
          setParseError(
            `User at index ${i} is missing required fields (username, email, password, full_name, role_id)`,
          );
          return;
        }
      }
      bulkMutation.mutate({ users });
    } catch {
      setParseError("Invalid JSON. Please check the format.");
    }
  };

  const sampleJson = JSON.stringify(
    [
      {
        username: "john.doe",
        email: "john@hospital.com",
        password: "SecurePass123",
        full_name: "Dr. John Doe",
        role_id: "doctor",
      },
    ],
    null,
    2,
  );

  return (
    <Modal opened={opened} onClose={onClose} title="Bulk Import Users" size="lg">
      <Stack gap="md">
        <Alert icon={<IconInfoCircle size={16} />} variant="light" color="primary">
          <Text size="xs">
            Paste a JSON array of user objects. Each object needs:{" "}
            <Text span fw={600}>username</Text>, <Text span fw={600}>email</Text>,{" "}
            <Text span fw={600}>password</Text>, <Text span fw={600}>full_name</Text>,{" "}
            <Text span fw={600}>role_id</Text>.
          </Text>
        </Alert>
        <Textarea
          label="User Data (JSON)"
          placeholder={sampleJson}
          value={jsonInput}
          onChange={(e) => {
            setJsonInput(e.currentTarget.value);
            setParseError(null);
          }}
          minRows={10}
          maxRows={20}
          autosize
          styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
        />
        {parseError && (
          <Alert color="danger" variant="light">
            <Text size="sm">{parseError}</Text>
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            leftSection={<IconUpload size={16} />}
            onClick={handleSubmit}
            loading={bulkMutation.isPending}
            disabled={!jsonInput.trim()}
          >
            Import Users
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Main Users Page ───────────────────────────────────────

export function UsersPage() {
  useRequirePermission(P.ADMIN.USERS.LIST);
  const canCreate = useHasPermission(P.ADMIN.USERS.CREATE);
  const canUpdate = useHasPermission(P.ADMIN.USERS.UPDATE);
  const canDelete = useHasPermission(P.ADMIN.USERS.DELETE);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SetupUser | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<SetupUser | null>(null);
  const [permDrawerOpen, setPermDrawerOpen] = useState(false);
  const [permUser, setPermUser] = useState<SetupUser | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => api.listSetupUsers(),
  });

  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.listRoles(),
    staleTime: 60_000,
  });

  // Create flow uses the new 4-tab Stepper drawer; edit flow keeps the modal.
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const openCreate = () => setCreateDrawerOpen(true);

  const openEdit = (user: SetupUser) => {
    setEditingUser(user);
    setModalOpen(true);
  };

  const openDelete = (user: SetupUser) => {
    setDeletingUser(user);
    setDeleteModalOpen(true);
  };

  const openPermissions = (user: SetupUser) => {
    setPermUser(user);
    setPermDrawerOpen(true);
  };

  const columns = [
    {
      key: "full_name",
      label: "Full Name",
      render: (row: SetupUser) => (
        <Text size="sm" fw={500}>
          {row.full_name}
        </Text>
      ),
    },
    {
      key: "username",
      label: "Username",
      render: (row: SetupUser) => (
        <Text size="sm" ff="monospace">
          {row.username}
        </Text>
      ),
    },
    {
      key: "email",
      label: "Email",
      render: (row: SetupUser) => (
        <Text size="sm">{row.email}</Text>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (row: SetupUser) => (
        <Badge
          size="sm"
          variant="light"
          color={ROLE_COLORS[row.role] ?? "slate"}
        >
          {row.role.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "specialization",
      label: "Specialization",
      render: (row: SetupUser) => (
        <Text size="sm" c={row.specialization ? undefined : "dimmed"}>
          {row.specialization ?? "-"}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: SetupUser) => (
        <StatusDot color={row.is_active ? "success" : "danger"} label={row.is_active ? "Active" : "Inactive"} size="sm" />
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: SetupUser) => (
        <Group gap={4}>
          {canUpdate && (
            <Tooltip label="Edit user">
              <ActionIcon
                variant="subtle"
                color="primary"
                onClick={() => openEdit(row)}
                aria-label="Edit"
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {canUpdate && (
            <Tooltip label="Permission overrides">
              <ActionIcon
                variant="subtle"
                color="violet"
                onClick={() => openPermissions(row)}
                aria-label="Security"
              >
                <IconShield size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip label="Delete user">
              <ActionIcon
                variant="subtle"
                color="danger"
                onClick={() => openDelete(row)}
                aria-label="Delete"
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Manage system users, roles, and permission overrides"
        icon={<IconUsers size={20} stroke={1.5} />}
        color="slate"
        actions={
          canCreate ? (
            <Group gap="sm">
              <Button
                variant="light"
                leftSection={<IconUpload size={16} />}
                onClick={() => setBulkImportOpen(true)}
              >
                Bulk Import
              </Button>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={openCreate}
              >
                Add User
              </Button>
            </Group>
          ) : undefined
        }
      />
      <OfflineWriteBanner resource="user role / permission override" />

      <DataTable<SetupUser>
        columns={columns}
        data={users ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyIcon={<IconUsers size={32} />}
        emptyTitle="No users found"
        emptyDescription="No users have been created yet"
        emptyAction={
          canCreate
            ? { label: "Add User", onClick: openCreate }
            : undefined
        }
      />

      <UserModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        editingUser={editingUser}
      />

      <UserCreateDrawer
        opened={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
      />

      <DeleteUserModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        user={deletingUser}
      />

      <UserPermissionOverrideDrawer
        opened={permDrawerOpen}
        onClose={() => {
          setPermDrawerOpen(false);
          setPermUser(null);
        }}
        user={permUser}
        roles={roles ?? []}
      />

      <BulkImportModal
        opened={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
      />
    </div>
  );
}
