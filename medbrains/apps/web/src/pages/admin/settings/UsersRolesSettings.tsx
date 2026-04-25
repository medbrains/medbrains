import { useEffect, useState } from "react";
import { useHashTabs } from "../../../hooks/useHashTabs";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconPencil,
  IconPlus,
  IconTrash,
  IconBuilding,
  IconUsers,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { SetupUser, CustomRole, DepartmentRow, Facility, UserFacilityAssignment } from "@medbrains/types";
import { DataTable, SelectLabel, CreateRoleModal, CreateDepartmentModal } from "../../../components";
import { useCreateInline } from "../../../hooks/useCreateInline";

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

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [specialization, setSpecialization] = useState("");
  const [medRegNumber, setMedRegNumber] = useState("");
  const [qualification, setQualification] = useState("");
  const [consultationFee, setConsultationFee] = useState<number | string>("");
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [facilityIds, setFacilityIds] = useState<string[]>([]);
  const [primaryFacilityId, setPrimaryFacilityId] = useState<string | null>(null);

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

  // Load custom roles for the role dropdown
  const { data: customRoles } = useQuery({
    queryKey: ["setup-roles"],
    queryFn: () => api.listRoles(),
    staleTime: 60_000,
    enabled: opened,
  });

  // Load departments for the doctor MultiSelect
  const { data: departments, isLoading: depsLoading } = useQuery({
    queryKey: ["setup-departments"],
    queryFn: () => api.listDepartments(),
    staleTime: 60_000,
    enabled: opened && role === "doctor",
  });

  // Load facilities for the facility MultiSelect
  const { data: facilities, isLoading: facilitiesLoading } = useQuery({
    queryKey: ["setup-facilities"],
    queryFn: () => api.listFacilities(),
    staleTime: 60_000,
    enabled: opened,
  });

  // Load existing user facility assignments when editing
  const { data: userFacilities } = useQuery({
    queryKey: ["user-facilities", editingUser?.id],
    queryFn: () => api.listUserFacilities(editingUser!.id),
    staleTime: 30_000,
    enabled: opened && !!editingUser,
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

  const facilityOptions = (facilities ?? []).map((f: Facility) => ({
    value: f.id,
    label: `${f.name} (${f.code})`,
  }));

  const handleOpen = () => {
    if (editingUser) {
      setFullName(editingUser.full_name);
      setUsername(editingUser.username);
      setEmail(editingUser.email);
      setPassword("");
      setRole(editingUser.role);
      setSpecialization(editingUser.specialization ?? "");
      setMedRegNumber(editingUser.medical_registration_number ?? "");
      setQualification(editingUser.qualification ?? "");
      setConsultationFee(editingUser.consultation_fee ?? "");
      setDepartmentIds(editingUser.department_ids ?? []);
      setFacilityIds(userFacilities?.map((f: UserFacilityAssignment) => f.facility_id) ?? []);
      setPrimaryFacilityId(userFacilities?.find((f: UserFacilityAssignment) => f.is_primary)?.facility_id ?? null);
    } else {
      setFullName("");
      setUsername("");
      setEmail("");
      setPassword("");
      setRole(null);
      setSpecialization("");
      setMedRegNumber("");
      setQualification("");
      setConsultationFee("");
      setDepartmentIds([]);
      setFacilityIds([]);
      setPrimaryFacilityId(null);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.createSetupUser>[0]) =>
      api.createSetupUser(data),
    onSuccess: async (newUser) => {
      if (facilityIds.length > 0) {
        try {
          await api.assignUserFacilities(newUser.id, {
            facility_ids: facilityIds,
            primary_facility_id: primaryFacilityId ?? undefined,
          });
        } catch {
          // User created but facility assignment failed — not blocking
        }
      }
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
    onSuccess: async () => {
      if (editingUser) {
        try {
          await api.assignUserFacilities(editingUser.id, {
            facility_ids: facilityIds,
            primary_facility_id: primaryFacilityId ?? undefined,
          });
        } catch {
          // User updated but facility assignment failed — not blocking
        }
      }
      notifications.show({
        title: "User updated",
        message: "User has been updated successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-users"] });
      void queryClient.invalidateQueries({ queryKey: ["user-facilities"] });
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
              onCreate={roleInline.openCreateModal}
            />
          }
          placeholder="Select role"
          data={roleOptions}
          value={role}
          onChange={setRole}
          searchable
          required
        />

        <MultiSelect
          label="Facilities"
          description="Assign user to one or more facilities"
          placeholder="Select facilities"
          data={facilityOptions}
          value={facilityIds}
          onChange={setFacilityIds}
          searchable
          clearable
          leftSection={<IconBuilding size={16} />}
          rightSection={facilitiesLoading ? <Loader size={16} /> : undefined}
          nothingFoundMessage="No facilities found"
        />

        {facilityIds.length > 1 && (
          <Select
            label="Primary Facility"
            description="Default facility for this user"
            placeholder="Select primary"
            data={facilityOptions.filter((f: { value: string }) => facilityIds.includes(f.value))}
            value={primaryFacilityId}
            onChange={setPrimaryFacilityId}
            clearable
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
              prefix="\u20B9"
              value={consultationFee}
              onChange={setConsultationFee}
              min={0}
              decimalScale={2}
            />
            <MultiSelect
              label={
                <SelectLabel
                  label="Departments"
                  onCreate={deptInline.openCreateModal}
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

// ── Users Tab ─────────────────────────────────────────────

function UsersTab() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SetupUser | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<SetupUser | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => api.listSetupUsers(),
  });

  const openCreate = () => {
    setEditingUser(null);
    setModalOpen(true);
  };

  const openEdit = (user: SetupUser) => {
    setEditingUser(user);
    setModalOpen(true);
  };

  const openDelete = (user: SetupUser) => {
    setDeletingUser(user);
    setDeleteModalOpen(true);
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
      key: "facilities",
      label: "Facilities",
      render: (_row: SetupUser) => (
        <Text size="sm" c="dimmed">-</Text>
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
        <Badge
          size="sm"
          variant="light"
          color={row.is_active ? "success" : "danger"}
        >
          {row.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: SetupUser) => (
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            color="primary"
            onClick={() => openEdit(row)}
            aria-label="Edit"
          >
            <IconPencil size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="danger"
            onClick={() => openDelete(row)}
            aria-label="Delete"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button
          size="sm"
          leftSection={<IconPlus size={14} />}
          onClick={openCreate}
        >
          Add User
        </Button>
      </Group>

      <DataTable<SetupUser>
        columns={columns}
        data={users ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyIcon={<IconUsers size={32} />}
        emptyTitle="No users found"
        emptyDescription="No users have been created yet"
      />

      <UserModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        editingUser={editingUser}
      />

      <DeleteUserModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        user={deletingUser}
      />
    </>
  );
}

// ── Role Create/Edit Modal ────────────────────────────────

function RoleModal({
  opened,
  onClose,
  editingRole,
}: {
  opened: boolean;
  onClose: () => void;
  editingRole: CustomRole | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editingRole;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleOpen = () => {
    if (editingRole) {
      setCode(editingRole.code);
      setName(editingRole.name);
      setDescription(editingRole.description ?? "");
    } else {
      setCode("");
      setName("");
      setDescription("");
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: { code: string; name: string; description?: string }) =>
      api.createRole(data),
    onSuccess: () => {
      notifications.show({
        title: "Role created",
        message: "Custom role has been created successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-roles"] });
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
    mutationFn: (data: { name?: string; description?: string }) =>
      api.updateRole(editingRole!.id, data),
    onSuccess: () => {
      notifications.show({
        title: "Role updated",
        message: "Custom role has been updated successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-roles"] });
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
    if (isEdit) {
      updateMutation.mutate({
        name: name || undefined,
        description: description || undefined,
      });
    } else {
      createMutation.mutate({
        code,
        name,
        description: description || undefined,
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit Role" : "Add Role"}
      size="md"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="custom_role"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
          disabled={isEdit}
          required
        />
        <TextInput
          label="Name"
          placeholder="Custom Role"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Textarea
          label="Description"
          placeholder="Describe the role responsibilities..."
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          minRows={3}
        />
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
    </Modal>
  );
}

// ── Delete Role Confirmation Modal ────────────────────────

function DeleteRoleModal({
  opened,
  onClose,
  role,
}: {
  opened: boolean;
  onClose: () => void;
  role: CustomRole | null;
}) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteRole(role!.id),
    onSuccess: () => {
      notifications.show({
        title: "Role deleted",
        message: `Role "${role!.name}" has been deleted`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-roles"] });
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
    <Modal opened={opened} onClose={onClose} title="Delete Role" size="sm">
      <Stack gap="md">
        <Text size="sm">
          Are you sure you want to delete role{" "}
          <Text span fw={600}>
            {role?.name}
          </Text>{" "}
          ({role?.code})? This action cannot be undone.
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

// ── Roles Tab ─────────────────────────────────────────────

function RolesTab() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<CustomRole | null>(null);

  const { data: roles, isLoading } = useQuery({
    queryKey: ["setup-roles"],
    queryFn: () => api.listRoles(),
  });

  const openCreate = () => {
    setEditingRole(null);
    setModalOpen(true);
  };

  const openEdit = (role: CustomRole) => {
    setEditingRole(role);
    setModalOpen(true);
  };

  const openDelete = (role: CustomRole) => {
    setDeletingRole(role);
    setDeleteModalOpen(true);
  };

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (row: CustomRole) => (
        <Text size="sm" ff="monospace" fw={500}>
          {row.code}
        </Text>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row: CustomRole) => (
        <Text size="sm">{row.name}</Text>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (row: CustomRole) => (
        <Text size="xs" c="dimmed" lineClamp={1}>
          {row.description ?? "-"}
        </Text>
      ),
    },
    {
      key: "system",
      label: "System",
      render: (row: CustomRole) =>
        row.is_system ? (
          <Badge size="sm" variant="light" color="primary">
            System
          </Badge>
        ) : null,
    },
    {
      key: "status",
      label: "Status",
      render: (row: CustomRole) => (
        <Badge
          size="sm"
          variant="light"
          color={row.is_active ? "success" : "danger"}
        >
          {row.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: CustomRole) =>
        row.is_system ? null : (
          <Group gap={4}>
            <ActionIcon
              variant="subtle"
              color="primary"
              onClick={() => openEdit(row)}
              aria-label="Edit"
            >
              <IconPencil size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="danger"
              onClick={() => openDelete(row)}
              aria-label="Delete"
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ),
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button
          size="sm"
          leftSection={<IconPlus size={14} />}
          onClick={openCreate}
        >
          Add Role
        </Button>
      </Group>

      <DataTable<CustomRole>
        columns={columns}
        data={roles ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyIcon={<IconShieldCheck size={32} />}
        emptyTitle="No roles found"
        emptyDescription="No custom roles have been created yet"
      />

      <RoleModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        editingRole={editingRole}
      />

      <DeleteRoleModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        role={deletingRole}
      />
    </>
  );
}

// ── Main Export ────────────────────────────────────────────

const SUB_TABS = ["users", "roles"] as const;

export function UsersRolesSettings() {
  const [tab, setTab] = useHashTabs("users", [...SUB_TABS], { nested: true });

  return (
    <Tabs value={tab} onChange={setTab}>
      <Tabs.List>
        <Tabs.Tab value="users" leftSection={<IconUsers size={14} />}>
          Users
        </Tabs.Tab>
        <Tabs.Tab value="roles" leftSection={<IconShieldCheck size={14} />}>
          Roles
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="users" pt="md">
        <UsersTab />
      </Tabs.Panel>

      <Tabs.Panel value="roles" pt="md">
        <RolesTab />
      </Tabs.Panel>
    </Tabs>
  );
}
