import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import type {
  AppointmentRecurrenceFormValue,
  AppointmentTypeFormValue,
  BookAppointmentFormInput,
  CancelAppointmentFormInput,
  RescheduleAppointmentFormInput,
} from "@medbrains/schemas";
import {
  bookAppointmentFormSchema,
  cancelAppointmentFormSchema,
  rescheduleAppointmentFormSchema,
  toAppointmentRecurrenceFormValue,
  toAppointmentTypeFormValue,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AppointmentWithPatient,
  AvailableSlot,
  DepartmentRow,
  RescheduleAppointmentRequest,
  SetupUser,
} from "@medbrains/types";
import { P } from "@medbrains/types";
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
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { PageHeader } from "@/components/PageHeader";
import { Badge, type BadgeTone, Button, Table } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { parseDate, toDateString, todayDateString } from "@/lib/date-utils";
import { appointmentsService } from "@/services/appointments.service";

// ── Helpers ────────────────────────────────────────────────

const STATUS_COLORS: Record<string, BadgeTone> = {
  scheduled: "primary",
  confirmed: "info",
  checked_in: "warning",
  in_consultation: "warning",
  completed: "success",
  cancelled: "danger",
  no_show: "neutral",
};

const APPT_TYPE_LABELS: Record<string, string> = {
  new_visit: "New Visit",
  follow_up: "Follow-up",
  consultation: "Consultation",
  procedure: "Procedure",
  walk_in: "Walk-in",
};

const APPOINTMENT_TYPE_OPTIONS: Array<{ value: AppointmentTypeFormValue; label: string }> = [
  { value: "new_visit", label: "New Visit" },
  { value: "follow_up", label: "Follow-up" },
  { value: "consultation", label: "Consultation" },
  { value: "procedure", label: "Procedure" },
];

const RECURRENCE_PATTERN_OPTIONS: Array<{ value: AppointmentRecurrenceFormValue; label: string }> =
  [
    { value: "weekly", label: "Weekly" },
    { value: "biweekly", label: "Bi-weekly" },
    { value: "monthly", label: "Monthly" },
  ];

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h ?? "0", 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function todayStr(): string {
  return todayDateString();
}

function toFormDate(value: Date | string | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : toDateString(value);
}

const OPD_CHECK_IN_STATUSES = new Set(["scheduled", "confirmed", "checked_in"]);

const DEFAULT_BOOK_APPOINTMENT_VALUES: BookAppointmentFormInput = {
  patient_id: null,
  doctor_id: null,
  department_id: null,
  appointment_date: null,
  appointment_type: "new_visit",
  reason: "",
  recurrence_pattern: null,
  recurrence_count: "4",
};

// ── Book Appointment Modal ─────────────────────────────────

function BookAppointmentModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"form" | "slots">("form");
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<BookAppointmentFormInput>({
    resolver: zodResolver(bookAppointmentFormSchema),
    defaultValues: DEFAULT_BOOK_APPOINTMENT_VALUES,
    mode: "onTouched",
  });
  const values = watch();

  const { data: departments } = useQuery({
    queryKey: ["setup-departments"],
    queryFn: () => appointmentsService.listDepartments(),
  });

  const { data: users } = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => appointmentsService.listSetupUsers(),
  });

  const { data: patients } = useQuery({
    queryKey: ["patients-list"],
    queryFn: () => appointmentsService.listPatients({ per_page: 200 }),
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

  const dateStr = values.appointment_date ?? "";

  const { data: slots, isLoading: slotsLoading } = useQuery({
    queryKey: ["available-slots", values.doctor_id, dateStr],
    queryFn: () => appointmentsService.getAvailableSlots(values.doctor_id ?? "", dateStr),
    enabled: !!values.doctor_id && !!dateStr,
  });

  const bookMutation = useMutation({
    mutationFn: (formValues: BookAppointmentFormInput) =>
      appointmentsService.bookAppointment({
        patient_id: formValues.patient_id ?? "",
        doctor_id: formValues.doctor_id ?? "",
        department_id: formValues.department_id ?? "",
        appointment_date: formValues.appointment_date ?? "",
        slot_start: selectedSlot?.start_time ?? "",
        slot_end: selectedSlot?.end_time ?? "",
        appointment_type: formValues.appointment_type,
        reason: formValues.reason || undefined,
        recurrence_pattern: formValues.recurrence_pattern ?? undefined,
        recurrence_count: formValues.recurrence_pattern
          ? Number(formValues.recurrence_count) || 4
          : undefined,
      }),
    onSuccess: () => {
      notifications.show({
        title: "Appointment booked",
        message: values.recurrence_pattern
          ? `${Number(values.recurrence_count) || 4} recurring appointments scheduled.`
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
    setSelectedSlot(null);
    reset(DEFAULT_BOOK_APPOINTMENT_VALUES);
    onClose();
  };

  const canProceedToSlots =
    values.patient_id && values.doctor_id && values.department_id && values.appointment_date;
  const submitBooking = handleSubmit((formValues) => {
    if (!selectedSlot) {
      notifications.show({
        title: "Slot required",
        message: "Select an available slot before confirming the booking.",
        color: "warning",
      });
      return;
    }
    bookMutation.mutate(formValues);
  });

  return (
    <Modal opened={opened} onClose={handleClose} title="Book Appointment" size="lg">
      {step === "form" ? (
        <Stack gap="sm">
          <Controller
            control={control}
            name="patient_id"
            render={({ field }) => (
              <Select
                label="Patient"
                placeholder="Select patient"
                data={patientOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.patient_id?.message}
                searchable
                required
              />
            )}
          />
          <Controller
            control={control}
            name="department_id"
            render={({ field }) => (
              <Select
                label="Department"
                placeholder="Select department"
                data={deptOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.department_id?.message}
                searchable
                required
              />
            )}
          />
          <Controller
            control={control}
            name="doctor_id"
            render={({ field }) => (
              <Select
                label="Doctor"
                placeholder="Select doctor"
                data={doctorOptions}
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  setSelectedSlot(null);
                }}
                error={errors.doctor_id?.message}
                searchable
                required
              />
            )}
          />
          <Controller
            control={control}
            name="appointment_date"
            render={({ field }) => (
              <DatePickerInput
                label="Date"
                placeholder="Pick date"
                value={parseDate(field.value)}
                onChange={(value) => {
                  field.onChange(toFormDate(value));
                  setSelectedSlot(null);
                }}
                error={errors.appointment_date?.message}
                minDate={new Date()}
                required
              />
            )}
          />
          <Controller
            control={control}
            name="appointment_type"
            render={({ field }) => (
              <Select
                label="Appointment Type"
                data={APPOINTMENT_TYPE_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(toAppointmentTypeFormValue(value))}
              />
            )}
          />
          <Controller
            control={control}
            name="reason"
            render={({ field }) => (
              <Textarea
                label="Reason for Visit"
                placeholder="Optional"
                value={field.value}
                onChange={field.onChange}
                minRows={2}
              />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="recurrence_pattern"
              render={({ field }) => (
                <Select
                  label="Recurring"
                  placeholder="One-time"
                  data={RECURRENCE_PATTERN_OPTIONS}
                  value={field.value}
                  onChange={(value) => field.onChange(toAppointmentRecurrenceFormValue(value))}
                  clearable
                />
              )}
            />
            {values.recurrence_pattern && (
              <Controller
                control={control}
                name="recurrence_count"
                render={({ field }) => (
                  <Select
                    label="Number of Appointments"
                    data={["2", "3", "4", "6", "8", "12"]}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "4")}
                  />
                )}
              />
            )}
          </Group>
          <Group justify="flex-end" mt="md">
            <Button tone="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button tone="primary" onClick={() => setStep("slots")} disabled={!canProceedToSlots}>
              Select Time Slot
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="sm">
          <Text fw={600}>Available Slots for {dateStr}</Text>

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
                  tone={selectedSlot?.start_time === slot.start_time ? "primary" : "secondary"}
                  size="xs"
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
            <Button tone="secondary" onClick={() => setStep("form")}>
              Back
            </Button>
            <Button
              tone="primary"
              onClick={() => void submitBooking()}
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
  const canCreateOpdVisit = useHasPermission(P.OPD.VISIT_CREATE);
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);

  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<string | null>(todayStr());
  const [cancelTarget, setCancelTarget] = useState<AppointmentWithPatient | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentWithPatient | null>(null);
  const [rescheduleSlot, setRescheduleSlot] = useState<AvailableSlot | null>(null);
  const cancelForm = useForm<CancelAppointmentFormInput>({
    resolver: zodResolver(cancelAppointmentFormSchema),
    defaultValues: { cancel_reason: "" },
    mode: "onTouched",
  });
  const rescheduleForm = useForm<RescheduleAppointmentFormInput>({
    resolver: zodResolver(rescheduleAppointmentFormSchema),
    defaultValues: { appointment_date: null },
    mode: "onTouched",
  });

  const dateStr = dateFilter ?? undefined;
  const rescheduleDate = rescheduleForm.watch("appointment_date");

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["appointments", dateStr],
    queryFn: () => appointmentsService.listAppointments(dateStr ? { date: dateStr } : undefined),
  });

  const checkInMutation = useMutation({
    mutationFn: (appointment: AppointmentWithPatient) =>
      appointmentsService.createEncounter({
        patient_id: appointment.patient_id,
        department_id: appointment.department_id,
        doctor_id: appointment.doctor_id,
        appointment_id: appointment.id,
        notes: appointment.reason ?? undefined,
      }),
    onSuccess: (result) => {
      notifications.show({
        title: "Checked in to OPD",
        message: `OPD token T${String(result.queue.token_number).padStart(3, "0")} created.`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
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
    mutationFn: (id: string) => appointmentsService.completeAppointment(id),
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
    mutationFn: (id: string) => appointmentsService.markAppointmentNoShow(id),
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
    mutationFn: (formValues: CancelAppointmentFormInput) => {
      if (!cancelTarget) throw new Error("No appointment selected");
      return appointmentsService.cancelAppointment(cancelTarget.id, {
        cancel_reason: formValues.cancel_reason || undefined,
      });
    },
    onSuccess: () => {
      notifications.show({
        title: "Cancelled",
        message: "Appointment has been cancelled.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setCancelTarget(null);
      cancelForm.reset({ cancel_reason: "" });
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
    queryFn: () =>
      appointmentsService.getAvailableSlots(
        rescheduleTarget?.doctor_id ?? "",
        rescheduleDate ?? "",
      ),
    enabled: !!rescheduleTarget && !!rescheduleDate,
  });

  const rescheduleMutation = useMutation({
    mutationFn: (data: RescheduleAppointmentRequest) => {
      if (!rescheduleTarget) throw new Error("No appointment selected");
      return appointmentsService.rescheduleAppointment(rescheduleTarget.id, data);
    },
    onSuccess: () => {
      notifications.show({
        title: "Rescheduled",
        message: "Appointment has been rescheduled.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setRescheduleTarget(null);
      rescheduleForm.reset({ appointment_date: null });
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
  const submitCancel = cancelForm.handleSubmit((formValues) => cancelMutation.mutate(formValues));
  const submitReschedule = rescheduleForm.handleSubmit((formValues) => {
    if (!formValues.appointment_date || !rescheduleSlot) {
      notifications.show({
        title: "Slot required",
        message: "Select a new date and available slot before confirming.",
        color: "warning",
      });
      return;
    }
    rescheduleMutation.mutate({
      appointment_date: formValues.appointment_date,
      slot_start: rescheduleSlot.start_time,
      slot_end: rescheduleSlot.end_time,
    });
  });
  const currentDate = todayStr();

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle="OPD appointment scheduling and management"
        actions={
          canBook ? (
            <Button
              tone="primary"
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
          value={parseDate(dateFilter)}
          onChange={(value) => setDateFilter(toFormDate(value))}
          clearable
          leftSection={<IconCalendar size={16} />}
          w={200}
        />
        <Button tone="secondary" mt={24} onClick={() => setDateFilter(null)}>
          All appointments
        </Button>
        <Button tone="ghost" mt={24} onClick={() => setDateFilter(todayStr())}>
          Today
        </Button>
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
              appointments.map((appt) => {
                const canMoveToOpd =
                  canUpdate &&
                  canCreateOpdVisit &&
                  !appt.encounter_id &&
                  OPD_CHECK_IN_STATUSES.has(appt.status);
                const isFutureAppointment = appt.appointment_date > currentDate;
                const canCheckInToOpd = canMoveToOpd && !isFutureAppointment;
                const canManageOpenAppointment =
                  canUpdate && (appt.status === "scheduled" || appt.status === "confirmed");
                const canCompleteAppointment =
                  canUpdate &&
                  !!appt.encounter_id &&
                  (appt.status === "checked_in" || appt.status === "in_consultation");
                const checkInTooltip = canCheckInToOpd
                  ? "Create OPD encounter and queue token"
                  : "Available on the appointment date";

                return (
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
                      <Text size="sm" c={canViewPatientRecord ? undefined : "dimmed"}>
                        {canViewPatientRecord ? (appt.patient_name ?? "Patient") : "Restricted"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{appt.doctor_name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge tone="neutral" variant="light" size="sm">
                        {APPT_TYPE_LABELS[appt.appointment_type] ?? appt.appointment_type}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        tone={STATUS_COLORS[appt.status] ?? "neutral"}
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
                          {canMoveToOpd && (
                            <Tooltip label={checkInTooltip}>
                              <span>
                                <Button
                                  tone="primary"
                                  size="xs"
                                  leftSection={<IconLogin size={14} />}
                                  disabled={!canCheckInToOpd}
                                  loading={
                                    checkInMutation.isPending &&
                                    checkInMutation.variables?.id === appt.id
                                  }
                                  onClick={() => checkInMutation.mutate(appt)}
                                >
                                  Check in to OPD
                                </Button>
                              </span>
                            </Tooltip>
                          )}
                          {canManageOpenAppointment && (
                            <Tooltip label="Mark appointment as no-show">
                              <ActionIcon
                                variant="subtle"
                                color="slate"
                                onClick={() => noShowMutation.mutate(appt.id)}
                                aria-label="Mark appointment as no-show"
                              >
                                <IconPhone size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {canManageOpenAppointment && (
                            <Tooltip label="Reschedule appointment">
                              <ActionIcon
                                variant="subtle"
                                color="primary"
                                onClick={() => {
                                  setRescheduleTarget(appt);
                                  rescheduleForm.reset({ appointment_date: null });
                                  setRescheduleSlot(null);
                                }}
                                aria-label="Reschedule appointment"
                              >
                                <IconCalendarEvent size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {canCompleteAppointment && (
                            <Tooltip label="Mark appointment complete">
                              <ActionIcon
                                variant="subtle"
                                color="success"
                                onClick={() => completeMutation.mutate(appt.id)}
                                aria-label="Mark appointment complete"
                              >
                                <IconCheck size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {canCancel &&
                            appt.status !== "completed" &&
                            appt.status !== "cancelled" && (
                              <Tooltip label="Cancel appointment">
                                <ActionIcon
                                  variant="subtle"
                                  color="danger"
                                  onClick={() => {
                                    setCancelTarget(appt);
                                    cancelForm.reset({ cancel_reason: "" });
                                  }}
                                  aria-label="Cancel appointment"
                                >
                                  <IconX size={16} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                        </Group>
                      </Table.Td>
                    )}
                  </Table.Tr>
                );
              })
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

      <BookAppointmentModal opened={modalOpen} onClose={() => setModalOpen(false)} />

      <Modal
        opened={!!cancelTarget}
        onClose={() => {
          setCancelTarget(null);
          cancelForm.reset({ cancel_reason: "" });
        }}
        title="Cancel Appointment"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Cancel appointment for{" "}
            <Text span fw={600}>
              {canViewPatientRecord ? (cancelTarget?.patient_name ?? "Patient") : "Restricted"}
            </Text>{" "}
            at {cancelTarget ? formatTime(cancelTarget.slot_start) : ""}?
          </Text>
          <Controller
            control={cancelForm.control}
            name="cancel_reason"
            render={({ field }) => (
              <Textarea
                label="Cancel Reason"
                placeholder="Optional"
                value={field.value}
                onChange={field.onChange}
                minRows={2}
              />
            )}
          />
          <Group justify="flex-end">
            <Button
              tone="secondary"
              onClick={() => {
                setCancelTarget(null);
                cancelForm.reset({ cancel_reason: "" });
              }}
            >
              Keep
            </Button>
            <Button
              tone="danger"
              onClick={() => void submitCancel()}
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
          rescheduleForm.reset({ appointment_date: null });
          setRescheduleSlot(null);
        }}
        title="Reschedule Appointment"
        size="md"
      >
        <Stack gap="md">
          <Text size="sm">
            Reschedule appointment for{" "}
            <Text span fw={600}>
              {canViewPatientRecord ? (rescheduleTarget?.patient_name ?? "Patient") : "Restricted"}
            </Text>{" "}
            with Dr. {rescheduleTarget?.doctor_name}
          </Text>
          <Text size="xs" c="dimmed">
            Current:{" "}
            {rescheduleTarget
              ? `${rescheduleTarget.appointment_date} at ${formatTime(rescheduleTarget.slot_start)}`
              : ""}
          </Text>

          <Controller
            control={rescheduleForm.control}
            name="appointment_date"
            render={({ field, fieldState }) => (
              <DatePickerInput
                label="New Date"
                placeholder="Pick new date"
                value={parseDate(field.value)}
                onChange={(value) => {
                  field.onChange(toFormDate(value));
                  setRescheduleSlot(null);
                }}
                error={fieldState.error?.message}
                minDate={new Date()}
                leftSection={<IconCalendar size={16} />}
              />
            )}
          />

          {rescheduleDate && (
            <>
              {rescheduleSlots.isLoading && (
                <Group gap="xs">
                  <Loader size="xs" />
                  <Text size="sm" c="dimmed">
                    Loading available slots...
                  </Text>
                </Group>
              )}
              {rescheduleSlots.data && rescheduleSlots.data.length === 0 && (
                <Text size="sm" c="dimmed">
                  No available slots for this date.
                </Text>
              )}
              {rescheduleSlots.data && rescheduleSlots.data.length > 0 && (
                <Group gap="xs" wrap="wrap">
                  {rescheduleSlots.data.map((slot: AvailableSlot) => (
                    <Button
                      key={slot.start_time}
                      tone={
                        rescheduleSlot?.start_time === slot.start_time ? "primary" : "secondary"
                      }
                      size="xs"
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
              tone="secondary"
              onClick={() => {
                setRescheduleTarget(null);
                rescheduleForm.reset({ appointment_date: null });
                setRescheduleSlot(null);
              }}
            >
              Cancel
            </Button>
            <Button
              tone="primary"
              disabled={!rescheduleDate || !rescheduleSlot}
              loading={rescheduleMutation.isPending}
              onClick={() => void submitReschedule()}
            >
              Confirm Reschedule
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
