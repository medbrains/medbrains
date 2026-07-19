// IPD AnesthesiaTab — split from ot.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import type { OtAnesthesiaRecordFormInput } from "@medbrains/schemas";
import { otAnesthesiaRecordFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { OtAnesthesiaRecord } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Button, toast } from "@/components/ui";
import {
  DEFAULT_OT_ANESTHESIA_RECORD_FORM_VALUES,
  normalizeOtAnesthesiaType,
  normalizeOtAsaClassification,
  OT_ANESTHESIA_TYPE_OPTIONS,
  OT_ASA_OPTIONS,
  toCreateAnesthesiaRecordRequest,
} from "@/forms/ot.form";
import { otService } from "@/services/ot.service";

export function AnesthesiaTab({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.OT.ANESTHESIA_CREATE);

  const { data: record = null, isLoading } = useQuery<OtAnesthesiaRecord | null>({
    queryKey: ["ot-anesthesia", bookingId],
    queryFn: () => otService.getAnesthesiaRecord(bookingId),
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<OtAnesthesiaRecordFormInput>({
    resolver: zodResolver(otAnesthesiaRecordFormSchema),
    defaultValues: DEFAULT_OT_ANESTHESIA_RECORD_FORM_VALUES,
  });
  const inductionTime = watch("induction_time");

  const createMutation = useMutation({
    mutationFn: (values: OtAnesthesiaRecordFormInput) =>
      otService.createAnesthesiaRecord(bookingId, toCreateAnesthesiaRecordRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-anesthesia", bookingId] });
      toast.success("Anesthesia record created", { title: "Saved" });
      reset(DEFAULT_OT_ANESTHESIA_RECORD_FORM_VALUES);
    },
    onError: (e: Error) =>
      toast.error(e.message || "Failed to save anesthesia record", { title: "Error" }),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  if (record) {
    return (
      <Stack>
        <Text fw={600}>Anesthesia Record</Text>
        <Text size="sm">Type: {record.anesthesia_type.replace("_", " ")}</Text>
        {record.asa_class && (
          <Text size="sm">ASA Class: {record.asa_class.replace("_", " ").toUpperCase()}</Text>
        )}
        {record.induction_time && (
          <Text size="sm">Induction: {new Date(record.induction_time).toLocaleTimeString()}</Text>
        )}
        {record.intubation_time && (
          <Text size="sm">Intubation: {new Date(record.intubation_time).toLocaleTimeString()}</Text>
        )}
        {record.extubation_time && (
          <Text size="sm">Extubation: {new Date(record.extubation_time).toLocaleTimeString()}</Text>
        )}
        {record.complications && (
          <Text size="sm" c="danger">
            Complications: {record.complications}
          </Text>
        )}
        {record.notes && (
          <Text size="sm" c="dimmed">
            {record.notes}
          </Text>
        )}
      </Stack>
    );
  }

  if (!canCreate)
    return (
      <Text c="dimmed" size="sm">
        No anesthesia record yet.
      </Text>
    );

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
      <Text fw={600}>Create Anesthesia Record</Text>
      <Controller
        control={control}
        name="anesthesia_type"
        render={({ field }) => (
          <Select
            label="Anesthesia Type"
            data={OT_ANESTHESIA_TYPE_OPTIONS}
            required
            value={field.value}
            onChange={(value) => field.onChange(normalizeOtAnesthesiaType(value))}
            error={errors.anesthesia_type?.message}
          />
        )}
      />
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
        name="induction_time"
        render={({ field }) => <TextInput label="Induction Time (ISO)" {...field} />}
      />
      {inductionTime.trim() !== "" && (
        <Controller
          control={control}
          name="fasting_override_reason"
          render={({ field }) => (
            <Textarea
              label="Fasting override reason (emergency only)"
              description="Induction requires confirmed pre-op fasting (NPO). If fasting isn't confirmed, an emergency override reason is required — e.g. emergency RSI with aspiration precautions."
              placeholder="e.g. Emergency laparotomy — RSI with cricoid pressure, full-stomach precautions."
              {...field}
            />
          )}
        />
      )}
      <Controller
        control={control}
        name="intubation_time"
        render={({ field }) => <TextInput label="Intubation Time (ISO)" {...field} />}
      />
      <Controller
        control={control}
        name="airway_details"
        render={({ field }) => (
          <Textarea label="Airway Details" placeholder="Airway assessment details" {...field} />
        )}
      />
      <Controller
        control={control}
        name="drugs_administered"
        render={({ field }) => (
          <Textarea label="Drugs Administered" placeholder="List drugs, doses, routes" {...field} />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <Textarea label="Notes" {...field} />}
      />
      <Button tone="primary" type="submit" loading={createMutation.isPending}>
        Save Anesthesia Record
      </Button>
    </Stack>
  );
}

// ── Post-Op / PACU Sub-Tab ────────────────────────────
