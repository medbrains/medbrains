import { zodResolver } from "@hookform/resolvers/zod";
import { ActionIcon, Badge, Button, Group, Loader, Modal, Stack, Table, Text } from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  type DepartmentHoursSettingsFormInput,
  departmentHoursSettingsFormSchema,
} from "@medbrains/schemas";
import type { DepartmentRow, TimeSlot } from "@medbrains/types";
import { IconCheck, IconClock } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, type Path, useForm } from "react-hook-form";
import { settingsSetupService } from "../../../services/settingsSetup.service";

const QUERY_KEY = ["setup-departments"] as const;

const EMPTY_SLOT = { start: "", end: "" };

const EMPTY_HOURS: DepartmentHoursSettingsFormInput = {
  monday: { ...EMPTY_SLOT },
  tuesday: { ...EMPTY_SLOT },
  wednesday: { ...EMPTY_SLOT },
  thursday: { ...EMPTY_SLOT },
  friday: { ...EMPTY_SLOT },
  saturday: { ...EMPTY_SLOT },
  sunday: { ...EMPTY_SLOT },
};

type WeekdayField = {
  key: keyof DepartmentHoursSettingsFormInput;
  label: string;
  startName: Path<DepartmentHoursSettingsFormInput>;
  endName: Path<DepartmentHoursSettingsFormInput>;
};

const WEEKDAY_FIELDS = [
  { key: "monday", label: "Monday", startName: "monday.start", endName: "monday.end" },
  { key: "tuesday", label: "Tuesday", startName: "tuesday.start", endName: "tuesday.end" },
  {
    key: "wednesday",
    label: "Wednesday",
    startName: "wednesday.start",
    endName: "wednesday.end",
  },
  { key: "thursday", label: "Thursday", startName: "thursday.start", endName: "thursday.end" },
  { key: "friday", label: "Friday", startName: "friday.start", endName: "friday.end" },
  { key: "saturday", label: "Saturday", startName: "saturday.start", endName: "saturday.end" },
  { key: "sunday", label: "Sunday", startName: "sunday.start", endName: "sunday.end" },
] satisfies WeekdayField[];

const formatTimeSlot = (slot: TimeSlot | undefined): string => {
  if (!slot) return "--";
  return `${slot.start} - ${slot.end}`;
};

function isTimeSlot(value: unknown): value is TimeSlot {
  return (
    typeof value === "object" &&
    value !== null &&
    "start" in value &&
    "end" in value &&
    typeof value.start === "string" &&
    typeof value.end === "string"
  );
}

function extractMorningSlot(
  hours: Record<string, unknown> | null,
  day: keyof DepartmentHoursSettingsFormInput,
): TimeSlot | undefined {
  const dayValue = hours?.[day];
  if (typeof dayValue !== "object" || dayValue === null || !("morning" in dayValue)) {
    return undefined;
  }
  return isTimeSlot(dayValue.morning) ? dayValue.morning : undefined;
}

const formatOperatingHours = (hours: Record<string, unknown> | null): string => {
  if (!hours || Object.keys(hours).length === 0) return "Not configured";

  const entries = Object.entries(hours).filter(([_, v]) => v !== null);
  if (entries.length === 0) return "Not configured";

  const days = entries.map(([day, slot]) => {
    const times: string[] = [];
    if (
      typeof slot === "object" &&
      slot !== null &&
      "morning" in slot &&
      isTimeSlot(slot.morning)
    ) {
      times.push(formatTimeSlot(slot.morning));
    }
    if (
      typeof slot === "object" &&
      slot !== null &&
      "evening" in slot &&
      isTimeSlot(slot.evening)
    ) {
      times.push(formatTimeSlot(slot.evening));
    }
    return `${day.charAt(0).toUpperCase() + day.slice(1)}: ${times.join(", ")}`;
  });

  return days.join(" | ");
};

function hoursFormFromDepartment(department: DepartmentRow): DepartmentHoursSettingsFormInput {
  const hours = department.working_hours || {};
  return {
    monday: extractMorningSlot(hours, "monday") ?? { ...EMPTY_SLOT },
    tuesday: extractMorningSlot(hours, "tuesday") ?? { ...EMPTY_SLOT },
    wednesday: extractMorningSlot(hours, "wednesday") ?? { ...EMPTY_SLOT },
    thursday: extractMorningSlot(hours, "thursday") ?? { ...EMPTY_SLOT },
    friday: extractMorningSlot(hours, "friday") ?? { ...EMPTY_SLOT },
    saturday: extractMorningSlot(hours, "saturday") ?? { ...EMPTY_SLOT },
    sunday: extractMorningSlot(hours, "sunday") ?? { ...EMPTY_SLOT },
  };
}

function hoursFormToPayload(form: DepartmentHoursSettingsFormInput) {
  const working_hours: Record<string, { morning?: TimeSlot } | null> = {};

  for (const day of WEEKDAY_FIELDS) {
    const slot = form[day.key];
    working_hours[day.key] =
      slot.start.trim().length > 0 && slot.end.trim().length > 0
        ? { morning: { start: slot.start, end: slot.end } }
        : null;
  }

  return { working_hours };
}

export function DepartmentHoursSettings() {
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentRow | null>(null);
  const {
    control,
    formState: { errors },
    handleSubmit,
    reset,
  } = useForm<DepartmentHoursSettingsFormInput>({
    resolver: zodResolver(departmentHoursSettingsFormSchema),
    defaultValues: EMPTY_HOURS,
  });

  const {
    data: departments,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => settingsSetupService.listDepartments(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      settingsSetupService.updateDepartment(id, data),
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
    reset(hoursFormFromDepartment(dept));
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDept(null);
    reset(EMPTY_HOURS);
  };

  const submitHours = handleSubmit((form) => {
    if (!editingDept) return;

    updateMutation.mutate({
      id: editingDept.id,
      data: hoursFormToPayload(form),
    });
  });

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
          Failed to load departments: {error instanceof Error ? error.message : "Unknown error"}
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
                  <Badge color={dept.is_active ? "success" : "slate"} variant="light" size="sm">
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
          {WEEKDAY_FIELDS.map((day) => (
            <Group key={day.key} wrap="nowrap" align="flex-start">
              <Text size="sm" fw={500} w={100}>
                {day.label}
              </Text>
              <Controller
                control={control}
                name={day.startName}
                render={({ field }) => (
                  <TimeInput
                    placeholder="Start time"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors[day.key]?.start?.message}
                    flex={1}
                  />
                )}
              />
              <Text size="sm" c="dimmed">
                to
              </Text>
              <Controller
                control={control}
                name={day.endName}
                render={({ field }) => (
                  <TimeInput
                    placeholder="End time"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors[day.key]?.end?.message}
                    flex={1}
                  />
                )}
              />
            </Group>
          ))}
          <Group justify="flex-end" mt="sm">
            <Button variant="light" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={() => void submitHours()} loading={updateMutation.isPending}>
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
