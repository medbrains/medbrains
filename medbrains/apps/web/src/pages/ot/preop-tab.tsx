// IPD PreopTab — split from ot.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox, Group, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type {
  OtPreopAssessmentFormInput,
  OtPreopAssessmentUpdateFormInput,
} from "@medbrains/schemas";
import { otPreopAssessmentFormSchema, otPreopAssessmentUpdateFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { OtPreopAssessment } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Badge, Button, toast } from "@/components/ui";
import {
  DEFAULT_OT_PREOP_ASSESSMENT_FORM_VALUES,
  DEFAULT_OT_PREOP_UPDATE_FORM_VALUES,
  normalizeOtAsaClassification,
  normalizeOtPreopClearanceStatus,
  OT_ASA_OPTIONS,
  OT_PREOP_CLEARANCE_STATUS_OPTIONS,
  toCreatePreopAssessmentRequest,
  toUpdatePreopAssessmentRequest,
} from "@/forms/ot.form";
import { otService } from "@/services/ot.service";

export function PreopTab({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.OT.PREOP_CREATE);
  const [editing, { open: openEditing, close: closeEditing }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ot-preop", bookingId],
    queryFn: () => otService.listPreopAssessments(bookingId),
  });

  const assessments: OtPreopAssessment[] = data ?? [];
  const assessment = assessments[0];
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OtPreopAssessmentFormInput>({
    resolver: zodResolver(otPreopAssessmentFormSchema),
    defaultValues: DEFAULT_OT_PREOP_ASSESSMENT_FORM_VALUES,
  });

  const createMutation = useMutation({
    mutationFn: (values: OtPreopAssessmentFormInput) =>
      otService.createPreopAssessment(bookingId, toCreatePreopAssessmentRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-preop", bookingId] });
      toast.success("Pre-op assessment recorded", { title: "Saved" });
      reset(DEFAULT_OT_PREOP_ASSESSMENT_FORM_VALUES);
    },
    onError: () => toast.error("Failed to save assessment", { title: "Error" }),
  });

  const {
    control: updateControl,
    handleSubmit: handleUpdateSubmit,
    reset: resetUpdate,
    formState: { errors: updateErrors },
  } = useForm<OtPreopAssessmentUpdateFormInput>({
    resolver: zodResolver(otPreopAssessmentUpdateFormSchema),
    defaultValues: DEFAULT_OT_PREOP_UPDATE_FORM_VALUES,
  });

  const updateMutation = useMutation({
    mutationFn: (values: OtPreopAssessmentUpdateFormInput) =>
      otService.updatePreopAssessment(bookingId, toUpdatePreopAssessmentRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-preop", bookingId] });
      toast.success("Assessment updated", { title: "Updated" });
      closeEditing();
      resetUpdate(DEFAULT_OT_PREOP_UPDATE_FORM_VALUES);
    },
    onError: () => toast.error("Update failed", { title: "Error" }),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  if (assessment && !editing) {
    const a = assessment;
    return (
      <Stack>
        <Group justify="space-between">
          <Text fw={600}>Pre-Operative Assessment</Text>
          <Badge
            tone={
              a.clearance_status === "cleared"
                ? "success"
                : a.clearance_status === "not_cleared"
                  ? "danger"
                  : "warning"
            }
          >
            {a.clearance_status.replace("_", " ")}
          </Badge>
        </Group>
        {a.asa_class && (
          <Text size="sm">ASA Class: {a.asa_class.replace("_", " ").toUpperCase()}</Text>
        )}
        <Group gap="md">
          <Checkbox label="Fasting" checked={a.fasting_status} readOnly size="xs" />
          <Checkbox label="Labs Reviewed" checked={a.lab_results_reviewed} readOnly size="xs" />
          <Checkbox label="Imaging Reviewed" checked={a.imaging_reviewed} readOnly size="xs" />
          <Checkbox
            label="Blood Group Confirmed"
            checked={a.blood_group_confirmed}
            readOnly
            size="xs"
          />
        </Group>
        {a.npo_since && <Text size="sm">NPO Since: {a.npo_since}</Text>}
        {a.allergies_noted && <Text size="sm">Allergies: {a.allergies_noted}</Text>}
        {a.current_medications && <Text size="sm">Medications: {a.current_medications}</Text>}
        {a.conditions && <Text size="sm">Conditions: {a.conditions}</Text>}
        <Text size="xs" c="dimmed">
          Assessed at: {new Date(a.assessed_at).toLocaleString()}
        </Text>
        {canCreate && (
          <Button
            tone="secondary"
            size="sm"
            onClick={() => {
              resetUpdate({
                clearance_status: a.clearance_status,
                asa_class: a.asa_class,
              });
              openEditing();
            }}
          >
            Edit Assessment
          </Button>
        )}
      </Stack>
    );
  }

  if (assessment && editing) {
    return (
      <Stack
        component="form"
        onSubmit={handleUpdateSubmit((values) => updateMutation.mutate(values))}
      >
        <Text fw={600}>Edit Assessment</Text>
        <Controller
          control={updateControl}
          name="clearance_status"
          render={({ field }) => (
            <Select
              label="Clearance Status"
              data={OT_PREOP_CLEARANCE_STATUS_OPTIONS}
              value={field.value}
              onChange={(value) => field.onChange(normalizeOtPreopClearanceStatus(value))}
              error={updateErrors.clearance_status?.message}
            />
          )}
        />
        <Controller
          control={updateControl}
          name="asa_class"
          render={({ field }) => (
            <Select
              label="ASA Class"
              data={OT_ASA_OPTIONS}
              value={field.value}
              onChange={(value) => field.onChange(normalizeOtAsaClassification(value))}
              error={updateErrors.asa_class?.message}
              clearable
            />
          )}
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
              resetUpdate(DEFAULT_OT_PREOP_UPDATE_FORM_VALUES);
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
        No pre-op assessment recorded.
      </Text>
    );

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
      <Text fw={600}>Create Pre-Op Assessment</Text>
      <Controller
        control={control}
        name="asa_class"
        render={({ field }) => (
          <Select
            label="ASA Class"
            data={OT_ASA_OPTIONS}
            value={field.value}
            onChange={(value) => field.onChange(normalizeOtAsaClassification(value))}
            error={errors.asa_class?.message}
            clearable
          />
        )}
      />
      <Controller
        control={control}
        name="fasting_status"
        render={({ field }) => (
          <Checkbox
            label="Fasting"
            checked={field.value}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
      <Controller
        control={control}
        name="npo_since"
        render={({ field }) => <TextInput label="NPO Since" placeholder="e.g. 22:00" {...field} />}
      />
      <Controller
        control={control}
        name="lab_results_reviewed"
        render={({ field }) => (
          <Checkbox
            label="Lab Results Reviewed"
            checked={field.value}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
      <Controller
        control={control}
        name="imaging_reviewed"
        render={({ field }) => (
          <Checkbox
            label="Imaging Reviewed"
            checked={field.value}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
      <Controller
        control={control}
        name="blood_group_confirmed"
        render={({ field }) => (
          <Checkbox
            label="Blood Group Confirmed"
            checked={field.value}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
      <Controller
        control={control}
        name="allergies_noted"
        render={({ field }) => <TextInput label="Allergies" {...field} />}
      />
      <Controller
        control={control}
        name="current_medications"
        render={({ field }) => <TextInput label="Current Medications" {...field} />}
      />
      <Controller
        control={control}
        name="conditions"
        render={({ field }) => <Textarea label="Conditions" {...field} />}
      />
      <Button tone="primary" type="submit" loading={createMutation.isPending}>
        Save Assessment
      </Button>
    </Stack>
  );
}

// ── WHO Safety Checklist Sub-Tab ──────────────────────
