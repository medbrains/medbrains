import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  CopyButton,
  Group,
  Loader,
  Modal,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { AdminUserFormInput, BulkImportUsersFormInput } from "@medbrains/schemas";
import { bulkImportUsersFormSchema, createAdminUserFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  BulkCreateUsersRequest,
  CustomRole,
  DepartmentRow,
  SetupUser,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconCheck,
  IconInfoCircle,
  IconKey,
  IconPencil,
  IconPlus,
  IconShield,
  IconTrash,
  IconUpload,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import {
  CreateDepartmentModal,
  CreateRoleModal,
  DataTable,
  PageHeader,
  SelectLabel,
  StatusDot,
} from "@/components";
import { UserCreateDrawer } from "@/components/admin/UserCreateDrawer";
import { OfflineWriteBanner } from "@/components/OfflineWriteBanner";
import { useCreateInline } from "@/hooks/useCreateInline";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { adminAccessService, type CreateSetupUserInput } from "@/services/adminAccess.service";

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

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AdminUserFormInput>({
    resolver: zodResolver(createAdminUserFormSchema(isEdit)),
    defaultValues: {
      full_name: editingUser?.full_name ?? "",
      username: editingUser?.username ?? "",
      email: editingUser?.email ?? "",
      password: "",
      role: editingUser?.role ?? null,
      is_active: editingUser?.is_active ?? true,
      specialization: editingUser?.specialization ?? "",
      medical_registration_number: editingUser?.medical_registration_number ?? "",
      qualification: editingUser?.qualification ?? "",
      consultation_fee: editingUser?.consultation_fee ?? "",
      department_ids: editingUser?.department_ids ?? [],
    },
  });

  const role = watch("role");
  const departmentIds = watch("department_ids");

  const roleInline = useCreateInline<CustomRole>({ queryKey: ["setup-roles"] });
  const deptInline = useCreateInline<DepartmentRow>({ queryKey: ["setup-departments"] });

  useEffect(() => {
    if (roleInline.pendingSelect) {
      setValue("role", roleInline.pendingSelect.code, { shouldDirty: true, shouldValidate: true });
      roleInline.clearPendingSelect();
    }
  }, [roleInline.pendingSelect, roleInline.clearPendingSelect, setValue]);

  useEffect(() => {
    if (deptInline.pendingSelect) {
      const next = deptInline.pendingSelect?.id;
      if (next) {
        setValue("department_ids", [...departmentIds, next], {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      deptInline.clearPendingSelect();
    }
  }, [deptInline.pendingSelect, deptInline.clearPendingSelect, departmentIds, setValue]);

  const { data: customRoles } = useQuery({
    queryKey: ["setup-roles"],
    queryFn: () => adminAccessService.listRoles(),
    staleTime: 60_000,
    enabled: opened,
  });

  const { data: departments, isLoading: depsLoading } = useQuery({
    queryKey: ["setup-departments"],
    queryFn: () => adminAccessService.listDepartments(),
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

  const createMutation = useMutation({
    mutationFn: (data: CreateSetupUserInput) => adminAccessService.createUser(data),
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
    mutationFn: (data: Record<string, unknown>) => {
      if (!editingUser) throw new Error("No user selected");
      return adminAccessService.updateUser(editingUser.id, data);
    },
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

  const submitUser = handleSubmit((values) => {
    const doctorFields =
      values.role === "doctor"
        ? {
            specialization: values.specialization || undefined,
            medical_registration_number: values.medical_registration_number || undefined,
            qualification: values.qualification || undefined,
            consultation_fee:
              values.consultation_fee !== "" ? Number(values.consultation_fee) : undefined,
            department_ids: values.department_ids.length > 0 ? values.department_ids : undefined,
          }
        : {};

    if (isEdit) {
      updateMutation.mutate({
        full_name: values.full_name,
        email: values.email,
        role: values.role,
        is_active: values.is_active,
        ...doctorFields,
      });
    } else {
      createMutation.mutate({
        full_name: values.full_name,
        username: values.username,
        email: values.email,
        password: values.password,
        role: values.role ?? "",
        ...doctorFields,
      });
    }
  });

  return (
    <Modal opened={opened} onClose={onClose} title={isEdit ? "Edit User" : "Add User"} size="lg">
      <Stack gap="sm">
        <Controller
          control={control}
          name="full_name"
          render={({ field }) => (
            <TextInput
              label="Full Name"
              placeholder="Dr. John Smith"
              value={field.value}
              onChange={field.onChange}
              error={errors.full_name?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="username"
          render={({ field }) => (
            <TextInput
              label="Username"
              placeholder="john.smith"
              value={field.value}
              onChange={field.onChange}
              error={errors.username?.message}
              disabled={isEdit}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextInput
              label="Email"
              placeholder="john.smith@hospital.com"
              value={field.value}
              onChange={field.onChange}
              error={errors.email?.message}
              required
            />
          )}
        />
        {!isEdit && (
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <TextInput
                label="Password"
                placeholder="Enter password"
                type="password"
                value={field.value}
                onChange={field.onChange}
                error={errors.password?.message}
                required
              />
            )}
          />
        )}
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Select
              label={
                <SelectLabel
                  label="Role"
                  onCreate={canCreateRole ? roleInline.openCreateModal : undefined}
                />
              }
              placeholder="Select role"
              data={roleOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.role?.message}
              searchable
              required
            />
          )}
        />

        {isEdit && (
          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <Switch
                label="Active"
                description="Inactive users cannot log in"
                checked={field.value}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
              />
            )}
          />
        )}

        {role === "doctor" && (
          <>
            <Controller
              control={control}
              name="specialization"
              render={({ field }) => (
                <TextInput
                  label="Specialization"
                  placeholder="Cardiology"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="medical_registration_number"
              render={({ field }) => (
                <TextInput
                  label="Medical Registration Number"
                  placeholder="MCI-12345"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="qualification"
              render={({ field }) => (
                <TextInput
                  label="Qualification"
                  placeholder="MBBS, MD"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="consultation_fee"
              render={({ field }) => (
                <NumberInput
                  label="Consultation Fee"
                  placeholder="500"
                  prefix={"\u20B9"}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.consultation_fee?.message}
                  min={0}
                  decimalScale={2}
                />
              )}
            />
            <Controller
              control={control}
              name="department_ids"
              render={({ field }) => (
                <MultiSelect
                  label={
                    <SelectLabel
                      label="Departments"
                      onCreate={canCreateDept ? deptInline.openCreateModal : undefined}
                    />
                  }
                  placeholder="Select departments"
                  data={departmentOptions}
                  value={field.value}
                  onChange={field.onChange}
                  searchable
                  clearable
                  rightSection={depsLoading ? <Loader size={16} /> : undefined}
                  nothingFoundMessage="No departments found"
                />
              )}
            />
          </>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void submitUser()}
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

// ── Admin Password Reset Modal ─────────────────────────────

function ResetPasswordModal({
  opened,
  onClose,
  user,
}: {
  opened: boolean;
  onClose: () => void;
  user: SetupUser | null;
}) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const resetMutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("No user selected");
      return adminAccessService.resetUserPassword(user.id);
    },
    onSuccess: (data) => {
      setTempPassword(data.temp_password ?? null);
      notifications.show({
        title: "Password reset",
        message: `${user?.full_name} must set a new password on next login`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Reset failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const close = () => {
    setTempPassword(null);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={close} title="Reset Password" size="sm">
      <Stack gap="md">
        {tempPassword === null ? (
          <>
            <Text size="sm">
              Generate a temporary password for{" "}
              <Text span fw={600}>
                {user?.full_name}
              </Text>{" "}
              ({user?.username})? All their sessions will be signed out and they must choose a
              new password on next login.
            </Text>
            <Group justify="flex-end">
              <Button variant="light" onClick={close}>
                Cancel
              </Button>
              <Button onClick={() => resetMutation.mutate()} loading={resetMutation.isPending}>
                Generate temporary password
              </Button>
            </Group>
          </>
        ) : (
          <>
            <Text size="sm">
              Share this temporary password with the user — it is shown only once:
            </Text>
            <Group justify="space-between" align="center">
              <Text ff="monospace" fw={600} size="lg">
                {tempPassword}
              </Text>
              <CopyButton value={tempPassword}>
                {({ copied, copy }) => (
                  <Button size="xs" variant="light" onClick={copy}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                )}
              </CopyButton>
            </Group>
            <Group justify="flex-end">
              <Button onClick={close}>Done</Button>
            </Group>
          </>
        )}
      </Stack>
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
    mutationFn: () => {
      if (!user) throw new Error("No user selected");
      return adminAccessService.deleteUser(user.id);
    },
    onSuccess: () => {
      notifications.show({
        title: "User deleted",
        message: `User "${user?.full_name}" has been deleted`,
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

// ── Bulk Import Modal ─────────────────────────────────────

function BulkImportModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<BulkImportUsersFormInput>({
    resolver: zodResolver(bulkImportUsersFormSchema),
    defaultValues: { usersJson: "" },
    mode: "onTouched",
  });
  const usersJson = watch("usersJson");

  const bulkMutation = useMutation({
    mutationFn: (data: BulkCreateUsersRequest) => adminAccessService.bulkCreateUsers(data),
    onSuccess: (result) => {
      notifications.show({
        title: "Bulk Import Complete",
        message: `${result.created} user(s) created successfully`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-users"] });
      reset();
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

  const submitImport = handleSubmit((values) => {
    try {
      const parsed = JSON.parse(values.usersJson);
      const users = Array.isArray(parsed) ? parsed : parsed.users;
      if (!Array.isArray(users) || users.length === 0) {
        setError("usersJson", {
          message: "JSON must be an array of user objects or { users: [...] }",
        });
        return;
      }
      for (let i = 0; i < users.length; i++) {
        const u = users[i];
        if (!u.username || !u.email || !u.password || !u.full_name || !u.role_id) {
          setError("usersJson", {
            message: `User at index ${i} is missing required fields (username, email, password, full_name, role_id)`,
          });
          return;
        }
      }
      bulkMutation.mutate({ users });
    } catch {
      setError("usersJson", { message: "Invalid JSON. Please check the format." });
    }
  });

  const sampleJson = JSON.stringify(
    [
      {
        username: "john.doe",
        email: "john@hospital.com",
        password: "SecurePass123!",
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
            <Text span fw={600}>
              username
            </Text>
            ,{" "}
            <Text span fw={600}>
              email
            </Text>
            ,{" "}
            <Text span fw={600}>
              password
            </Text>
            ,{" "}
            <Text span fw={600}>
              full_name
            </Text>
            ,{" "}
            <Text span fw={600}>
              role_id
            </Text>
            .
          </Text>
        </Alert>
        <Controller
          control={control}
          name="usersJson"
          render={({ field }) => (
            <Textarea
              label="User Data (JSON)"
              placeholder={sampleJson}
              value={field.value}
              onChange={field.onChange}
              error={errors.usersJson?.message}
              minRows={10}
              maxRows={20}
              autosize
              styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
            />
          )}
        />
        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            leftSection={<IconUpload size={16} />}
            onClick={() => void submitImport()}
            loading={bulkMutation.isPending}
            disabled={!usersJson.trim()}
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
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SetupUser | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<SetupUser | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resettingUser, setResettingUser] = useState<SetupUser | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => adminAccessService.listUsers(),
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

  const openReset = (user: SetupUser) => {
    setResettingUser(user);
    setResetModalOpen(true);
  };

  const openPermissions = (user: SetupUser) => {
    navigate(`/admin/settings?user=${encodeURIComponent(user.id)}#access-matrix`);
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
      render: (row: SetupUser) => <Text size="sm">{row.email}</Text>,
    },
    {
      key: "role",
      label: "Role",
      render: (row: SetupUser) => (
        <Badge size="sm" variant="light" color={ROLE_COLORS[row.role] ?? "slate"}>
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
        <StatusDot
          color={row.is_active ? "success" : "danger"}
          label={row.is_active ? "Active" : "Inactive"}
          size="sm"
        />
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
          {canUpdate && (
            <Tooltip label="Reset password">
              <ActionIcon
                variant="subtle"
                color="copper"
                onClick={() => openReset(row)}
                aria-label="Reset password"
              >
                <IconKey size={16} />
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
              <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
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
        emptyAction={canCreate ? { label: "Add User", onClick: openCreate } : undefined}
      />

      {modalOpen && (
        <UserModal
          key={editingUser?.id ?? "create"}
          opened={modalOpen}
          onClose={() => setModalOpen(false)}
          editingUser={editingUser}
        />
      )}

      <UserCreateDrawer opened={createDrawerOpen} onClose={() => setCreateDrawerOpen(false)} />

      <DeleteUserModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        user={deletingUser}
      />

      <ResetPasswordModal
        opened={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        user={resettingUser}
      />

      <BulkImportModal opened={bulkImportOpen} onClose={() => setBulkImportOpen(false)} />
    </div>
  );
}
