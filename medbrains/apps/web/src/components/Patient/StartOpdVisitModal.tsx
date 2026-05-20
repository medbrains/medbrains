// In-place OPD visit creator — replaces the previous flow that
// redirected to /opd?action=new&patient_id=X. Operators reported the
// redirect as a context-loss footgun: they were on the patient detail
// drawer mid-review, clicked "New OPD visit", and ended up on the OPD
// queue page with the patient pre-filtered but no longer visible in
// the same drawer. The modal here keeps them in place, creates the
// encounter, and emits an event so the patient-detail view refetches
// the active encounter.

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Group, Modal, Select, Stack, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { StartOpdVisitFormInput } from "@medbrains/schemas";
import { startOpdVisitFormSchema } from "@medbrains/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import {
  DEFAULT_START_OPD_VISIT_FORM_VALUES,
  OPD_VISIT_TYPE_OPTIONS,
  toCreateEncounterRequestForPatient,
} from "../../forms/opd.form";
import { clinicalActionsService } from "../../services/clinicalActions.service";
import { DepartmentSelect } from "../DepartmentSelect";
import { DoctorSearchSelect } from "../DoctorSearchSelect";

interface StartOpdVisitModalProps {
  patientId: string;
  patientName: string;
  opened: boolean;
  onClose: () => void;
  /** Called with the new encounter id after success — caller can
   * use it to navigate to a tab or refetch, but no redirect happens
   * by default. */
  onCreated?: (encounterId: string) => void;
}

export function StartOpdVisitModal({
  patientId,
  patientName,
  opened,
  onClose,
  onCreated,
}: StartOpdVisitModalProps) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StartOpdVisitFormInput>({
    resolver: zodResolver(startOpdVisitFormSchema),
    defaultValues: DEFAULT_START_OPD_VISIT_FORM_VALUES,
    mode: "onTouched",
  });

  const mutation = useMutation({
    mutationFn: (values: StartOpdVisitFormInput) =>
      clinicalActionsService.createEncounter(toCreateEncounterRequestForPatient(patientId, values)),
    onSuccess: (result) => {
      notifications.show({
        title: "OPD visit started",
        message: `Token T${String(result.queue.token_number).padStart(3, "0")} for ${patientName}`,
        color: "success",
      });
      // Refetch the active encounter banner on patient-detail + the OPD
      // queue cache so any open OPD page picks up the new entry.
      void queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
      void queryClient.invalidateQueries({ queryKey: ["patient-visits", patientId] });
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      onCreated?.(result.encounter.id);
      reset();
      onClose();
    },
    onError: () => {
      notifications.show({
        title: "Failed to start visit",
        message: "Backend rejected the request. Check department + doctor.",
        color: "danger",
      });
    },
  });

  const submit = handleSubmit((values) => {
    mutation.mutate(values);
  });

  return (
    <Modal opened={opened} onClose={onClose} title={`New OPD visit — ${patientName}`} size="md">
      <Stack gap="sm">
        <Alert color="primary" variant="light">
          Creates an encounter + queue token in one shot, then opens the current OPD visit record.
        </Alert>

        <Controller
          control={control}
          name="department_id"
          render={({ field }) => (
            <DepartmentSelect
              label="Department"
              placeholder="Pick OPD department"
              value={field.value ?? ""}
              onChange={(v) => field.onChange(v || null)}
              error={errors.department_id?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="doctor_id"
          render={({ field }) => (
            <DoctorSearchSelect
              label="Doctor (optional — assigned at consultation if blank)"
              value={field.value ?? ""}
              onChange={(v) => field.onChange(v || null)}
            />
          )}
        />
        <Controller
          control={control}
          name="visit_type"
          render={({ field }) => (
            <Select
              label="Visit type"
              data={OPD_VISIT_TYPE_OPTIONS}
              value={field.value}
              onChange={(v) => field.onChange(v ?? "walk_in")}
            />
          )}
        />
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Textarea
              label="Reason / chief complaint"
              autosize
              minRows={2}
              value={field.value}
              onChange={field.onChange}
              placeholder="Headache for 3 days, follow-up of HTN, etc."
            />
          )}
        />

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={mutation.isPending}>
            Start visit
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
