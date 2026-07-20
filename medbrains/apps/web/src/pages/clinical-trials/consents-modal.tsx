// IPD ConsentsModal — split from clinical-trials.tsx (pure move).

import { Group, Modal, Select, Stack, Text } from "@mantine/core";
import type { ClinicalTrial } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, toast } from "@/components/ui";
import { clinicalTrialsService } from "@/services/clinicalTrials.service";

export function ConsentsModal({ trial, onClose }: { trial: ClinicalTrial; onClose: () => void }) {
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);

  const { data: consents = [] } = useQuery({
    queryKey: ["trial-consents", trial.id],
    queryFn: () => clinicalTrialsService.listTrialConsents(trial.id),
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["consent-templates-active"],
    queryFn: () => clinicalTrialsService.listConsentTemplates({ is_active: true }),
  });
  const record = useMutation({
    mutationFn: () =>
      clinicalTrialsService.recordTrialConsent(trial.id, {
        patient_id: patientId,
        template_id: templateId ?? undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["trial-consents", trial.id] });
      toast.success("Consent recorded", { title: "Clinical trials" });
      setPatientId("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Record failed" }),
  });

  return (
    <Modal opened onClose={onClose} title={`Informed consent — ${trial.protocol_number}`} size="lg">
      <Stack gap="sm">
        <PatientSearchSelect value={patientId} onChange={setPatientId} />
        <Select
          label="Consent form (versioned)"
          data={templates.map((t) => ({ value: t.id, label: `${t.name} · v${t.version}` }))}
          value={templateId}
          onChange={setTemplateId}
          clearable
          searchable
        />
        <Button onClick={() => record.mutate()} loading={record.isPending} disabled={!patientId}>
          Record signed consent
        </Button>
        <Text fw={600} size="sm">
          Recorded consents ({consents.length})
        </Text>
        {consents.length === 0 ? (
          <Text size="sm" c="dimmed">
            No consents recorded for this trial.
          </Text>
        ) : (
          consents.map((c) => (
            <Group key={c.id} gap="xs">
              <Text size="sm">
                {c.first_name} {c.last_name}
              </Text>
              <Badge tone={c.is_revoked ? "danger" : "success"} size="xs">
                {c.is_revoked ? "revoked" : "signed"}
              </Badge>
              {c.template_name && (
                <Badge tone="neutral" size="xs">
                  {c.template_name} v{c.template_version}
                </Badge>
              )}
              <Text size="xs" c="dimmed">
                {c.patient_signed_at ? new Date(c.patient_signed_at).toLocaleDateString() : ""}
              </Text>
            </Group>
          ))
        )}
      </Stack>
    </Modal>
  );
}
