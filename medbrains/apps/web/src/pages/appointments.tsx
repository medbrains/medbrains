import { useState, useMemo } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  IconCalendar,
  IconCalendarEvent,
  IconCheck,
  IconClock,
  IconLogin,
  IconPhone,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { useHasPermission } from "@medbrains/stores";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { PageHeader } from "../components/PageHeader";
import type {
  AppointmentWithPatient,
  AvailableSlot,
  DepartmentRow,
  RescheduleAppointmentRequest,
  SetupUser,
} from "@medbrains/types";

// ── Helpers ────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  scheduled: "primary",
  confirmed: "info",
  checked_in: "warning",
  in_consultation: "orange",
  completed: "success",
  cancelled: "danger",
  no_show: "slate",
};

const APPT_TYPE_LABELS: Record<string, string> = {
  new_visit: "New Visit",
  follow_up: "Follow-up",
  consultation: "Consultation",
  procedure: "Procedure",
  walk_in: "Walk-in",
};

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h ?? "0", 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

// ── Book Appointment Modal ─────────────────────────────────

function BookAppointmentModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"form" | "slots">("form");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [appointmentType, setAppointmentType] = useState<string>("new_visit");
  const [reason, setReason] = useState("");
  const [recurrencePattern, setRecurrencePattern] = useState<string | null>(null);
  const [recurrenceCount, setRecurrenceCount] = useState<number>(4);

  const { data: departments } = useQuery({
    queryKey: ["setup-departments"],
    queryFn: () => api.listDepartments(),
  });

  const { data: users } = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => api.listSetupUsers(),
  });

  const { data: patients } = useQuery({
    queryKey: ["patients-list"],
    queryFn: () => api.listPatients({ per_page: 200 }),
  });

  const doctorOptions = useMemo(() => {
    if (!users) return [];
    return users
      .filter((u: SetupUser) => u.role === "doctor" || u.role === "super_admin")
      .map((u: SetupUser) => ({ value: u.id, label: u.full_name }));
  }, [users]);

  const deptOptions = useMemo(
    () =>
      (departments ?? []).map((d: DepartmentRow) => ({
        value: d.id,
        label: d.name,
      })),
    [departments],
  );

  const patientOptions = useMemo(() => {
    if (!patients?.patients) return [];
    return patients.patients.map((p) => ({
      value: p.id,
      label: `${p.first_name} ${p.last_name} (${p.uhid})`,
    }));
  }, [patients]);

  const dateStr = selectedDate ?? "";

  const { data: slots, isLoading: slotsLoading } = useQuery({
    queryKey: ["available-slots", selectedDoctorId, dateStr],
    queryFn: () => api.getAvailableSlots(selectedDoctorId!, dateStr),
    enabled: !!selectedDoctorId && !!dateStr,
  });

  const bookMutation = useMutation({
    mutationFn: () =>
      api.bookAppointment({
        patient_id: selectedPatientId!,
        doctor_id: selectedDoctorId!,
        department_id: selectedDeptId!,
        appointment_date: dateStr,
        slot_start: selectedSlot!.start_time,
        slot_end: selectedSlot!.end_time,
        appointment_type: appointmentType as
          | "new_visit"
          | "follow_up"
          | "consultation"
          | "procedure"
          | "walk_in",
        reason: reason || undefined,
        recurrence_pattern: recurrencePattern as "weekly" | "biweekly" | "monthly" | undefined,
        recurrence_count: recurrencePattern ? recurrenceCount : undefined,
      }),
    onSuccess: () => {
      notifications.show({
        title: "Appointment booked",
        message: recurrencePattern
          ? `${recurrenceCount} recurring appointments scheduled.`
          : "Appointment has been scheduled successfully.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      handleClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Booking failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleClose = () => {
    setStep("form");
    setSelectedPatientId(null);
    setSelectedDoctorId(null);
    setSelectedDeptId(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setReason("");
    setAppointmentType("new_visit");
    setRecurrencePattern(null);
    setRecurrenceCount(4);
    onClose();
  };

  const canProceedToSlots =
    selectedPatientId && selectedDoctorId && selectedDeptId && selectedDate;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Book Appointment"
      size="lg"
    >
      {step === "form" ? (
        <Stack gap="sm">
          <Select
            label="Patient"
            placeholder="Select patient"
            data={patientOptions}
            value={selectedPatientId}
            onChange={setSelectedPatientId}
            searchable
            required
          />
          <Select
            label="Department"
            placeholder="Select department"
            data={deptOptions}
            value={selectedDeptId}
            onChange={setSelectedDeptId}
            searchable
            required
          />
          <Select
            label="Doctor"
            placeholder="Select doctor"
            data={doctorOptions}
            value={selectedDoctorId}
            onChange={(v) => {
              setSelectedDoctorId(v);
              setSelectedSlot(null);
            }}
            searchable
            required
          />
          <DatePickerInput
            label="Date"
            placeholder="Pick date"
            value={selectedDate}
            onChange={(v: string | null) => {
              setSelectedDate(v);
              setSelectedSlot(null);
            }}
            minDate={new Date()}
            required
          />
          <Select
            label="Appointment Type"
            data={[
              { value: "new_visit", label: "New Visit" },
              { value: "follow_up", label: "Follow-up" },
              { value: "consultation", label: "Consultation" },
              { value: "procedure", label: "Procedure" },
            ]}
            value={appointmentType}
            onChange={(v) => setAppointmentType(v ?? "new_visit")}
          />
          <Textarea
            label="Reason for Visit"
            placeholder="Optional"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            minRows={2}
          />
          <Group grow>
            <Select
              label="Recurring"
              placeholder="One-time"
              data={[
                { value: "weekly", label: "Weekly" },
                { value: "biweekly", label: "Bi-weekly" },
                { value: "monthly", label: "Monthly" },
              ]}
              value={recurrencePattern}
              onChange={setRecurrencePattern}
              clearable
            />
            {recurrencePattern && (
              <Select
                label="Number of Appointments"
                data={["2", "3", "4", "6", "8", "12"]}
                value={String(recurrenceCount)}
                onChange={(v) => setRecurrenceCount(Number(v) || 4)}
              />
            )}
          </Group>
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={() => setStep("slots")}
              disabled={!canProceedToSlots}
            >
              Select Time Slot
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="sm">
          <Text fw={600}>
            Available Slots for {dateStr}
          </Text>

          {slotsLoading && (
            <Group gap="xs">
              <Loader size="xs" />
              <Text size="sm" c="dimmed">
                Loading slots...
              </Text>
            </Group>
          )}

          {slots && slots.length === 0 && !slotsLoading && (
            <Text size="sm" c="dimmed">
              No available slots for this doctor on the selected date.
            </Text>
          )}

          {slots && slots.length > 0 && (
            <Group gap="xs" wrap="wrap">
              {slots.map((slot) => (
                <Button
                  key={slot.start_time}
                  size="xs"
                  variant={
                    selectedSlot?.start_time === slot.start_time
                      ? "filled"
                      : "light"
                  }
                  disabled={!slot.is_available}
                  onClick={() => setSelectedSlot(slot)}
                >
                  {formatTime(slot.start_time)}
                  {!slot.is_available && " (Full)"}
                </Button>
              ))}
            </Group>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setStep("form")}>
              Back
            </Button>
            <Button
              onClick={() => bookMutation.mutate()}
              disabled={!selectedSlot}
              loading={bookMutation.isPending}
            >
              Confirm Booking
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

// ── Appointments Page ──────────────────────────────────────

export function AppointmentsPage() {
  useRequirePermission(P.OPD.APPOINTMENT.LIST);

  const canBook = useHasPermission(P.OPD.APPOINTMENT.CREATE);
  const canUpdate = useHasPermission(P.OPD.APPOINTMENT.UPDATE);
  const canCancel = useHasPermission(P.OPD.APPOINTMENT.CANCEL);

  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<string | null>(todayStr());
  const [cancelTarget, setCancelTarget] = useState<AppointmentWithPatient | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentWithPatient | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string | null>(null);
  const [rescheduleSlot, setRescheduleSlot] = useState<AvailableSlot | null>(null);

  const dateStr = dateFilter ?? undefined;

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["appointments", dateStr],
    queryFn: () =>
      api.listAppointments(dateStr ? { date: dateStr } : undefined),
  });

  const checkInMutation = useMutation({
    mutationFn: (id: string) => api.checkInAppointment(id),
    onSuccess: () => {
      notifications.show({
        title: "Checked in",
        message: "Patient has been checked in.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Check-in failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.completeAppointment(id),
    onSuccess: () => {
      notifications.show({
        title: "Completed",
        message: "Appointment marked as completed.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Complete failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const noShowMutation = useMutation({
    mutationFn: (id: string) => api.markAppointmentNoShow(id),
    onSuccess: () => {
      notifications.show({
        title: "Marked No-Show",
        message: "Appointment marked as no-show.",
        color: "warning",
      });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      api.cancelAppointment(cancelTarget!.id, {
        cancel_reason: cancelReason || undefined,
      }),
    onSuccess: () => {
      notifications.show({
        title: "Cancelled",
        message: "Appointment has been cancelled.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setCancelTarget(null);
      setCancelReason("");
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Cancel failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const rescheduleSlots = useQuery({
    queryKey: ["available-slots", rescheduleTarget?.doctor_id, rescheduleDate],
    queryFn: () => api.getAvailableSlots(rescheduleTarget!.doctor_id, rescheduleDate!),
    enabled: !!rescheduleTarget && !!rescheduleDate,
  });

  const rescheduleMutation = useMutation({
    mutationFn: (data: RescheduleAppointmentRequest) =>
      api.rescheduleAppointment(rescheduleTarget!.id, data),
    onSuccess: () => {
      notifications.show({
        title: "Rescheduled",
        message: "Appointment has been rescheduled.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setRescheduleTarget(null);
      setRescheduleDate(null);
      setRescheduleSlot(null);
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Reschedule failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle="OPD appointment scheduling and management"
        actions={
          canBook ? (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setModalOpen(true)}
            >
              Book Appointment
            </Button>
          ) : undefined
        }
      />

      <Group mb="md">
        <DatePickerInput
          label="Date"
          value={dateFilter}
          onChange={setDateFilter}
          clearable
          leftSection={<IconCalendar size={16} />}
          w={200}
        />
      </Group>

      {isLoading ? (
        <Stack align="center" py="xl">
          <Loader size="lg" />
          <Text c="dimmed">Loading appointments...</Text>
        </Stack>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Token</Table.Th>
              <Table.Th>Time</Table.Th>
              <Table.Th>Patient</Table.Th>
              <Table.Th>Doctor</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Reason</Table.Th>
              {(canUpdate || canCancel) && <Table.Th>Actions</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {appointments && appointments.length > 0 ? (
              appointments.map((appt) => (
                <Table.Tr key={appt.id}>
                  <Table.Td>
                    <Text size="sm" fw={600} ff="monospace">
                      {appt.token_number ?? "-"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <IconClock size={14} />
                      <Text size="sm">
                        {formatTime(appt.slot_start)} - {formatTime(appt.slot_end)}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{appt.patient_name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{appt.doctor_name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" size="sm">
                      {APPT_TYPE_LABELS[appt.appointment_type] ??
                        appt.appointment_type}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={STATUS_COLORS[appt.status] ?? "slate"}
                      variant="light"
                      size="sm"
                    >
                      {appt.status.replace(/_/g, " ")}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c={appt.reason ? undefined : "dimmed"} lineClamp={1}>
                      {appt.reason ?? "-"}
                    </Text>
                  </Table.Td>
                  {(canUpdate || canCancel) && (
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        {canUpdate &&
                          (appt.status === "scheduled" ||
                            appt.status === "confirmed") && (
                            <>
                              <ActionIcon
                                variant="subtle"
                                color="success"
                                title="Check In"
                                onClick={() =>
                                  checkInMutation.mutate(appt.id)
                                }
                                aria-label="Login"
                              >
                                <IconLogin size={16} />
                              </ActionIcon>
                              <ActionIcon
                                variant="subtle"
                                color="slate"
                                title="No Show"
                                onClick={() =>
                                  noShowMutation.mutate(appt.id)
                                }
                                aria-label="Call"
                              >
                                <IconPhone size={16} />
                              </ActionIcon>
                            </>
                          )}
                        {canUpdate &&
                          (appt.status === "scheduled" ||
                            appt.status === "confirmed") && (
                            <ActionIcon
                              variant="subtle"
                              color="primary"
                              title="Reschedule"
                              onClick={() => {
                                setRescheduleTarget(appt);
                                setRescheduleDate(null);
                                setRescheduleSlot(null);
                              }}
                              aria-label="Calendar Event"
                            >
                              <IconCalendarEvent size={16} />
                            </ActionIcon>
                          )}
                        {canUpdate &&
                          (appt.status === "checked_in" ||
                            appt.status === "in_consultation") && (
                            <ActionIcon
                              variant="subtle"
                              color="success"
                              title="Complete"
                              onClick={() =>
                                completeMutation.mutate(appt.id)
                              }
                              aria-label="Confirm"
                            >
                              <IconCheck size={16} />
                            </ActionIcon>
                          )}
                        {canCancel &&
                          appt.status !== "completed" &&
                          appt.status !== "cancelled" && (
                            <ActionIcon
                              variant="subtle"
                              color="danger"
                              title="Cancel"
                              onClick={() => setCancelTarget(appt)}
                              aria-label="Close"
                            >
                              <IconX size={16} />
                            </ActionIcon>
                          )}
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))
            ) : (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text c="dimmed" ta="center" py="lg">
                    No appointments for the selected date.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}

      <BookAppointmentModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      <Modal
        opened={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel Appointment"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Cancel appointment for{" "}
            <Text span fw={600}>
              {cancelTarget?.patient_name}
            </Text>{" "}
            at {cancelTarget ? formatTime(cancelTarget.slot_start) : ""}?
          </Text>
          <Textarea
            label="Cancel Reason"
            placeholder="Optional"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.currentTarget.value)}
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setCancelTarget(null)}>
              Keep
            </Button>
            <Button
              color="danger"
              onClick={() => cancelMutation.mutate()}
              loading={cancelMutation.isPending}
            >
              Cancel Appointment
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        opened={!!rescheduleTarget}
        onClose={() => {
          setRescheduleTarget(null);
          setRescheduleDate(null);
          setRescheduleSlot(null);
        }}
        title="Reschedule Appointment"
        size="md"
      >
        <Stack gap="md">
          <Text size="sm">
            Reschedule appointment for{" "}
            <Text span fw={600}>{rescheduleTarget?.patient_name}</Text>
            {" "}with Dr. {rescheduleTarget?.doctor_name}
          </Text>
          <Text size="xs" c="dimmed">
            Current: {rescheduleTarget ? `${rescheduleTarget.appointment_date} at ${formatTime(rescheduleTarget.slot_start)}` : ""}
          </Text>

          <DatePickerInput
            label="New Date"
            placeholder="Pick new date"
            value={rescheduleDate}
            onChange={(v: string | null) => {
              setRescheduleDate(v);
              setRescheduleSlot(null);
            }}
            minDate={new Date()}
            leftSection={<IconCalendar size={16} />}
          />

          {rescheduleDate && (
            <>
              {rescheduleSlots.isLoading && (
                <Group gap="xs">
                  <Loader size="xs" />
                  <Text size="sm" c="dimmed">Loading available slots...</Text>
                </Group>
              )}
              {rescheduleSlots.data && rescheduleSlots.data.length === 0 && (
                <Text size="sm" c="dimmed">No available slots for this date.</Text>
              )}
              {rescheduleSlots.data && rescheduleSlots.data.length > 0 && (
                <Group gap="xs" wrap="wrap">
                  {rescheduleSlots.data.map((slot: AvailableSlot) => (
                    <Button
                      key={slot.start_time}
                      size="xs"
                      variant={rescheduleSlot?.start_time === slot.start_time ? "filled" : "light"}
                      disabled={!slot.is_available}
                      onClick={() => setRescheduleSlot(slot)}
                    >
                      {formatTime(slot.start_time)}
                      {!slot.is_available && " (Full)"}
                    </Button>
                  ))}
                </Group>
              )}
            </>
          )}

          <Group justify="flex-end">
            <Button
              variant="light"
              onClick={() => {
                setRescheduleTarget(null);
                setRescheduleDate(null);
                setRescheduleSlot(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!rescheduleDate || !rescheduleSlot}
              loading={rescheduleMutation.isPending}
              onClick={() => {
                if (rescheduleDate && rescheduleSlot) {
                  rescheduleMutation.mutate({
                    appointment_date: rescheduleDate,
                    slot_start: rescheduleSlot.start_time,
                    slot_end: rescheduleSlot.end_time,
                  });
                }
              }}
            >
              Confirm Reschedule
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
