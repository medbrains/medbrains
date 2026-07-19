// IPD OverviewTab — split from ot.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox, Group, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { OtStatusReasonActionFormValue, OtStatusReasonFormInput } from "@medbrains/schemas";
import { otStatusReasonFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { OtBooking } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconCircleCheck, IconClock, IconPlayerPlay, IconX } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import {
  DEFAULT_OT_STATUS_REASON_FORM_VALUES,
  toUpdateOtBookingStatusRequest,
} from "@/forms/ot.form";
import { otService } from "@/services/ot.service";

const bookingStatusTones: Record<string, BadgeTone> = {
  requested: "warning",
  confirmed: "primary",
  in_progress: "success",
  completed: "success",
  cancelled: "danger",
  postponed: "warning",
};

export function OverviewTab({ booking: b }: { booking: OtBooking }) {
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission(P.OT.BOOKINGS_UPDATE);
  const [reasonAction, setReasonAction] = useState<OtStatusReasonActionFormValue>("cancel");
  const [reasonOpened, { open: openReasonEditor, close: closeReasonEditor }] = useDisclosure(false);
  const {
    control: reasonControl,
    handleSubmit: handleReasonSubmit,
    reset: resetReason,
    formState: { errors: reasonErrors },
  } = useForm<OtStatusReasonFormInput>({
    resolver: zodResolver(otStatusReasonFormSchema),
    defaultValues: DEFAULT_OT_STATUS_REASON_FORM_VALUES,
  });

  const openStatusReasonEditor = (action: OtStatusReasonActionFormValue) => {
    setReasonAction(action);
    resetReason(DEFAULT_OT_STATUS_REASON_FORM_VALUES);
    openReasonEditor();
  };

  const closeStatusReasonEditor = () => {
    closeReasonEditor();
    resetReason(DEFAULT_OT_STATUS_REASON_FORM_VALUES);
  };

  const statusMutation = useMutation({
    mutationFn: (payload: Parameters<typeof otService.updateOtBookingStatus>[1]) =>
      otService.updateOtBookingStatus(b.id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-booking", b.id] });
      void queryClient.invalidateQueries({ queryKey: ["ot-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["ot-schedule"] });
      toast.success("Booking status updated", { title: "Updated" });
      closeStatusReasonEditor();
    },
    onError: () => toast.error("Status update failed", { title: "Error" }),
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700} size="lg">
          {b.procedure_name}
        </Text>
        <Badge tone={bookingStatusTones[b.status] ?? "neutral"} size="lg">
          {b.status.replace("_", " ")}
        </Badge>
      </Group>

      <Text size="sm">Date: {b.scheduled_date}</Text>
      <Text size="sm">
        Time: {new Date(b.scheduled_start).toLocaleTimeString()} -{" "}
        {new Date(b.scheduled_end).toLocaleTimeString()}
      </Text>
      <PatientContextBanner patientId={b.patient_id} hideLoadingState />
      {b.laterality && <Text size="sm">Laterality: {b.laterality}</Text>}
      {b.estimated_duration_min && (
        <Text size="sm">Estimated Duration: {b.estimated_duration_min} min</Text>
      )}

      <Group gap="xs">
        <Checkbox label="Consent" checked={b.consent_obtained} readOnly size="xs" />
        <Checkbox label="Site Marked" checked={b.site_marked} readOnly size="xs" />
        <Checkbox label="Blood Arranged" checked={b.blood_arranged} readOnly size="xs" />
      </Group>
      {b.notes && (
        <Text size="sm" c="dimmed">
          {b.notes}
        </Text>
      )}

      {canUpdate && (
        <Stack gap="xs" mt="md">
          <Text size="sm" fw={600}>
            Status Transitions
          </Text>

          {b.status === "requested" && (
            <Group>
              <Button
                tone="primary"
                size="sm"
                leftSection={<IconCheck size={14} />}
                loading={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ status: "confirmed" })}
              >
                Confirm
              </Button>
              <Button
                tone="subtle-danger"
                size="sm"
                leftSection={<IconX size={14} />}
                onClick={() => openStatusReasonEditor("cancel")}
              >
                Cancel
              </Button>
            </Group>
          )}

          {b.status === "confirmed" && (
            <Group>
              <Button
                tone="primary"
                size="sm"
                leftSection={<IconPlayerPlay size={14} />}
                loading={statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate({
                    status: "in_progress",
                    actual_start: new Date().toISOString(),
                  })
                }
              >
                Start Surgery
              </Button>
              <Button
                tone="secondary"
                size="sm"
                leftSection={<IconClock size={14} />}
                onClick={() => openStatusReasonEditor("postpone")}
              >
                Postpone
              </Button>
              <Button
                tone="subtle-danger"
                size="sm"
                leftSection={<IconX size={14} />}
                onClick={() => openStatusReasonEditor("cancel")}
              >
                Cancel
              </Button>
            </Group>
          )}

          {b.status === "in_progress" && (
            <Group>
              <Button
                tone="primary"
                size="sm"
                leftSection={<IconCircleCheck size={14} />}
                loading={statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate({
                    status: "completed",
                    actual_end: new Date().toISOString(),
                  })
                }
              >
                Complete Surgery
              </Button>
              <Button
                tone="subtle-danger"
                size="sm"
                leftSection={<IconX size={14} />}
                onClick={() => openStatusReasonEditor("cancel")}
              >
                Cancel
              </Button>
            </Group>
          )}

          {reasonOpened && (
            <Stack
              component="form"
              gap="xs"
              onSubmit={handleReasonSubmit((values) =>
                statusMutation.mutate(toUpdateOtBookingStatusRequest(reasonAction, values)),
              )}
            >
              <Controller
                control={reasonControl}
                name="reason"
                render={({ field }) => (
                  <TextInput
                    label={reasonAction === "cancel" ? "Cancellation Reason" : "Postpone Reason"}
                    error={reasonErrors.reason?.message}
                    {...field}
                  />
                )}
              />
              <Group>
                <Button
                  tone={reasonAction === "cancel" ? "danger" : "primary"}
                  type="submit"
                  size="sm"
                  loading={statusMutation.isPending}
                >
                  Confirm {reasonAction === "cancel" ? "Cancellation" : "Postpone"}
                </Button>
                <Button tone="ghost" size="sm" onClick={closeStatusReasonEditor}>
                  Back
                </Button>
              </Group>
            </Stack>
          )}

          {(b.status === "completed" || b.status === "cancelled" || b.status === "postponed") && (
            <Text size="sm" c="dimmed">
              No further transitions available.
            </Text>
          )}
          {b.cancellation_reason && (
            <Text size="sm" c="danger">
              Cancellation reason: {b.cancellation_reason}
            </Text>
          )}
          {b.postpone_reason && (
            <Text size="sm" c="orange">
              Postpone reason: {b.postpone_reason}
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  );
}

// ── OT handoff cards (pre-op send-off + post-op handoff) ──
