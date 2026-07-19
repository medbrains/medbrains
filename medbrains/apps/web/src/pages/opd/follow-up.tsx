// OPD FollowUpTab — split from opd.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Card, Group, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import type { OpdFollowUpAppointmentFormInput } from "@medbrains/schemas";
import { opdFollowUpAppointmentFormSchema } from "@medbrains/schemas";
import type { AvailableSlot, BookAppointmentRequest } from "@medbrains/types";
import { IconCalendarPlus, IconCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useClinicalEmit } from "@/components";
import { Button, toast } from "@/components/ui";
import {
  DEFAULT_OPD_FOLLOW_UP_FORM_VALUES,
  toBookFollowUpAppointmentRequest,
} from "@/forms/opd.form";
import { toDateString } from "@/lib/date-utils";
import { opdService } from "@/services/opd.service";

export function FollowUpTab({
  patientId,
  doctorId,
  departmentId,
  canUpdate,
}: {
  patientId: string;
  doctorId: string | null;
  departmentId: string;
  canUpdate: boolean;
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [booked, setBooked] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OpdFollowUpAppointmentFormInput>({
    resolver: zodResolver(opdFollowUpAppointmentFormSchema),
    defaultValues: DEFAULT_OPD_FOLLOW_UP_FORM_VALUES,
  });

  const selectedDate = watch("appointment_date");
  const selectedSlot = watch("slot");
  const selectedDateValue = selectedDate ?? "";

  // Get available slots when date is set and doctor is known
  const { data: slots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ["available-slots", doctorId, selectedDateValue],
    queryFn: () =>
      doctorId ? opdService.getAvailableSlots(doctorId, selectedDateValue) : Promise.resolve([]),
    enabled: Boolean(doctorId) && Boolean(selectedDateValue),
  });

  const availableSlots = slots.filter((s: AvailableSlot) => s.is_available);
  const slotOptions = availableSlots.map((s: AvailableSlot) => ({
    value: `${s.start_time}|${s.end_time}`,
    label: `${s.start_time} – ${s.end_time} (${s.max_patients - s.booked_count} available)`,
  }));

  const bookMutation = useMutation({
    mutationFn: (data: BookAppointmentRequest) => opdService.bookAppointment(data),
    onSuccess: (appointment) => {
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
      toast.success(`Appointment booked for ${appointment.appointment_date}`, {
        title: "Follow-up scheduled",
      });
      emit("opd.followup.scheduled", {
        appointment_date: appointment.appointment_date,
        appointment_id: appointment.id,
        department_id: appointment.department_id,
        doctor_id: appointment.doctor_id,
        patient_id: appointment.patient_id,
        source_record_id: appointment.id,
      });
      reset(DEFAULT_OPD_FOLLOW_UP_FORM_VALUES);
      setBooked(true);
    },
    onError: () => {
      toast.error("Failed to book follow-up", { title: "Error" });
    },
  });

  const handleBook = (values: OpdFollowUpAppointmentFormInput) => {
    if (!doctorId) return;
    bookMutation.mutate(
      toBookFollowUpAppointmentRequest(values, patientId, doctorId, departmentId),
    );
  };

  // Calculate min date (tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = toDateString(tomorrow);

  if (!doctorId) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        No doctor assigned to this encounter. Assign a doctor to enable follow-up scheduling.
      </Text>
    );
  }

  if (booked) {
    return (
      <Card padding="md" radius="md" withBorder>
        <Stack align="center" gap="sm" py="md">
          <IconCheck size={40} color="var(--mantine-color-green-6)" />
          <Text fw={600} size="lg">
            Follow-up Scheduled
          </Text>
          <Text size="sm" c="dimmed">
            Appointment was added to the appointment list and OPD handoff panel.
          </Text>
          <Button
            tone="ghost"
            size="sm"
            onClick={() => {
              setBooked(false);
              reset(DEFAULT_OPD_FOLLOW_UP_FORM_VALUES);
            }}
          >
            Schedule Another
          </Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Stack>
      {canUpdate ? (
        <Card
          component="form"
          onSubmit={handleSubmit(handleBook)}
          padding="sm"
          radius="md"
          withBorder
        >
          <Stack gap="sm">
            <Text size="sm" fw={600}>
              Schedule Follow-up Appointment
            </Text>
            <Controller
              control={control}
              name="appointment_date"
              render={({ field }) => (
                <TextInput
                  label="Follow-up Date"
                  type="date"
                  value={field.value ?? ""}
                  onChange={(event) => {
                    field.onChange(event.currentTarget.value);
                    setValue("slot", null, { shouldValidate: true });
                  }}
                  min={minDate}
                  error={errors.appointment_date?.message}
                  required
                />
              )}
            />
            {selectedDate &&
              (loadingSlots ? (
                <Text size="sm" c="dimmed">
                  Loading available slots...
                </Text>
              ) : slotOptions.length > 0 ? (
                <Controller
                  control={control}
                  name="slot"
                  render={({ field }) => (
                    <Select
                      label="Available Slot"
                      placeholder="Select a time slot"
                      data={slotOptions}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.slot?.message}
                      required
                    />
                  )}
                />
              ) : (
                <Text size="sm" c="orange">
                  No available slots on this date. Try a different date.
                </Text>
              ))}
            <Controller
              control={control}
              name="reason"
              render={({ field }) => (
                <Textarea
                  label="Reason for Follow-up"
                  placeholder="Post-op review, lab result review, medication adjustment..."
                  autosize
                  minRows={2}
                  maxRows={3}
                  {...field}
                />
              )}
            />
            <Group justify="flex-end">
              <Button
                tone="primary"
                type="submit"
                size="sm"
                leftSection={<IconCalendarPlus size={14} />}
                loading={bookMutation.isPending}
                disabled={!selectedDate || !selectedSlot}
              >
                Book Follow-up
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : (
        <Text size="sm" c="dimmed" ta="center" py="md">
          You do not have permission to schedule follow-up appointments.
        </Text>
      )}
    </Stack>
  );
}

// ── Prescriptions ────────────────────────────────────────
