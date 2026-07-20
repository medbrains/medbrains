import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Loader, Modal, Stack, Text, Textarea, Tooltip } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import type {
  CancelAppointmentFormInput,
  RescheduleAppointmentFormInput,
} from "@medbrains/schemas";
import { cancelAppointmentFormSchema, rescheduleAppointmentFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AppointmentWithPatient,
  AvailableSlot,
  RescheduleAppointmentRequest,
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
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { PageHeader } from "@/components/PageHeader";
import { Badge, type BadgeTone, Button, IconButton, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { parseDate, todayDateString } from "@/lib/date-utils";
import { appointmentsService } from "@/services/appointments.service";
import { BookAppointmentModal } from "./appointments/book-modal";
import { formatTime, toFormDate } from "./appointments/shared";

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

function todayStr(): string {
  return todayDateString();
}

const OPD_CHECK_IN_STATUSES = new Set(["scheduled", "confirmed", "checked_in"]);

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
      toast.error(err.message, { title: "Check-in failed" });
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
      toast.error(err.message, { title: "Complete failed" });
    },
  });

  const noShowMutation = useMutation({
    mutationFn: (id: string) => appointmentsService.markAppointmentNoShow(id),
    onSuccess: () => {
      toast.warning("Appointment marked as no-show.", { title: "Marked No-Show" });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Failed" });
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
      toast.error(err.message, { title: "Cancel failed" });
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
      toast.error(err.message, { title: "Reschedule failed" });
    },
  });
  const submitCancel = cancelForm.handleSubmit((formValues) => cancelMutation.mutate(formValues));
  const submitReschedule = rescheduleForm.handleSubmit((formValues) => {
    if (!formValues.appointment_date || !rescheduleSlot) {
      toast.warning("Select a new date and available slot before confirming.", {
        title: "Slot required",
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
        <DataTable
          columns={[
            {
              key: "token",
              label: "Token",
              render: (appt: AppointmentWithPatient) => (
                <Text size="sm" fw={600} ff="monospace">
                  {appt.token_number ?? "-"}
                </Text>
              ),
            },
            {
              key: "time",
              label: "Time",
              render: (appt: AppointmentWithPatient) => (
                <Group gap={4}>
                  <IconClock size={14} />
                  <Text size="sm">
                    {formatTime(appt.slot_start)} - {formatTime(appt.slot_end)}
                  </Text>
                </Group>
              ),
            },
            {
              key: "patient",
              label: "Patient",
              render: (appt: AppointmentWithPatient) => (
                <Text size="sm" c={canViewPatientRecord ? undefined : "dimmed"}>
                  {canViewPatientRecord ? (appt.patient_name ?? "Patient") : "Restricted"}
                </Text>
              ),
            },
            {
              key: "doctor",
              label: "Doctor",
              render: (appt: AppointmentWithPatient) => <Text size="sm">{appt.doctor_name}</Text>,
            },
            {
              key: "type",
              label: "Type",
              render: (appt: AppointmentWithPatient) => (
                <Badge tone="neutral" variant="light" size="sm">
                  {APPT_TYPE_LABELS[appt.appointment_type] ?? appt.appointment_type}
                </Badge>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (appt: AppointmentWithPatient) => (
                <Badge tone={STATUS_COLORS[appt.status] ?? "neutral"} variant="light" size="sm">
                  {appt.status.replace(/_/g, " ")}
                </Badge>
              ),
            },
            {
              key: "reason",
              label: "Reason",
              render: (appt: AppointmentWithPatient) => (
                <Text size="sm" c={appt.reason ? undefined : "dimmed"} lineClamp={1}>
                  {appt.reason ?? "-"}
                </Text>
              ),
            },
            ...(canUpdate || canCancel
              ? [
                  {
                    key: "actions",
                    label: "Actions",
                    render: (appt: AppointmentWithPatient) => {
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
                              <IconButton
                                onClick={() => noShowMutation.mutate(appt.id)}
                                aria-label="Mark appointment as no-show"
                              >
                                <IconPhone size={16} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canManageOpenAppointment && (
                            <Tooltip label="Reschedule appointment">
                              <IconButton
                                tone="primary"
                                onClick={() => {
                                  setRescheduleTarget(appt);
                                  rescheduleForm.reset({ appointment_date: null });
                                  setRescheduleSlot(null);
                                }}
                                aria-label="Reschedule appointment"
                              >
                                <IconCalendarEvent size={16} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canCompleteAppointment && (
                            <Tooltip label="Mark appointment complete">
                              <IconButton
                                tone="success"
                                onClick={() => completeMutation.mutate(appt.id)}
                                aria-label="Mark appointment complete"
                              >
                                <IconCheck size={16} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canCancel &&
                            appt.status !== "completed" &&
                            appt.status !== "cancelled" && (
                              <Tooltip label="Cancel appointment">
                                <IconButton
                                  tone="danger"
                                  onClick={() => {
                                    setCancelTarget(appt);
                                    cancelForm.reset({ cancel_reason: "" });
                                  }}
                                  aria-label="Cancel appointment"
                                >
                                  <IconX size={16} />
                                </IconButton>
                              </Tooltip>
                            )}
                        </Group>
                      );
                    },
                  },
                ]
              : []),
          ]}
          data={appointments ?? []}
          rowKey={(appt) => appt.id}
          emptyTitle="No appointments for the selected date."
        />
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
