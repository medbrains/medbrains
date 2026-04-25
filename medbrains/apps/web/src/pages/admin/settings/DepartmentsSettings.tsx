import { useEffect, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Grid,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconClock,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { DepartmentRow, WorkingHours } from "@medbrains/types";
import { SelectLabel, CreateDepartmentModal } from "../../../components";
import { useCreateInline } from "../../../hooks/useCreateInline";

// ── Constants ─────────────────────────────────────────────

const DEPARTMENT_TYPE_OPTIONS = [
  { value: "clinical", label: "Clinical" },
  { value: "pre_clinical", label: "Pre-Clinical" },
  { value: "para_clinical", label: "Para-Clinical" },
  { value: "administrative", label: "Administrative" },
  { value: "support", label: "Support" },
  { value: "academic", label: "Academic" },
];

const TYPE_COLORS: Record<string, string> = {
  clinical: "primary",
  pre_clinical: "info",
  para_clinical: "teal",
  administrative: "orange",
  support: "slate",
  academic: "violet",
};

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const ALL_DAYS = [...WEEKDAYS, "sunday"];

const DEFAULT_DAY_SCHEDULE = {
  morning: { start: "09:00", end: "13:00" },
  evening: { start: "16:00", end: "20:00" },
};

function makeDefaultWorkingHours(): WorkingHours {
  const wh: WorkingHours = { sunday: null };
  for (const day of WEEKDAYS) {
    wh[day] = { ...DEFAULT_DAY_SCHEDULE };
  }
  return wh;
}

// ── Working Hours Summary Helper ──────────────────────────

function formatWorkingHoursSummary(wh?: WorkingHours | null): string {
  if (!wh) return "No hours set";

  const activeDays = WEEKDAYS.filter((d) => wh[d] != null);
  if (activeDays.length === 0) return "No hours set";

  const first = wh[activeDays[0]!];
  if (!first) return "No hours set";

  const parts: string[] = [];
  if (first.morning) parts.push(`${first.morning.start}-${first.morning.end}`);
  if (first.evening) parts.push(`${first.evening.start}-${first.evening.end}`);
  if (parts.length === 0) return "No hours set";

  const dayRange =
    activeDays.length === 6
      ? "Mon-Sat"
      : activeDays.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ");

  return `${dayRange}: ${parts.join(", ")}`;
}

// ── Department Modal ──────────────────────────────────────

function DepartmentModal({
  opened,
  onClose,
  editingDept,
  departments,
}: {
  opened: boolean;
  onClose: () => void;
  editingDept: DepartmentRow | null;
  departments: DepartmentRow[];
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editingDept;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [departmentType, setDepartmentType] = useState("clinical");
  const [parentId, setParentId] = useState<string | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHours>(
    makeDefaultWorkingHours(),
  );

  const parentInline = useCreateInline<DepartmentRow>({ queryKey: ["setup-departments"] });

  useEffect(() => {
    if (parentInline.pendingSelect) {
      setParentId(parentInline.pendingSelect.id);
      parentInline.clearPendingSelect();
    }
  }, [parentInline.pendingSelect, parentInline.clearPendingSelect]);

  const parentOptions = departments
    .filter((d) => d.id !== editingDept?.id)
    .map((d) => ({
      value: d.id,
      label: `${d.name} (${d.code})`,
    }));

  const handleOpen = () => {
    if (editingDept) {
      setCode(editingDept.code);
      setName(editingDept.name);
      setDepartmentType(editingDept.department_type);
      setParentId(editingDept.parent_id);
      setWorkingHours(
        editingDept.working_hours && Object.keys(editingDept.working_hours).length > 0
          ? editingDept.working_hours
          : makeDefaultWorkingHours(),
      );
    } else {
      setCode("");
      setName("");
      setDepartmentType("clinical");
      setParentId(null);
      setWorkingHours(makeDefaultWorkingHours());
    }
  };

  const updateDayTime = (
    day: string,
    session: "morning" | "evening",
    field: "start" | "end",
    value: string,
  ) => {
    setWorkingHours((prev) => {
      const dayData = prev[day] ?? {};
      const sessionData = dayData?.[session] ?? { start: "", end: "" };
      return {
        ...prev,
        [day]: {
          ...dayData,
          [session]: { ...sessionData, [field]: value },
        },
      };
    });
  };

  const toggleSunday = () => {
    setWorkingHours((prev) => {
      if (prev.sunday) {
        return { ...prev, sunday: null };
      }
      return {
        ...prev,
        sunday: { ...DEFAULT_DAY_SCHEDULE },
      };
    });
  };

  const createMutation = useMutation({
    mutationFn: (data: {
      code: string;
      name: string;
      department_type: string;
      parent_id?: string;
      working_hours?: WorkingHours;
    }) => api.createDepartment(data),
    onSuccess: () => {
      notifications.show({
        title: "Department created",
        message: "Department has been created successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-departments"] });
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
      api.updateDepartment(editingDept!.id, data),
    onSuccess: () => {
      notifications.show({
        title: "Department updated",
        message: "Department has been updated successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-departments"] });
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
    if (!code.trim() || !name.trim()) {
      notifications.show({
        title: "Missing fields",
        message: "Code and Name are required",
        color: "danger",
      });
      return;
    }

    if (isEdit) {
      updateMutation.mutate({
        name,
        department_type: departmentType,
        parent_id: parentId ?? undefined,
        working_hours: workingHours,
      });
    } else {
      createMutation.mutate({
        code,
        name,
        department_type: departmentType,
        parent_id: parentId ?? undefined,
        working_hours: workingHours,
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit Department" : "Add Department"}
      size="lg"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="GEN-MED"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value.toUpperCase())}
          disabled={isEdit}
          required
        />
        <TextInput
          label="Name"
          placeholder="General Medicine"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Select
          label="Department Type"
          data={DEPARTMENT_TYPE_OPTIONS}
          value={departmentType}
          onChange={(v) => setDepartmentType(v ?? "clinical")}
          required
        />
        <Select
          label={
            <SelectLabel
              label="Parent Department"
              onCreate={parentInline.openCreateModal}
            />
          }
          placeholder="None (top-level)"
          data={parentOptions}
          value={parentId}
          onChange={setParentId}
          clearable
          searchable
        />

        {/* Working Hours Section */}
        <Text fw={600} size="sm" mt="xs">
          <IconClock size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
          Working Hours
        </Text>

        {ALL_DAYS.map((day) => {
          const isSunday = day === "sunday";
          const daySchedule = workingHours[day];
          const isOff = daySchedule === null || daySchedule === undefined;

          return (
            <div key={day}>
              <Group gap="xs" mb={4}>
                <Text size="sm" fw={500} tt="capitalize" style={{ width: 80 }}>
                  {day}
                </Text>
                {isSunday && (
                  <Button
                    variant="subtle"
                    size="compact-xs"
                    onClick={toggleSunday}
                  >
                    {isOff ? "Enable" : "Set Off"}
                  </Button>
                )}
                {!isSunday && isOff && (
                  <Text size="xs" c="dimmed">Off</Text>
                )}
              </Group>
              {!isOff && (
                <Grid gap="xs">
                  <Grid.Col span={3}>
                    <TextInput
                      size="xs"
                      placeholder="HH:MM"
                      label="AM Start"
                      value={daySchedule?.morning?.start ?? ""}
                      onChange={(e) =>
                        updateDayTime(day, "morning", "start", e.currentTarget.value)
                      }
                    />
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <TextInput
                      size="xs"
                      placeholder="HH:MM"
                      label="AM End"
                      value={daySchedule?.morning?.end ?? ""}
                      onChange={(e) =>
                        updateDayTime(day, "morning", "end", e.currentTarget.value)
                      }
                    />
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <TextInput
                      size="xs"
                      placeholder="HH:MM"
                      label="PM Start"
                      value={daySchedule?.evening?.start ?? ""}
                      onChange={(e) =>
                        updateDayTime(day, "evening", "start", e.currentTarget.value)
                      }
                    />
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <TextInput
                      size="xs"
                      placeholder="HH:MM"
                      label="PM End"
                      value={daySchedule?.evening?.end ?? ""}
                      onChange={(e) =>
                        updateDayTime(day, "evening", "end", e.currentTarget.value)
                      }
                    />
                  </Grid.Col>
                </Grid>
              )}
            </div>
          );
        })}

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

      <CreateDepartmentModal
        opened={parentInline.createModalOpened}
        onClose={parentInline.closeCreateModal}
        onCreated={parentInline.onCreated}
      />
    </Modal>
  );
}

// ── Delete Confirmation Modal ─────────────────────────────

function DeleteConfirmModal({
  opened,
  onClose,
  department,
  onConfirm,
  isDeleting,
}: {
  opened: boolean;
  onClose: () => void;
  department: DepartmentRow | null;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="Delete Department" size="sm">
      <Stack gap="md">
        <Text size="sm">
          Are you sure you want to delete{" "}
          <Text span fw={600}>
            {department?.name}
          </Text>{" "}
          ({department?.code})? This action cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button color="danger" onClick={onConfirm} loading={isDeleting}>
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Main Component ────────────────────────────────────────

export function DepartmentsSettings() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentRow | null>(null);
  const [deletingDept, setDeletingDept] = useState<DepartmentRow | null>(null);

  const { data: departments, isLoading } = useQuery({
    queryKey: ["setup-departments"],
    queryFn: () => api.listDepartments(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDepartment(id),
    onSuccess: () => {
      notifications.show({
        title: "Department deleted",
        message: "Department has been deleted successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-departments"] });
      setDeletingDept(null);
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Delete failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const openCreate = () => {
    setEditingDept(null);
    setModalOpen(true);
  };

  const openEdit = (dept: DepartmentRow) => {
    setEditingDept(dept);
    setModalOpen(true);
  };

  const openDelete = (dept: DepartmentRow) => {
    setDeletingDept(dept);
  };

  const handleConfirmDelete = () => {
    if (deletingDept) {
      deleteMutation.mutate(deletingDept.id);
    }
  };

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Loading departments...
        </Text>
      </Group>
    );
  }

  const rows = (departments ?? []).map((dept) => (
    <Table.Tr key={dept.id}>
      <Table.Td>
        <Text size="sm" ff="monospace" fw={500}>
          {dept.code}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{dept.name}</Text>
      </Table.Td>
      <Table.Td>
        <Badge
          size="sm"
          variant="light"
          color={TYPE_COLORS[dept.department_type] ?? "slate"}
        >
          {dept.department_type.replace(/_/g, " ")}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="xs" c="dimmed">
          <IconClock
            size={12}
            style={{ verticalAlign: "middle", marginRight: 4 }}
          />
          {formatWorkingHoursSummary(dept.working_hours)}
        </Text>
      </Table.Td>
      <Table.Td>
        {dept.is_active ? (
          <Badge size="sm" variant="light" color="success">
            Active
          </Badge>
        ) : (
          <Badge size="sm" variant="light" color="danger">
            Inactive
          </Badge>
        )}
      </Table.Td>
      <Table.Td>
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            color="primary"
            onClick={() => openEdit(dept)}
            aria-label="Edit"
          >
            <IconPencil size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="danger"
            onClick={() => openDelete(dept)}
            aria-label="Delete"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          Manage hospital departments and their working hours.
        </Text>
        <Button
          size="sm"
          leftSection={<IconPlus size={14} />}
          onClick={openCreate}
        >
          Add Department
        </Button>
      </Group>

      <Table striped highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Code</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Working Hours</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th style={{ width: 80 }} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length > 0 ? (
            rows
          ) : (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text ta="center" c="dimmed" py="lg">
                  No departments configured. Click "Add Department" to create one.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <DepartmentModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        editingDept={editingDept}
        departments={departments ?? []}
      />

      <DeleteConfirmModal
        opened={!!deletingDept}
        onClose={() => setDeletingDept(null)}
        department={deletingDept}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
      />
    </>
  );
}
