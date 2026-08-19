// IPD CaseRecordTab — split from ot.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox, Group, NumberInput, Stack, Text, Textarea, TextInput } from "@mantine/core";
import type { OtCaseRecordFormInput } from "@medbrains/schemas";
import { otCaseRecordFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { OtCaseRecord } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Button, toast } from "@/components/ui";
import { DEFAULT_OT_CASE_RECORD_FORM_VALUES, toCreateCaseRecordRequest } from "@/forms/ot.form";
import { otService } from "@/services/ot.service";

export function CaseRecordTab({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.OT.CASE_RECORDS_CREATE);
  // The tab holds only the create code; reading the record carries its
  // own. Refused, the fetch returns nothing and the panel below renders
  // as though the record does not exist.
  const canView = useHasPermission(P.OT.CASE_RECORDS_LIST);

  const { data: record = null, isLoading } = useQuery<OtCaseRecord | null>({
    queryKey: ["ot-case-record", bookingId],
    queryFn: () => otService.getCaseRecord(bookingId),
    enabled: canView,
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<OtCaseRecordFormInput>({
    resolver: zodResolver(otCaseRecordFormSchema),
    defaultValues: DEFAULT_OT_CASE_RECORD_FORM_VALUES,
  });
  const instrumentCountBefore = watch("instrument_count_correct_before");
  const instrumentCountAfter = watch("instrument_count_correct_after");
  const spongeCountCorrect = watch("sponge_count_correct");

  const createMutation = useMutation({
    mutationFn: (values: OtCaseRecordFormInput) =>
      otService.createCaseRecord(bookingId, toCreateCaseRecordRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-case-record", bookingId] });
      toast.success("Case record created", { title: "Saved" });
      reset(DEFAULT_OT_CASE_RECORD_FORM_VALUES);
    },
    onError: (e: Error) =>
      toast.error(e.message || "Failed to save case record", { title: "Error" }),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  if (record) {
    return (
      <Stack>
        <Text fw={600}>Surgical Case Record</Text>
        <Text size="sm" fw={500}>
          Procedure: {record.procedure_performed}
        </Text>
        {record.incision_time && (
          <Text size="sm">Incision: {new Date(record.incision_time).toLocaleTimeString()}</Text>
        )}
        {record.closure_time && (
          <Text size="sm">Closure: {new Date(record.closure_time).toLocaleTimeString()}</Text>
        )}
        {record.patient_in_time && (
          <Text size="sm">Patient In: {new Date(record.patient_in_time).toLocaleTimeString()}</Text>
        )}
        {record.patient_out_time && (
          <Text size="sm">
            Patient Out: {new Date(record.patient_out_time).toLocaleTimeString()}
          </Text>
        )}
        {record.findings && <Text size="sm">Findings: {record.findings}</Text>}
        {record.technique && <Text size="sm">Technique: {record.technique}</Text>}
        {record.complications && (
          <Text size="sm" c="danger">
            Complications: {record.complications}
          </Text>
        )}
        {record.blood_loss_ml != null && (
          <Text size="sm">Blood Loss: {record.blood_loss_ml} ml</Text>
        )}

        <Text size="sm" fw={500} mt="xs">
          Counts
        </Text>
        <Group gap="md">
          <Checkbox
            label="Instruments (before)"
            checked={record.instrument_count_correct_before ?? false}
            readOnly
            size="xs"
            color={record.instrument_count_correct_before ? "success" : "danger"}
          />
          <Checkbox
            label="Instruments (after)"
            checked={record.instrument_count_correct_after ?? false}
            readOnly
            size="xs"
            color={record.instrument_count_correct_after ? "success" : "danger"}
          />
          <Checkbox
            label="Sponges"
            checked={record.sponge_count_correct ?? false}
            readOnly
            size="xs"
            color={record.sponge_count_correct ? "success" : "danger"}
          />
        </Group>
        {(record.instrument_count_correct_before === false ||
          record.instrument_count_correct_after === false ||
          record.sponge_count_correct === false) && (
          <Text size="xs" c="danger" fw={600}>
            WARNING: Count discrepancy detected — verify immediately!
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
        {canView ? "No case record yet." : "You do not have permission to view the case record."}
      </Text>
    );

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
      <Text fw={600}>Create Case Record</Text>
      <Controller
        control={control}
        name="procedure_performed"
        render={({ field }) => (
          <TextInput
            label="Procedure Performed"
            required
            {...field}
            error={errors.procedure_performed?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="findings"
        render={({ field }) => <Textarea label="Findings" {...field} />}
      />
      <Controller
        control={control}
        name="technique"
        render={({ field }) => <Textarea label="Technique" {...field} />}
      />
      <Controller
        control={control}
        name="complications"
        render={({ field }) => <Textarea label="Complications" {...field} />}
      />
      <Controller
        control={control}
        name="blood_loss_ml"
        render={({ field }) => (
          <NumberInput
            label="Blood Loss (ml)"
            min={0}
            value={field.value}
            onChange={field.onChange}
            error={errors.blood_loss_ml?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="incision_time"
        render={({ field }) => (
          <TextInput label="Incision Time (ISO)" placeholder="Auto-filled or manual" {...field} />
        )}
      />
      <Controller
        control={control}
        name="closure_time"
        render={({ field }) => <TextInput label="Closure Time (ISO)" {...field} />}
      />
      <Controller
        control={control}
        name="patient_in_time"
        render={({ field }) => <TextInput label="Patient In Time (ISO)" {...field} />}
      />
      <Controller
        control={control}
        name="patient_out_time"
        render={({ field }) => <TextInput label="Patient Out Time (ISO)" {...field} />}
      />

      <Text size="sm" fw={500} mt="xs">
        Instrument & Sponge Counts
      </Text>
      <Controller
        control={control}
        name="instrument_count_correct_before"
        render={({ field }) => (
          <Checkbox
            label="Instruments correct (before)"
            checked={field.value}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
      <Controller
        control={control}
        name="instrument_count_correct_after"
        render={({ field }) => (
          <Checkbox
            label="Instruments correct (after)"
            checked={field.value}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
      <Controller
        control={control}
        name="sponge_count_correct"
        render={({ field }) => (
          <Checkbox
            label="Sponges correct"
            checked={field.value}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
      {(!instrumentCountBefore || !instrumentCountAfter || !spongeCountCorrect) && (
        <Text size="xs" c="danger" fw={600}>
          WARNING: Unchecked counts require verification before closure.
        </Text>
      )}
      {(!instrumentCountAfter || !spongeCountCorrect) && (
        <Controller
          control={control}
          name="count_discrepancy_action"
          render={({ field }) => (
            <Textarea
              label="Count discrepancy — action taken"
              description="Required to close a case with an unconfirmed final count: recount, intra-operative X-ray, item retrieved / left with surgeon sign-off."
              placeholder="e.g. Recount performed; intra-operative X-ray clear; surgeon informed."
              {...field}
            />
          )}
        />
      )}

      <Controller
        control={control}
        name="specimens"
        render={({ field }) => (
          <Textarea label="Specimens" placeholder="List specimens collected" {...field} />
        )}
      />
      <Controller
        control={control}
        name="implants"
        render={({ field }) => (
          <Textarea label="Implants" placeholder="List implants used" {...field} />
        )}
      />
      <Controller
        control={control}
        name="drains"
        render={({ field }) => (
          <Textarea label="Drains" placeholder="List drains placed" {...field} />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <Textarea label="Notes" {...field} />}
      />

      <Button tone="primary" type="submit" loading={createMutation.isPending}>
        Save Case Record
      </Button>
    </Stack>
  );
}

// ── Anesthesia Sub-Tab ────────────────────────────────
