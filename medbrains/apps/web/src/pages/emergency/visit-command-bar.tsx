// Emergency EmergencyVisitCommandBar — split from emergency.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Card, Group, Stack, Text, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { ErAdmitFormInput } from "@medbrains/schemas";
import { erAdmitFormSchema } from "@medbrains/schemas";
import type {
  AdmitFromErRequest,
  ClinicalEventName,
  ClinicalJourneyContext,
  ErVisit,
} from "@medbrains/types";
import { IconAlertTriangle, IconBuildingHospital } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormModal } from "@/components";
import { BedSelect } from "@/components/BedSelect";
import { useClinicalEmit } from "@/components/ClinicalEventProvider";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import { Alert, Button, toast } from "@/components/ui";
import { emergencyOptionalText } from "@/forms/emergency.form";
import { emergencyService } from "@/services/emergency.service";
import classes from "../emergency.module.scss";
import { EmergencyVisitSignals } from "./shared";

const emptyErAdmitForm: ErAdmitFormInput = {
  bed_id: "",
  admitting_doctor_id: "",
  admission_notes: "",
};

function deriveEmergencyJourneyCompletedEvents(visit: ErVisit): readonly ClinicalEventName[] {
  const events: ClinicalEventName[] = [];
  if (visit.admission_id) {
    events.push("ipd.admission.created");
    events.push("bed.assigned");
  }
  if (visit.is_mlc) {
    events.push("mlc.created");
  }
  return events;
}

// ── Triage helpers ────────────────────────────────────

// ── Timer Hook ─────────────────────────────────────────

export function EmergencyVisitCommandBar({
  visit,
  canAdmit,
  canViewPatientRecord,
}: {
  visit: ErVisit;
  canAdmit: boolean;
  canViewPatientRecord: boolean;
}) {
  const { t } = useTranslation("emergency");
  const qc = useQueryClient();
  const emit = useClinicalEmit();
  const [admitOpen, admitHandlers] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ErAdmitFormInput>({
    resolver: zodResolver(erAdmitFormSchema),
    defaultValues: emptyErAdmitForm,
  });
  const canShowAdmit =
    canAdmit && ["registered", "triaged", "in_treatment", "observation"].includes(visit.status);
  const completedEvents = deriveEmergencyJourneyCompletedEvents(visit);
  const journeyContext: ClinicalJourneyContext = {
    patientId: visit.patient_id,
    isDeceased: visit.is_brought_dead,
    activeEmergencyVisitId: visit.id,
    activeAdmissionId: visit.admission_id,
    activeAdmissionStatus: visit.admission_id ? "admitted" : null,
    completedEvents,
  };
  const admitMutation = useMutation({
    mutationFn: (data: AdmitFromErRequest) => emergencyService.admitFromEr(visit.id, data),
    onSuccess: (result, request) => {
      emit("ipd.admission.created", {
        admission_id: result.admission_id,
        bed_id: result.bed_id,
        encounter_id: result.encounter_id,
        er_visit_id: result.er_visit_id,
        patient_id: result.patient_id,
        reason: request.admission_notes ?? visit.chief_complaint ?? "ER admission",
        source_record_id: result.admission_id,
        status: result.status,
        ward_id: result.ward_id,
      });
      emit("bed.assigned", {
        admission_id: result.admission_id,
        bed_id: result.bed_id,
        encounter_id: result.encounter_id,
        er_visit_id: result.er_visit_id,
        patient_id: result.patient_id,
        reason: request.admission_notes ?? visit.chief_complaint ?? "ER admission",
        source_record_id: result.admission_id,
        status: result.status,
        ward_id: result.ward_id,
      });
      void qc.invalidateQueries({ queryKey: ["er-visits"] });
      void qc.invalidateQueries({ queryKey: ["er-visit", visit.id] });
      void qc.invalidateQueries({ queryKey: ["admissions"] });
      void qc.invalidateQueries({ queryKey: ["admission-detail", result.admission_id] });
      void qc.invalidateQueries({ queryKey: ["ipd-bed-dashboard-summary"] });
      void qc.invalidateQueries({ queryKey: ["ipd-bed-dashboard-beds"] });
      toast.success(t("notify.erVisitLinkedToIpd"), { title: t("notify.patientAdmitted") });
      reset(emptyErAdmitForm);
      admitHandlers.close();
    },
  });

  const submitAdmit = (values: ErAdmitFormInput) => {
    if (!canShowAdmit) return;
    admitMutation.mutate({
      bed_id: values.bed_id,
      admitting_doctor_id: values.admitting_doctor_id,
      admission_notes: emergencyOptionalText(values.admission_notes),
    });
  };

  return (
    <Card withBorder className={classes.commandBar}>
      <Stack>
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs">
            {canViewPatientRecord ? (
              <PatientContextBanner patientId={visit.patient_id} hideLoadingState />
            ) : (
              <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
                {t("patient.restrictedIdentity")}
              </Alert>
            )}
            <PatientFlowNavigator
              patientId={visit.patient_id}
              active="emergency"
              activeEmergencyVisitId={visit.id}
              activeAdmissionId={visit.admission_id}
              completedEvents={completedEvents}
              compact
            />
            <PatientJourneyActions
              context={journeyContext}
              hiddenActionIds={[
                "emergency.open_visit",
                visit.admission_id ? "ipd.admit" : "ipd.open_admission",
              ]}
              size="xs"
            />
            <Group gap="xs">
              <Text fw={700}>{t("visit.number", { number: visit.visit_number })}</Text>
              <EmergencyVisitSignals visit={visit} />
            </Group>
          </Stack>
          {canShowAdmit && (
            <Button
              tone="primary"
              leftSection={<IconBuildingHospital size={14} />}
              onClick={admitHandlers.open}
            >
              {t("label.admitToIpd")}
            </Button>
          )}
        </Group>
      </Stack>
      <FormModal
        opened={admitOpen}
        onClose={() => {
          admitHandlers.close();
          reset(emptyErAdmitForm);
        }}
        title={t("title.admitPatientToIpd")}
        size="md"
        onSubmit={handleSubmit(submitAdmit)}
        submitLabel={t("label.confirmAdmission")}
        submitColor="teal"
        submitIcon={<IconBuildingHospital size={16} />}
        submitting={admitMutation.isPending}
      >
        <Controller
          name="bed_id"
          control={control}
          render={({ field }) => (
            <BedSelect value={field.value} onChange={field.onChange} required />
          )}
        />
        {errors.bed_id?.message && (
          <Text size="xs" c="danger">
            {errors.bed_id.message}
          </Text>
        )}
        <Controller
          name="admitting_doctor_id"
          control={control}
          render={({ field }) => (
            <DoctorSearchSelect
              label={t("label.admittingDoctor")}
              value={field.value}
              onChange={field.onChange}
              required
            />
          )}
        />
        {errors.admitting_doctor_id?.message && (
          <Text size="xs" c="danger">
            {errors.admitting_doctor_id.message}
          </Text>
        )}
        <Controller
          name="admission_notes"
          control={control}
          render={({ field }) => (
            <Textarea
              label={t("label.admissionNotes")}
              {...field}
              placeholder={t("placeholder.reasonForAdmission,ClinicalNotes...")}
              minRows={3}
            />
          )}
        />
      </FormModal>
    </Card>
  );
}
