import { useState, useMemo } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { WeekView } from "@mantine/schedule";
import type { ScheduleEventData } from "@mantine/schedule";
import dayjs from "dayjs";
import {
  IconCalendarOff,
  IconCheck,
  IconClock,
  IconList,
  IconCalendarEvent,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { useHasPermission } from "@medbrains/stores";
import { useRequirePermission } from "../../hooks/useRequirePermission";
import { PageHeader } from "../../components/PageHeader";
import type {
  DoctorSchedule,
  DoctorScheduleException,
  SetupUser,
  DepartmentRow,
} from "@medbrains/types";

// ── Helpers ────────────────────────────────────────────────

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h ?? "0", 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function timeOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      opts.push({ value: val, label: formatTime(val) });
    }
  }
  return opts;
}

const TIME_OPTIONS = timeOptions();

// ── Schedule Form Modal ────────────────────────────────────

function ScheduleFormModal({
  opened,
  onClose,
  doctorId,
  departmentId,
  editSchedule,
}: {
  opened: boolean;
  onClose: () => void;
  doctorId: string;
  departmentId: string;
  editSchedule: DoctorSchedule | null;
}) {
  const queryClient = useQueryClient();
  const [dayOfWeek, setDayOfWeek] = useState<string | null>(
    editSchedule ? String(editSchedule.day_of_week) : null,
  );
  const [startTime, setStartTime] = useState<string | null>(
    editSchedule?.start_time ?? null,
  );
  const [endTime, setEndTime] = useState<string | null>(
    editSchedule?.end_time ?? null,
  );
  const [slotDuration, setSlotDuration] = useState<number>(
    editSchedule?.slot_duration_mins ?? 15,
  );
  const [maxPatients, setMaxPatients] = useState<number>(
    editSchedule?.max_patients ?? 1,
  );
  const [isActive, setIsActive] = useState(editSchedule?.is_active ?? true);

  const createMutation = useMutation({
    mutationFn: () =>
      api.createSchedule({
        doctor_id: doctorId,
        department_id: departmentId,
        day_of_week: parseInt(dayOfWeek!, 10),
        start_time: startTime!,
        end_time: endTime!,
        slot_duration_mins: slotDuration,
        max_patients: maxPatients,
      }),
    onSuccess: () => {
      notifications.show({
        title: "Schedule created",
        message: "Doctor schedule slot has been added.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["doctor-schedules"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateSchedule(editSchedule!.id, {
        start_time: startTime ?? undefined,
        end_time: endTime ?? undefined,
        slot_duration_mins: slotDuration,
        max_patients: maxPatients,
        is_active: isActive,
      }),
    onSuccess: () => {
      notifications.show({
        title: "Schedule updated",
        message: "Doctor schedule has been updated.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["doctor-schedules"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  const canSubmit = dayOfWeek !== null && startTime && endTime;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editSchedule ? "Edit Schedule Slot" : "Add Schedule Slot"}
      size="md"
    >
      <Stack gap="sm">
        {!editSchedule && (
          <Select
            label="Day of Week"
            placeholder="Select day"
            data={DAY_NAMES.map((name, i) => ({ value: String(i), label: name }))}
            value={dayOfWeek}
            onChange={setDayOfWeek}
            required
          />
        )}
        {editSchedule && (
          <TextInput
            label="Day of Week"
            value={DAY_NAMES[editSchedule.day_of_week] ?? ""}
            readOnly
          />
        )}
        <Group grow>
          <Select
            label="Start Time"
            placeholder="Select"
            data={TIME_OPTIONS}
            value={startTime}
            onChange={setStartTime}
            searchable
            required
          />
          <Select
            label="End Time"
            placeholder="Select"
            data={TIME_OPTIONS}
            value={endTime}
            onChange={setEndTime}
            searchable
            required
          />
        </Group>
        <Group grow>
          <NumberInput
            label="Slot Duration (min)"
            value={slotDuration}
            onChange={(v) => setSlotDuration(typeof v === "number" ? v : 15)}
            min={5}
            max={120}
            step={5}
          />
          <NumberInput
            label="Max Patients / Slot"
            value={maxPatients}
            onChange={(v) => setMaxPatients(typeof v === "number" ? v : 1)}
            min={1}
            max={50}
          />
        </Group>
        {editSchedule && (
          <Switch
            label="Active"
            checked={isActive}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
          />
        )}
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              editSchedule ? updateMutation.mutate() : createMutation.mutate()
            }
            disabled={!canSubmit}
            loading={createMutation.isPending || updateMutation.isPending}
          >
            {editSchedule ? "Update" : "Add Slot"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Exception Form Modal ───────────────────────────────────

function ExceptionFormModal({
  opened,
  onClose,
  doctorId,
}: {
  opened: boolean;
  onClose: () => void;
  doctorId: string;
}) {
  const queryClient = useQueryClient();
  const [exceptionDate, setExceptionDate] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      api.createScheduleException({
        doctor_id: doctorId,
        exception_date: exceptionDate!,
        is_available: isAvailable,
        start_time: isAvailable ? (startTime ?? undefined) : undefined,
        end_time: isAvailable ? (endTime ?? undefined) : undefined,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      notifications.show({
        title: "Exception added",
        message: isAvailable
          ? "Special availability has been added."
          : "Day has been marked as unavailable.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["doctor-exceptions"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Add Schedule Exception" size="md">
      <Stack gap="sm">
        <DatePickerInput
          label="Date"
          placeholder="Pick date"
          value={exceptionDate}
          onChange={setExceptionDate}
          minDate={new Date()}
          required
        />
        <Switch
          label="Override with custom availability"
          description="When off, the doctor is unavailable on this date. When on, set custom hours."
          checked={isAvailable}
          onChange={(e) => setIsAvailable(e.currentTarget.checked)}
        />
        {isAvailable && (
          <Group grow>
            <Select
              label="Start Time"
              data={TIME_OPTIONS}
              value={startTime}
              onChange={setStartTime}
              searchable
            />
            <Select
              label="End Time"
              data={TIME_OPTIONS}
              value={endTime}
              onChange={setEndTime}
              searchable
            />
          </Group>
        )}
        <Textarea
          label="Reason"
          placeholder="e.g. Annual leave, Conference, Holiday"
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          minRows={2}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!exceptionDate}
            loading={createMutation.isPending}
          >
            Add Exception
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Main Page ──────────────────────────────────────────────

export function DoctorSchedulesPage() {
  useRequirePermission(P.OPD.SCHEDULE.LIST);
  const canManage = useHasPermission(P.OPD.SCHEDULE.MANAGE);

  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<SetupUser | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [editSchedule, setEditSchedule] = useState<DoctorSchedule | null>(null);
  const [exceptionModal, setExceptionModal] = useState(false);
  const [viewMode, setViewMode] = useState("calendar");
  const [calDate, setCalDate] = useState(dayjs().format("YYYY-MM-DD"));

  // Load doctors (server-side filtered to role=doctor, is_active=true)
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => api.listDoctors(),
  });

  const { data: departments } = useQuery({
    queryKey: ["setup-departments"],
    queryFn: () => api.listDepartments(),
  });

  const doctors = useMemo(() => {
    if (!users) return [];
    if (!search) return users;
    return users.filter((u: SetupUser) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [users, search]);

  const deptMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of departments ?? []) {
      m.set(d.id, d.name);
    }
    return m;
  }, [departments]);

  const deptOptions = useMemo(
    () =>
      (departments ?? []).map((d: DepartmentRow) => ({
        value: d.id,
        label: d.name,
      })),
    [departments],
  );

  // Load schedules for selected doctor
  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ["doctor-schedules", selectedDoctor?.id],
    queryFn: () => api.listSchedules({ doctor_id: selectedDoctor!.id }),
    enabled: !!selectedDoctor,
  });

  // Load exceptions for selected doctor
  const { data: exceptions } = useQuery({
    queryKey: ["doctor-exceptions", selectedDoctor?.id],
    queryFn: () =>
      api.listScheduleExceptions({ doctor_id: selectedDoctor!.id }),
    enabled: !!selectedDoctor,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteSchedule(id),
    onSuccess: () => {
      notifications.show({
        title: "Deleted",
        message: "Schedule slot removed.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["doctor-schedules"] });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  const deleteExceptionMutation = useMutation({
    mutationFn: (id: string) => api.deleteScheduleException(id),
    onSuccess: () => {
      notifications.show({
        title: "Deleted",
        message: "Exception removed.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["doctor-exceptions"] });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  // Group schedules by day
  const schedulesByDay = useMemo(() => {
    const grouped = new Map<number, DoctorSchedule[]>();
    for (const s of schedules ?? []) {
      const existing = grouped.get(s.day_of_week) ?? [];
      existing.push(s);
      grouped.set(s.day_of_week, existing);
    }
    return grouped;
  }, [schedules]);

  // Convert weekly schedules + exceptions into calendar events for the selected week
  const calendarEvents: ScheduleEventData[] = useMemo(() => {
    const events: ScheduleEventData[] = [];
    const weekStart = dayjs(calDate).startOf("week");

    // Repeat weekly schedule slots across the displayed week
    for (const s of schedules ?? []) {
      if (selectedDeptId && s.department_id !== selectedDeptId) continue;
      if (!s.is_active) continue;
      const dayDate = weekStart.add(s.day_of_week, "day");
      const dateStr = dayDate.format("YYYY-MM-DD");
      events.push({
        id: `sched-${s.id}`,
        title: `${deptMap.get(s.department_id) ?? "Dept"} (${s.slot_duration_mins}m slots, max ${s.max_patients})`,
        start: `${dateStr} ${s.start_time}:00`,
        end: `${dateStr} ${s.end_time}:00`,
        color: "blue",
        payload: { type: "schedule", schedule: s },
      });
    }

    // Add exceptions
    for (const ex of exceptions ?? []) {
      const exDate = ex.exception_date;
      if (ex.is_available && ex.start_time && ex.end_time) {
        events.push({
          id: `exc-${ex.id}`,
          title: `Override: ${ex.reason ?? "Custom hours"}`,
          start: `${exDate} ${ex.start_time}:00`,
          end: `${exDate} ${ex.end_time}:00`,
          color: "orange",
          payload: { type: "exception", exception: ex },
        });
      } else {
        events.push({
          id: `exc-${ex.id}`,
          title: `Unavailable: ${ex.reason ?? "No reason"}`,
          start: `${exDate} 00:00:00`,
          end: `${exDate} 23:59:59`,
          color: "red",
          display: "background",
          payload: { type: "exception", exception: ex },
        });
      }
    }

    return events;
  }, [schedules, exceptions, calDate, selectedDeptId, deptMap]);

  // If no doctor selected, show doctor list
  if (!selectedDoctor) {
    return (
      <div>
        <PageHeader
          title="Doctor Schedules"
          subtitle="Manage weekly schedules and availability for doctors"
        />

        <TextInput
          placeholder="Search doctors..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          mb="md"
          w={300}
        />

        {usersLoading ? (
          <Stack align="center" py="xl">
            <Loader size="lg" />
            <Text c="dimmed">Loading doctors...</Text>
          </Stack>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {doctors.map((doc) => (
              <Card
                key={doc.id}
                shadow="sm"
                padding="md"
                radius="md"
                withBorder
                style={{ cursor: "pointer" }}
                onClick={() => setSelectedDoctor(doc)}
              >
                <Group justify="space-between" mb="xs">
                  <Text fw={600}>{doc.full_name}</Text>
                  <Badge
                    color={doc.is_active ? "success" : "slate"}
                    variant="light"
                    size="sm"
                  >
                    {doc.is_active ? "Active" : "Inactive"}
                  </Badge>
                </Group>
                {doc.specialization && (
                  <Text size="sm" c="dimmed">
                    {doc.specialization}
                  </Text>
                )}
                {doc.department_ids.length > 0 && (
                  <Group gap={4} mt="xs">
                    {doc.department_ids.slice(0, 3).map((dId) => (
                      <Badge key={dId} variant="outline" size="xs">
                        {deptMap.get(dId) ?? "Dept"}
                      </Badge>
                    ))}
                    {doc.department_ids.length > 3 && (
                      <Badge variant="outline" size="xs">
                        +{doc.department_ids.length - 3}
                      </Badge>
                    )}
                  </Group>
                )}
              </Card>
            ))}
            {doctors.length === 0 && (
              <Text c="dimmed">No doctors found.</Text>
            )}
          </SimpleGrid>
        )}
      </div>
    );
  }

  // Doctor selected — show schedule management
  return (
    <div>
      <PageHeader
        title={`Schedule — ${selectedDoctor.full_name}`}
        subtitle={selectedDoctor.specialization ?? "Doctor schedule management"}
        actions={
          <Group>
            <Button variant="light" onClick={() => setSelectedDoctor(null)}>
              Back to Doctors
            </Button>
          </Group>
        }
      />

      {/* Department selector */}
      {selectedDoctor.department_ids.length > 1 && (
        <Select
          label="Department"
          placeholder="Filter by department"
          data={deptOptions.filter((d) =>
            selectedDoctor.department_ids.includes(d.value),
          )}
          value={selectedDeptId}
          onChange={setSelectedDeptId}
          clearable
          mb="md"
          w={300}
        />
      )}

      {/* Weekly Schedule Section */}
      <Group justify="space-between" mb="sm">
        <Group>
          <Title order={4}>Weekly Schedule</Title>
          <SegmentedControl
            size="xs"
            value={viewMode}
            onChange={setViewMode}
            data={[
              { value: "calendar", label: <Group gap={4}><IconCalendarEvent size={14} /><span>Calendar</span></Group> },
              { value: "table", label: <Group gap={4}><IconList size={14} /><span>Table</span></Group> },
            ]}
          />
        </Group>
        {canManage && (
          <Group>
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => {
                setEditSchedule(null);
                setScheduleModal(true);
              }}
            >
              Add Slot
            </Button>
            <Button
              size="xs"
              variant="light"
              color="orange"
              leftSection={<IconCalendarOff size={14} />}
              onClick={() => setExceptionModal(true)}
            >
              Add Exception
            </Button>
          </Group>
        )}
      </Group>

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <Card withBorder mb="xl" p={0} style={{ overflow: "hidden" }}>
          {schedulesLoading ? (
            <Stack align="center" py="xl"><Loader size="sm" /></Stack>
          ) : (
            <WeekView
              date={calDate}
              onDateChange={setCalDate}
              events={calendarEvents}
              startTime="06:00:00"
              endTime="22:00:00"
              intervalMinutes={30}
              highlightToday
              withCurrentTimeIndicator
              firstDayOfWeek={1}
              slotHeight={40}
              onEventClick={(event) => {
                const payload = event.payload as Record<string, unknown> | undefined;
                if (payload?.type === "schedule") {
                  setEditSchedule(payload.schedule as DoctorSchedule);
                  setScheduleModal(true);
                }
              }}
              onTimeSlotClick={canManage ? () => {
                setEditSchedule(null);
                setScheduleModal(true);
              } : undefined}
              mode={canManage ? undefined : "static"}
            />
          )}
        </Card>
      )}

      {/* Table View */}
      {viewMode === "table" && schedulesLoading ? (
        <Stack align="center" py="md">
          <Loader size="sm" />
        </Stack>
      ) : viewMode === "table" && schedules && schedules.length > 0 ? (
        <Table striped highlightOnHover mb="xl">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Day</Table.Th>
              <Table.Th>Department</Table.Th>
              <Table.Th>Time</Table.Th>
              <Table.Th>Slot Duration</Table.Th>
              <Table.Th>Max Patients</Table.Th>
              <Table.Th>Status</Table.Th>
              {canManage && <Table.Th>Actions</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {Array.from(schedulesByDay.entries())
              .sort(([a], [b]) => a - b)
              .flatMap(([, daySchedules]) =>
                daySchedules
                  .filter(
                    (s) => !selectedDeptId || s.department_id === selectedDeptId,
                  )
                  .map((s) => (
                    <Table.Tr key={s.id}>
                      <Table.Td>
                        <Text size="sm" fw={600}>
                          {DAY_SHORT[s.day_of_week] ?? "?"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {deptMap.get(s.department_id) ?? "-"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <IconClock size={14} />
                          <Text size="sm">
                            {formatTime(s.start_time)} – {formatTime(s.end_time)}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{s.slot_duration_mins} min</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{s.max_patients}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={s.is_active ? "success" : "slate"}
                          variant="light"
                          size="sm"
                        >
                          {s.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </Table.Td>
                      {canManage && (
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <ActionIcon
                              variant="subtle"
                              color="primary"
                              title="Edit"
                              onClick={() => {
                                setEditSchedule(s);
                                setScheduleModal(true);
                              }}
                              aria-label="Edit"
                            >
                              <IconPencil size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="danger"
                              title="Delete"
                              onClick={() => deleteMutation.mutate(s.id)}
                              aria-label="Delete"
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      )}
                    </Table.Tr>
                  )),
              )}
          </Table.Tbody>
        </Table>
      ) : viewMode === "table" ? (
        <Card withBorder p="lg" mb="xl">
          <Text c="dimmed" ta="center">
            No schedule slots configured. Click "Add Slot" to set up weekly availability.
          </Text>
        </Card>
      ) : null}

      {/* Schedule Exceptions Section (table view only — calendar shows them inline) */}
      {viewMode === "table" && (
      <Group justify="space-between" mb="sm">
        <Title order={4}>Schedule Exceptions</Title>
      </Group>
      )}

      {viewMode === "table" && exceptions && exceptions.length > 0 ? (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Hours</Table.Th>
              <Table.Th>Reason</Table.Th>
              {canManage && <Table.Th>Actions</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {exceptions.map((ex: DoctorScheduleException) => (
              <Table.Tr key={ex.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {ex.exception_date}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={ex.is_available ? "primary" : "danger"}
                    variant="light"
                    size="sm"
                  >
                    {ex.is_available ? "Custom Hours" : "Unavailable"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {ex.is_available && ex.start_time && ex.end_time
                      ? `${formatTime(ex.start_time)} – ${formatTime(ex.end_time)}`
                      : "-"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c={ex.reason ? undefined : "dimmed"}>
                    {ex.reason ?? "-"}
                  </Text>
                </Table.Td>
                {canManage && (
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="danger"
                      title="Remove"
                      onClick={() => deleteExceptionMutation.mutate(ex.id)}
                      aria-label="Delete"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : viewMode === "table" ? (
        <Card withBorder p="lg">
          <Text c="dimmed" ta="center">
            No schedule exceptions. Add exceptions for holidays, leave, or custom hours.
          </Text>
        </Card>
      ) : null}

      {/* Modals */}
      {scheduleModal && (
        <ScheduleFormModal
          opened={scheduleModal}
          onClose={() => {
            setScheduleModal(false);
            setEditSchedule(null);
          }}
          doctorId={selectedDoctor.id}
          departmentId={
            selectedDeptId ??
            selectedDoctor.department_ids[0] ??
            ""
          }
          editSchedule={editSchedule}
        />
      )}

      {exceptionModal && (
        <ExceptionFormModal
          opened={exceptionModal}
          onClose={() => setExceptionModal(false)}
          doctorId={selectedDoctor.id}
        />
      )}
    </div>
  );
}
