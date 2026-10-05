// OPD ConsultationTab — the visit's case sheet (RFCs/RFC-MODULE-clinical-notes.md).

import { Select, Stack } from "@mantine/core";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import {
  type ConsultationTemplate,
  type Note,
  P,
  type PatientConsultationHistoryRow,
} from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useClinicalEmit } from "@/components";
import { CaseSheet } from "@/components/Clinical/case-sheet/CaseSheet";
import { SoapTimeline } from "@/components/Clinical/SoapTimeline";
import { toast } from "@/components/ui";
import { clinicalNotesService } from "@/services/clinicalNotes.service";
import { opdService } from "@/services/opd.service";

export function ConsultationTab({
  encounterId,
  patientId,
}: {
  encounterId: string;
  patientId: string;
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const canWrite = useHasPermission(P.CLINICAL_NOTES.WRITE);
  const [templateId, setTemplateId] = useState<string | null>(null);
  // Earlier visits' notes keep the masking the SOAP field always had.
  const soapAccess = useFieldAccess("opd.soap_note");

  const { data: notes = [] } = useQuery({
    queryKey: ["clinical-notes", encounterId],
    queryFn: () => clinicalNotesService.listEncounterNotes(encounterId),
  });
  const { data: templates = [] } = useQuery<ConsultationTemplate[]>({
    queryKey: ["consultation-templates"],
    queryFn: () => opdService.listConsultationTemplates(),
    staleTime: 300_000,
    enabled: canWrite,
  });
  const { data: history = [], isLoading: loadingHistory } = useQuery<
    PatientConsultationHistoryRow[]
  >({
    queryKey: ["patient-consultations", patientId],
    queryFn: () => opdService.listPatientConsultations(patientId),
    enabled: patientId.length > 0,
    staleTime: 60_000,
  });

  // A template starts the doctor's Consultation note with its complaints and plan.
  const fromTemplate = useMutation({
    mutationFn: (template: ConsultationTemplate) =>
      clinicalNotesService.createNote(encounterId, {
        note_type_code: "consultation",
        sections: [
          { code: "subjective", title: "Subjective", text: template.chief_complaints.join(", ") },
          { code: "plan", title: "Plan", text: template.default_plan ?? "" },
        ],
      }),
    onSuccess: (note: Note) => {
      setTemplateId(null);
      void queryClient.invalidateQueries({ queryKey: ["clinical-notes", encounterId] });
      emit("opd.consultation.saved", {
        consultation_id: note.id,
        encounter_id: encounterId,
        patient_id: patientId,
        source_record_id: note.id,
      });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Template not applied" }),
  });

  const hasMyConsultation = notes.some(
    (n) => n.is_mine && n.note_type_code === "consultation" && n.status !== "entered_in_error",
  );

  return (
    <Stack gap="md">
      {canWrite && !hasMyConsultation && templates.length > 0 && (
        <Select
          label="Start a consultation note from a template"
          placeholder="Select a consultation template..."
          data={templates.map((t) => ({
            value: t.id,
            label: `${t.name}${t.specialty ? ` (${t.specialty})` : ""}`,
          }))}
          value={templateId}
          onChange={(id) => {
            const template = templates.find((t) => t.id === id);
            if (template) fromTemplate.mutate(template);
          }}
          searchable
          size="xs"
          maw={400}
        />
      )}
      <CaseSheet encounterId={encounterId} />
      {soapAccess !== "hidden" && (
        <SoapTimeline
          historyNotes={history}
          isLoading={loadingHistory}
          soapText={(value) => fieldAccessText(soapAccess, value)}
        />
      )}
    </Stack>
  );
}
