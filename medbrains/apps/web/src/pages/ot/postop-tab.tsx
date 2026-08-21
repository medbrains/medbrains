// IPD PostopTab — split from ot.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { OtPostopRecordFormInput, OtPostopRecordUpdateFormInput } from "@medbrains/schemas";
import { otPostopRecordFormSchema, otPostopRecordUpdateFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { OtPostopRecord } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Badge, Button, toast } from "@/components/ui";
import {
  DEFAULT_OT_POSTOP_RECORD_FORM_VALUES,
  DEFAULT_OT_POSTOP_UPDATE_FORM_VALUES,
  normalizeOtPostopRecoveryStatus,
  OT_POSTOP_RECOVERY_STATUS_OPTIONS,
  toCreatePostopRecordRequest,
  toUpdatePostopRecordRequest,
} from "@/forms/ot.form";
import { otService } from "@/services/ot.service";

export function PostopTab({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.OT.POSTOP_CREATE);
  // The tab holds only the create code; reading the record carries its
  // own. Refused, the fetch returns nothing and the panel below renders
  // as though the record does not exist.
  const canView = useHasPermission(P.OT.POSTOP_LIST);

  const { data: record = null, isLoading } = useQuery<OtPostopRecord | null>({
    queryKey: ["ot-postop", bookingId],
    queryFn: () => otService.getPostopRecord(bookingId),
    enabled: canView,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OtPostopRecordFormInput>({
    resolver: zodResolver(otPostopRecordFormSchema),
    defaultValues: DEFAULT_OT_POSTOP_RECORD_FORM_VALUES,
  });

  const createMutation = useMutation({
    mutationFn: (values: OtPostopRecordFormInput) =>
      otService.createPostopRecord(bookingId, toCreatePostopRecordRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-postop", bookingId] });
      toast.success("Post-op record created", { title: "Saved" });
      reset(DEFAULT_OT_POSTOP_RECORD_FORM_VALUES);
    },
    onError: () => toast.error("Failed to save post-op record", { title: "Error" }),
  });

  const [editing, { open: openEditing, close: closeEditing }] = useDisclosure(false);
  const {
    control: updateControl,
    handleSubmit: handleUpdateSubmit,
    reset: resetUpdate,
    formState: { errors: updateErrors },
  } = useForm<OtPostopRecordUpdateFormInput>({
    resolver: zodResolver(otPostopRecordUpdateFormSchema),
    defaultValues: DEFAULT_OT_POSTOP_UPDATE_FORM_VALUES,
  });

  const updateMutation = useMutation({
    mutationFn: (values: OtPostopRecordUpdateFormInput) =>
      otService.updatePostopRecord(bookingId, toUpdatePostopRecordRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-postop", bookingId] });
      toast.success("Post-op record updated", { title: "Updated" });
      closeEditing();
      resetUpdate(DEFAULT_OT_POSTOP_UPDATE_FORM_VALUES);
    },
    onError: () => toast.error("Update failed", { title: "Error" }),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  if (record && !editing) {
    return (
      <Stack>
        <Group justify="space-between">
          <Text fw={600}>Post-Op / PACU Recovery</Text>
          <Badge
            tone={
              record.recovery_status === "discharged" ||
              record.recovery_status === "shifted_to_ward"
                ? "success"
                : record.recovery_status === "shifted_to_icu"
                  ? "warning"
                  : "primary"
            }
          >
            {record.recovery_status.replace(/_/g, " ")}
          </Badge>
        </Group>
        {record.arrival_time && (
          <Text size="sm">Arrival: {new Date(record.arrival_time).toLocaleTimeString()}</Text>
        )}
        {record.discharge_time && (
          <Text size="sm">Discharge: {new Date(record.discharge_time).toLocaleTimeString()}</Text>
        )}
        {record.aldrete_score_arrival != null && (
          <Text size="sm">Aldrete (arrival): {record.aldrete_score_arrival}/10</Text>
        )}
        {record.aldrete_score_discharge != null && (
          <Text size="sm">Aldrete (discharge): {record.aldrete_score_discharge}/10</Text>
        )}
        {record.pain_assessment && <Text size="sm">Pain: {record.pain_assessment}</Text>}
        {record.fluid_orders && <Text size="sm">Fluid Orders: {record.fluid_orders}</Text>}
        {record.diet_orders && <Text size="sm">Diet: {record.diet_orders}</Text>}
        {record.activity_orders && <Text size="sm">Activity: {record.activity_orders}</Text>}
        {record.disposition && <Text size="sm">Disposition: {record.disposition}</Text>}
        {record.notes && (
          <Text size="sm" c="dimmed">
            {record.notes}
          </Text>
        )}
        {canCreate && (
          <Button
            tone="secondary"
            size="sm"
            onClick={() => {
              resetUpdate({
                recovery_status: record.recovery_status,
                aldrete_score_discharge: record.aldrete_score_discharge ?? "",
                discharge_time: "",
                disposition: record.disposition ?? "",
                notes: record.notes ?? "",
              });
              openEditing();
            }}
          >
            Update Recovery
          </Button>
        )}
      </Stack>
    );
  }

  if (record && editing) {
    return (
      <Stack
        component="form"
        onSubmit={handleUpdateSubmit((values) => updateMutation.mutate(values))}
      >
        <Text fw={600}>Update Post-Op Recovery</Text>
        <Controller
          control={updateControl}
          name="recovery_status"
          render={({ field }) => (
            <Select
              label="Recovery Status"
              data={OT_POSTOP_RECOVERY_STATUS_OPTIONS}
              value={field.value}
              onChange={(value) => field.onChange(normalizeOtPostopRecoveryStatus(value))}
              error={updateErrors.recovery_status?.message}
            />
          )}
        />
        <Controller
          control={updateControl}
          name="aldrete_score_discharge"
          render={({ field }) => (
            <NumberInput
              label="Aldrete Score (discharge)"
              min={0}
              max={10}
              value={field.value}
              onChange={field.onChange}
              error={updateErrors.aldrete_score_discharge?.message}
            />
          )}
        />
        <Controller
          control={updateControl}
          name="discharge_time"
          render={({ field }) => (
            <TextInput label="Discharge Time (ISO)" placeholder="Auto or manual" {...field} />
          )}
        />
        <Controller
          control={updateControl}
          name="disposition"
          render={({ field }) => <TextInput label="Disposition" {...field} />}
        />
        <Controller
          control={updateControl}
          name="notes"
          render={({ field }) => <Textarea label="Notes" {...field} />}
        />
        <Group>
          <Button tone="primary" size="sm" type="submit" loading={updateMutation.isPending}>
            Save
          </Button>
          <Button
            tone="ghost"
            size="sm"
            onClick={() => {
              closeEditing();
              resetUpdate(DEFAULT_OT_POSTOP_UPDATE_FORM_VALUES);
            }}
          >
            Cancel
          </Button>
        </Group>
      </Stack>
    );
  }

  if (!canCreate)
    return (
      <Text c="dimmed" size="sm">
        {canView
          ? "No post-op record yet."
          : "You do not have permission to view the post-op record."}
      </Text>
    );

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
      <Text fw={600}>Create Post-Op Record</Text>
      <Controller
        control={control}
        name="arrival_time"
        render={({ field }) => (
          <TextInput label="Arrival Time (ISO)" placeholder="PACU arrival" {...field} />
        )}
      />
      <Controller
        control={control}
        name="aldrete_score_arrival"
        render={({ field }) => (
          <NumberInput
            label="Aldrete Score (arrival)"
            min={0}
            max={10}
            value={field.value}
            onChange={field.onChange}
            error={errors.aldrete_score_arrival?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="pain_assessment"
        render={({ field }) => (
          <TextInput label="Pain Assessment" placeholder="e.g. NRS 4/10" {...field} />
        )}
      />
      <Controller
        control={control}
        name="fluid_orders"
        render={({ field }) => <TextInput label="Fluid Orders" {...field} />}
      />
      <Controller
        control={control}
        name="diet_orders"
        render={({ field }) => <TextInput label="Diet Orders" {...field} />}
      />
      <Controller
        control={control}
        name="activity_orders"
        render={({ field }) => <TextInput label="Activity Orders" {...field} />}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <Textarea label="Notes" {...field} />}
      />
      <Button tone="primary" type="submit" loading={createMutation.isPending}>
        Save Post-Op Record
      </Button>
    </Stack>
  );
}

// ── Rooms Tab ──────────────────────────────────────────
