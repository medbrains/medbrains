import { ApiError, nullOn404 } from "@medbrains/api";
// OPD ConsultationTab — the visit's SOAP note.

import { Loader, Select, Stack } from "@mantine/core";
import type {
  Consultation,
  ConsultationTemplate,
  PatientConsultationHistoryRow,
} from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { SOAPNotes, soapValuesFrom, useClinicalEmit } from "@/components";
import type { SoapNoteValues } from "@/components/Clinical/SoapNoteEditor";
import { opdService } from "@/services/opd.service";

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

  const { data: consultation, isPending } = useQuery<Consultation | null>({
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

  const initialValues = useMemo((): SoapNoteValues => {
    const template = templates.find((t) => t.id === templateId);
    if (consultation || !template) return soapValuesFrom(consultation);
    return soapValuesFrom({
      chief_complaint: template.chief_complaints.join(", ") || null,
      plan: template.default_plan ?? null,
    });
  }, [templates, templateId, consultation]);

  // One note per visit: the first save creates it, every later save updates
  // it. Saves run one after another, so a save that starts while the first is
  // still creating the note updates that note instead of starting a second.
  const savedId = useRef<string | undefined>(undefined);
  savedId.current ??= consultation?.id;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const saveMutation = useMutation({
    mutationFn: async (values: SoapNoteValues) => {
      const id = savedId.current;
      if (id) return opdService.updateConsultation(encounterId, id, values);
      try {
        return await opdService.createConsultation(encounterId, values);
      } catch (error) {
        // Another screen created the note first (409): write into that one.
        if (!(error instanceof ApiError && error.status === 409)) throw error;
        const existing = await opdService.getConsultation(encounterId);
        return opdService.updateConsultation(encounterId, existing.id, values);
      }
    },
    onSuccess: (saved) => {
      const isFirstSave = savedId.current === undefined;
      savedId.current = saved.id;
      queryClient.setQueryData(["consultation", encounterId], saved);
      if (!isFirstSave) return;
      void queryClient.invalidateQueries({ queryKey: ["patient-consultations", patientId] });
      emit("opd.consultation.saved", {
        consultation_id: saved.id,
        encounter_id: saved.encounter_id,
        patient_id: patientId,
        source_record_id: saved.id,
      });
    },
  });

  const saveNote = (values: SoapNoteValues): Promise<void> => {
    const run = queue.current.then(() => saveMutation.mutateAsync(values));
    queue.current = run.catch(() => undefined);
    return run.then(() => undefined);
  };

  // The editor keeps its own text from the values it first gets: it waits
  // for the note, or it would open empty over a saved one.
  if (isPending) return <Loader size="sm" />;

  return (
    <Stack gap="sm">
      {!consultation && canUpdate && templateOptions.length > 0 && (
        <Select
          label="Start from a template"
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
        key={templateId ?? "note"}
        consultation={consultation}
        initialValues={initialValues}
        onSave={canUpdate ? saveNote : undefined}
        historyNotes={consultationHistory}
        isHistoryLoading={loadingConsultationHistory}
      />
    </Stack>
  );
}
