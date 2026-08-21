// Appointments BookAppointmentModal — split from appointments.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Loader, Modal, Select, Stack, Text, Textarea } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import type {
  AppointmentRecurrenceFormValue,
  AppointmentTypeFormValue,
  BookAppointmentFormInput,
} from "@medbrains/schemas";
import {
  bookAppointmentFormSchema,
  toAppointmentRecurrenceFormValue,
  toAppointmentTypeFormValue,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { AvailableSlot, DepartmentRow, SetupUser } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button, toast } from "@/components/ui";
import { parseDate } from "@/lib/date-utils";
import { appointmentsService } from "@/services/appointments.service";
import { formatTime, toFormDate } from "./shared";

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

export function BookAppointmentModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
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

  const canListUsers = useHasPermission(P.ADMIN.USERS.LIST);
  // doctorOptions is built from this list, so a refusal renders an empty
  // doctor picker — "nobody is available to book with" rather than "you may
  // not see the directory".
  const { data: users } = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => appointmentsService.listSetupUsers(),
    enabled: canListUsers,
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
      toast.error(err.message, { title: "Booking failed" });
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
      toast.warning("Select an available slot before confirming the booking.", {
        title: "Slot required",
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
