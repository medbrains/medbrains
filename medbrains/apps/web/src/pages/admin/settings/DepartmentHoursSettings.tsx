import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Group,
  Loader,
  Modal,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconClock } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { DepartmentRow, TimeSlot } from "@medbrains/types";

interface HoursFormState {
  monday?: TimeSlot;
  tuesday?: TimeSlot;
  wednesday?: TimeSlot;
  thursday?: TimeSlot;
  friday?: TimeSlot;
  saturday?: TimeSlot;
  sunday?: TimeSlot;
}

const EMPTY_HOURS: HoursFormState = {};

const QUERY_KEY = ["setup-departments"] as const;

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const formatTimeSlot = (slot: TimeSlot | undefined): string => {
  if (!slot) return "--";
  return `${slot.start} - ${slot.end}`;
};

const formatOperatingHours = (hours: Record<string, unknown> | null): string => {
  if (!hours || Object.keys(hours).length === 0) return "Not configured";

  const entries = Object.entries(hours).filter(([_, v]) => v !== null);
  if (entries.length === 0) return "Not configured";

  const days = entries.map(([day, slot]) => {
    const ts = slot as { morning?: TimeSlot; evening?: TimeSlot };
    const times: string[] = [];
    if (ts.morning) times.push(formatTimeSlot(ts.morning));
    if (ts.evening) times.push(formatTimeSlot(ts.evening));
    return `${day.charAt(0).toUpperCase() + day.slice(1)}: ${times.join(", ")}`;
  });

  return days.join(" | ");
};

export function DepartmentHoursSettings() {
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentRow | null>(null);
  const [form, setForm] = useState<HoursFormState>(EMPTY_HOURS);

  const {
    data: departments,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.listDepartments(),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Record<string, unknown>;
    }) => api.updateDepartment(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      closeModal();
      notifications.show({
        title: "Operating hours updated",
        message: "The department operating hours have been saved.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Update failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const openEditModal = (dept: DepartmentRow) => {
    setEditingDept(dept);
    const hours = dept.working_hours || {};
    const formData: HoursFormState = {};

    WEEKDAYS.forEach((day) => {
      const dayData = hours[day] as { morning?: TimeSlot } | null;
      if (dayData?.morning) {
        formData[day] = dayData.morning;
      }
    });

    setForm(formData);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDept(null);
    setForm(EMPTY_HOURS);
  };

  const handleSubmit = () => {
    if (!editingDept) return;

    const working_hours: Record<string, { morning?: TimeSlot } | null> = {};

    WEEKDAYS.forEach((day) => {
      const slot = form[day];
      if (slot) {
        working_hours[day] = { morning: slot };
      } else {
        working_hours[day] = null;
      }
    });

    updateMutation.mutate({
      id: editingDept.id,
      data: { working_hours },
    });
  };

  const updateTimeSlot = (day: string, field: "start" | "end", value: string) => {
    setForm((prev) => {
      const existing = prev[day as keyof HoursFormState];
      return {
        ...prev,
        [day]: {
          start: field === "start" ? value : existing?.start || "09:00",
          end: field === "end" ? value : existing?.end || "17:00",
        },
      };
    });
  };

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading departments...</Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="danger">
          Failed to load departments:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Department Operating Hours
        </Text>
      </Group>

      {departments && departments.length > 0 ? (
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Department</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Operating Hours</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th w={80}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {departments.map((dept) => (
              <Table.Tr key={dept.id}>
                <Table.Td>
                  <Text fw={500} size="sm">
                    {dept.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {dept.code}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm" variant="light">
                    {dept.department_type.replace(/_/g, " ")}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={2}>
                    {formatOperatingHours(dept.working_hours)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={dept.is_active ? "success" : "slate"}
                    variant="light"
                    size="sm"
                  >
                    {dept.is_active ? "Active" : "Inactive"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="primary"
                    size="sm"
                    onClick={() => openEditModal(dept)}
                    title="Edit operating hours"
                    aria-label="Time"
                  >
                    <IconClock size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          No departments configured yet.
        </Text>
      )}

      <Modal
        opened={modalOpen}
        onClose={closeModal}
        title={`Edit Operating Hours: ${editingDept?.name}`}
        centered
        size="lg"
      >
        <Stack gap="md">
          {WEEKDAYS.map((day) => (
            <Group key={day} wrap="nowrap" align="flex-start">
              <Text size="sm" fw={500} w={100}>
                {day.charAt(0).toUpperCase() + day.slice(1)}
              </Text>
              <TimeInput
                placeholder="Start time"
                value={form[day]?.start || ""}
                onChange={(e) =>
                  updateTimeSlot(day, "start", e.currentTarget.value)
                }
                flex={1}
              />
              <Text size="sm" c="dimmed">
                to
              </Text>
              <TimeInput
                placeholder="End time"
                value={form[day]?.end || ""}
                onChange={(e) =>
                  updateTimeSlot(day, "end", e.currentTarget.value)
                }
                flex={1}
              />
            </Group>
          ))}
          <Group justify="flex-end" mt="sm">
            <button
              type="button"
              onClick={closeModal}
              style={{
                padding: "8px 16px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                background: "white",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                background: updateMutation.isPending ? "#ccc" : "#228be6",
                color: "white",
                cursor: updateMutation.isPending ? "not-allowed" : "pointer",
              }}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
