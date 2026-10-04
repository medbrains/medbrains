import { nullOn404 } from "@medbrains/api";
// OPD ConsultationTab — split from opd.tsx (pure move).

import { Select, Stack, Text } from "@mantine/core";
import type {
  Consultation,
  ConsultationTemplate,
  PatientConsultationHistoryRow,
  UpdateConsultationRequest,
} from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SOAPNotes, useClinicalEmit } from "@/components";
import { opdService } from "@/services/opd.service";
import { toCreateConsultationPayload } from "./consultation-utils";

export function ConsultationTab({
  encounterId,
  patientId,
  canUpdate,
}: {
  encounterId: string;
  patientId: string;
  canUpdate: boolean;
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [templateId, setTemplateId] = useState<string | null>(null);

  const { data: consultation } = useQuery<Consultation | null>({
    queryKey: ["consultation", encounterId],
    queryFn: () => opdService.getConsultation(encounterId).catch(nullOn404),
  });

  const { data: templates = [] } = useQuery<ConsultationTemplate[]>({
    queryKey: ["consultation-templates"],
    queryFn: () => opdService.listConsultationTemplates(),
    staleTime: 300_000,
  });

  const { data: consultationHistory = [], isLoading: loadingConsultationHistory } = useQuery<
    PatientConsultationHistoryRow[]
  >({
    queryKey: ["patient-consultations", patientId],
    queryFn: () => opdService.listPatientConsultations(patientId),
    enabled: patientId.length > 0,
    staleTime: 60_000,
  });

  const templateOptions = templates.map((t) => ({
    value: t.id,
    label: `${t.name}${t.specialty ? ` (${t.specialty})` : ""}`,
  }));

  const selectedTemplate = useMemo(() => {
    if (!templateId) return null;
    return templates.find((t) => t.id === templateId) ?? null;
  }, [templates, templateId]);

  const templateDefaults = useMemo((): Partial<Consultation> | undefined => {
    if (!selectedTemplate || consultation) return undefined;
    return {
      chief_complaint: selectedTemplate.chief_complaints.join(", ") || null,
      plan: selectedTemplate.default_plan ?? null,
    };
  }, [selectedTemplate, consultation]);

  // One consultation per encounter: the first save creates it, every later
  // save updates it — a second row would hide the History, ROS and exam the
  // other tabs wrote to the first.
  const saveMutation = useMutation({
    mutationFn: (data: UpdateConsultationRequest) =>
      consultation
        ? opdService.updateConsultation(encounterId, consultation.id, data)
        : opdService.createConsultation(encounterId, toCreateConsultationPayload(data)),
    onSuccess: (consultation) => {
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] });
      void queryClient.invalidateQueries({ queryKey: ["patient-consultations", patientId] });
      emit("opd.consultation.saved", {
        consultation_id: consultation.id,
        encounter_id: consultation.encounter_id,
        patient_id: patientId,
        source_record_id: consultation.id,
      });
    },
  });

  const handleSubmit = (data: UpdateConsultationRequest) => {
    saveMutation.mutate(data);
  };

  if (!canUpdate && !consultation) {
    return (
      <Text c="dimmed" size="sm">
        No consultation recorded yet.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {!consultation && canUpdate && templateOptions.length > 0 && (
        <Select
          label="Load from template"
          placeholder="Select a consultation template..."
          data={templateOptions}
          value={templateId}
          onChange={setTemplateId}
          clearable
          searchable
          size="xs"
          maw={400}
        />
      )}
      <SOAPNotes
        key={consultation?.updated_at ?? templateId ?? "default"}
        onSubmit={handleSubmit}
        defaultValues={consultation ?? templateDefaults}
        editorDefaultValues={consultation ?? templateDefaults}
        historyNotes={consultationHistory}
        isHistoryLoading={loadingConsultationHistory}
        submitLabel="Save Note"
        isSubmitting={saveMutation.isPending}
        readOnly={!canUpdate}
      />
    </Stack>
  );
}

// ── Diagnoses ────────────────────────────────────────────
