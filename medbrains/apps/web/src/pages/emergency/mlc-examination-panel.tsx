/**
 * The examination and incident of a medico-legal case — what the MLC
 * register and the wound certificate print. Once the opinion is given, the
 * case is in court or closed, the record is legal evidence: it is amended
 * only by a holder of the amend permission, with a reason, and audited.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { SimpleGrid, Stack, Text } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type { MlcCase } from "@medbrains/types";
import { P } from "@medbrains/types";
import { applyServerErrors } from "@medbrains/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { Alert, Button, Card, Input, TextArea, toast } from "@/components/ui";
import { emergencyService } from "@/services/emergency.service";
import {
  isCertifiedMlc,
  type MlcRecordFormInput,
  type MlcRecordGroup,
  mlcRecordFormSchema,
  mlcRecordFormValues,
  mlcRecordGroupOf,
  mlcRecordPayload,
  validateMlcRecord,
} from "./mlc-record-form";
import { canEditSensitiveField, canViewSensitiveField } from "./shared";

interface MlcExaminationPanelProps {
  mlcCase: MlcCase;
}

const TEXT_INPUTS: ReadonlyArray<{ name: keyof MlcRecordFormInput; label: string }> = [
  { name: "place_of_incident", label: "Place of incident" },
  { name: "weapon_used", label: "Weapon / object used (alleged)" },
  { name: "police_officer_name", label: "Police officer who brought / requisitioned" },
  { name: "police_officer_rank", label: "Officer's rank" },
  { name: "police_dd_number", label: "Police DD / GD number" },
  { name: "samples_handed_to", label: "Samples handed over to" },
];

const TEXT_AREAS: ReadonlyArray<{ name: keyof MlcRecordFormInput; label: string }> = [
  { name: "condition_on_arrival", label: "Condition on arrival" },
  { name: "treatment_given", label: "Treatment given" },
  { name: "patient_condition_at_discharge", label: "Condition at discharge / transfer" },
];

export function MlcExaminationPanel({ mlcCase }: MlcExaminationPanelProps) {
  const canUpdate = useHasPermission(P.EMERGENCY.MLC_UPDATE);
  const canAmend = useHasPermission(P.EMERGENCY.MLC_AMEND);
  const certified = isCertifiedMlc(mlcCase.status);
  const canEdit = canUpdate && (!certified || canAmend);
  const access: Record<MlcRecordGroup, ReturnType<typeof useFieldAccess>> = {
    "emergency.mlc.police_officer": useFieldAccess("emergency.mlc.police_officer"),
    "emergency.mlc.incident_details": useFieldAccess("emergency.mlc.incident_details"),
    "emergency.mlc.clinical_course": useFieldAccess("emergency.mlc.clinical_course"),
  };
  const groupEditable = (group: MlcRecordGroup) => canEditSensitiveField(access[group]);
  const groupOf = (name: keyof MlcRecordFormInput) => mlcRecordGroupOf(name);
  const isVisible = (name: keyof MlcRecordFormInput) => {
    const group = groupOf(name);
    return !group || canViewSensitiveField(access[group]);
  };
  const isLocked = (name: keyof MlcRecordFormInput) => {
    const group = groupOf(name);
    return !canEdit || (group !== null && !groupEditable(group));
  };
  const queryClient = useQueryClient();
  const { control, handleSubmit, reset, setError, formState } = useForm<MlcRecordFormInput>({
    resolver: zodResolver(mlcRecordFormSchema),
    defaultValues: mlcRecordFormValues(mlcCase),
  });
  const save = useMutation({
    mutationFn: (values: MlcRecordFormInput) =>
      emergencyService.updateMlcCase(
        mlcCase.id,
        mlcRecordPayload(values, { certified, editable: groupEditable }),
      ),
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: ["mlc-cases"] });
      reset(mlcRecordFormValues(row));
      toast.success("The examination record is saved.", {
        title: certified ? "MLC amended" : "MLC record saved",
      });
    },
    onError: (e: Error) => {
      if (!applyServerErrors(e, setError)) {
        toast.error(e.message, { title: "Could not save the MLC record" });
      }
    },
  });
  const submit = handleSubmit((values) => {
    const errors = validateMlcRecord(values, { registeredAt: mlcCase.registered_at, certified });
    const entries = Object.entries(errors) as Array<[keyof MlcRecordFormInput, string]>;
    for (const [name, message] of entries) setError(name, { type: "rule", message });
    if (entries.length === 0) save.mutate(values);
  });
  const fieldError = (name: keyof MlcRecordFormInput) => formState.errors[name]?.message;

  return (
    <Card withBorder padding="md">
      <Stack component="form" gap="sm" onSubmit={submit} aria-label="MLC examination record">
        <Text fw={700}>Examination and incident</Text>
        {certified && (
          <Alert tone={canAmend ? "warning" : "info"} title="Certified record">
            {canAmend
              ? "This MLC is certified and is legal evidence. A change is an amendment: give the reason; the before and after are kept in the audit trail."
              : "This MLC is certified and is legal evidence. Only a doctor with amendment rights can change it."}
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Controller
            control={control}
            name="examining_doctor_id"
            render={({ field }) => (
              <DoctorSearchSelect
                label="Examining doctor"
                value={field.value}
                onChange={field.onChange}
                disabled={!canEdit}
                error={fieldError("examining_doctor_id")}
              />
            )}
          />
          <Controller
            control={control}
            name="examined_at"
            render={({ field }) => (
              <DateTimePicker
                label="Examined at"
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? "")}
                maxDate={new Date()}
                disabled={!canEdit}
                clearable
                error={fieldError("examined_at")}
              />
            )}
          />
          {isVisible("date_time_of_incident") && (
            <Controller
              control={control}
              name="date_time_of_incident"
              render={({ field }) => (
                <DateTimePicker
                  label="Date and time of incident (alleged)"
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? "")}
                  maxDate={new Date(mlcCase.registered_at)}
                  disabled={isLocked("date_time_of_incident")}
                  clearable
                  error={fieldError("date_time_of_incident")}
                />
              )}
            />
          )}
          {TEXT_INPUTS.filter(({ name }) => isVisible(name)).map(({ name, label }) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field }) => (
                <Input
                  label={label}
                  {...field}
                  disabled={isLocked(name)}
                  error={fieldError(name)}
                />
              )}
            />
          ))}
        </SimpleGrid>
        {TEXT_AREAS.filter(({ name }) => isVisible(name)).map(({ name, label }) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field }) => (
              <TextArea
                label={label}
                autosize
                minRows={2}
                {...field}
                disabled={isLocked(name)}
                error={fieldError(name)}
              />
            )}
          />
        ))}
        {certified && canEdit && (
          <Controller
            control={control}
            name="amendment_reason"
            render={({ field }) => (
              <TextArea
                label="Reason for amendment"
                description="Kept with the change in the audit trail."
                required
                autosize
                minRows={2}
                {...field}
                error={fieldError("amendment_reason")}
              />
            )}
          />
        )}
        {canEdit && (
          <Button type="submit" tone="primary" loading={save.isPending}>
            {certified ? "Amend MLC record" : "Save MLC record"}
          </Button>
        )}
      </Stack>
    </Card>
  );
}
