// Emergency EmergencyVisitForm — split from emergency.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Card, Group, Select, SimpleGrid, Stack, Textarea, TextInput } from "@mantine/core";
import type { ErVisitFormInput } from "@medbrains/schemas";
import { erVisitFormSchema } from "@medbrains/schemas";
import type { CreateErVisitRequest, ErVisit } from "@medbrains/types";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useClinicalEmit } from "@/components/ClinicalEventProvider";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Button, toast } from "@/components/ui";
import { emergencyArrivalModeOptions, emergencyOptionalText } from "@/forms/emergency.form";
import { emergencyService } from "@/services/emergency.service";

const emptyErVisitForm: ErVisitFormInput = {
  patient_id: "",
  arrival_mode: "",
  chief_complaint: "",
  bay_number: "",
  is_mlc: false,
  notes: "",
};

export function EmergencyVisitForm({
  initialPatientId,
  canCreateMlc,
  canViewPatientRecord,
  onCancel,
  onSuccess,
}: {
  initialPatientId: string;
  canCreateMlc: boolean;
  canViewPatientRecord: boolean;
  onCancel: () => void;
  onSuccess: (visit: ErVisit) => void;
}) {
  const { t } = useTranslation("emergency");
  const qc = useQueryClient();
  const emit = useClinicalEmit();
  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ErVisitFormInput>({
    resolver: zodResolver(erVisitFormSchema),
    defaultValues: { ...emptyErVisitForm, patient_id: initialPatientId },
  });
  const selectedPatientId = watch("patient_id");
  const mutation = useMutation({
    mutationFn: (d: CreateErVisitRequest) => emergencyService.createErVisit(d),
    onSuccess: (visit) => {
      void qc.invalidateQueries({ queryKey: ["er-visits"] });
      void qc.invalidateQueries({ queryKey: ["er-visit", visit.id] });
      emit("emergency.visit.created", {
        source_record_id: visit.id,
        patient_id: visit.patient_id,
        visit_id: visit.id,
        visit_number: visit.visit_number,
        arrival_mode: visit.arrival_mode,
        arrival_time: visit.arrival_time,
        bay_number: visit.bay_number,
        chief_complaint: visit.chief_complaint,
        is_mlc: visit.is_mlc,
        is_brought_dead: visit.is_brought_dead,
        mass_casualty_event_id: visit.mass_casualty_event_id,
        status: visit.status,
        triage_level: visit.triage_level,
      });
      reset({ ...emptyErVisitForm, patient_id: initialPatientId });
      toast.success(t("notify.erVisitReadyForTriage"), { title: t("notify.erVisitRegistered") });
      onSuccess(visit);
    },
  });

  const submitErVisit = (values: ErVisitFormInput) => {
    mutation.mutate({
      patient_id: values.patient_id,
      arrival_mode: values.arrival_mode || undefined,
      chief_complaint: emergencyOptionalText(values.chief_complaint),
      is_mlc: canCreateMlc ? values.is_mlc : false,
      bay_number: emergencyOptionalText(values.bay_number),
      notes: emergencyOptionalText(values.notes),
    });
  };

  return (
    <Card withBorder>
      <Stack component="form" onSubmit={handleSubmit(submitErVisit)}>
        <Controller
          name="patient_id"
          control={control}
          render={({ field }) => (
            <PatientSearchSelect
              value={field.value}
              onChange={field.onChange}
              required
              error={errors.patient_id?.message}
            />
          )}
        />
        {canViewPatientRecord && selectedPatientId && (
          <PatientContextBanner patientId={selectedPatientId} hideLoadingState />
        )}
        {!canViewPatientRecord && selectedPatientId && (
          <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
            {t("patient.restrictedIdentity")}
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Controller
            name="arrival_mode"
            control={control}
            render={({ field }) => (
              <Select
                label={t("label.arrivalMode")}
                data={emergencyArrivalModeOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={errors.arrival_mode?.message}
              />
            )}
          />
          <Controller
            name="bay_number"
            control={control}
            render={({ field }) => <TextInput label={t("label.bayNumber")} {...field} />}
          />
        </SimpleGrid>
        <Controller
          name="chief_complaint"
          control={control}
          render={({ field }) => <TextInput label={t("label.chiefComplaint")} {...field} />}
        />
        {canCreateMlc ? (
          <Controller
            name="is_mlc"
            control={control}
            render={({ field }) => (
              <Select
                label={t("label.medicoLegalCase")}
                data={[
                  { value: "true", label: t("label.yes") },
                  { value: "false", label: t("label.no") },
                ]}
                value={field.value ? "true" : "false"}
                onChange={(value) => field.onChange(value === "true")}
              />
            )}
          />
        ) : (
          <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
            {t("mlc.permissionRequired")}
          </Alert>
        )}
        <Controller
          name="notes"
          control={control}
          render={({ field }) => <Textarea label={t("label.notes")} {...field} />}
        />
        <Group justify="flex-end">
          <Button tone="secondary" onClick={onCancel}>
            {t("label.cancel")}
          </Button>
          <Button tone="primary" type="submit" loading={mutation.isPending}>
            {t("register")}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
