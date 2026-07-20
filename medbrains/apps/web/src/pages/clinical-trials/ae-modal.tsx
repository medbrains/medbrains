// Clinical-trials AeModal — split from clinical-trials.tsx (pure move).

import { Group, Modal, Select, Stack, Switch, Text, TextInput } from "@mantine/core";
import type { ClinicalTrial } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { clinicalTrialsService } from "@/services/clinicalTrials.service";

const AE_OUTCOMES = ["recovered", "recovering", "ongoing", "fatal", "unknown"];
const AE_RELATEDNESS = ["unassessed", "unrelated", "possible", "probable", "definite"];

export function AeModal({ trial, onClose }: { trial: ClinicalTrial; onClose: () => void }) {
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [term, setTerm] = useState("");
  const [severity, setSeverity] = useState<string | null>("mild");
  const [serious, setSerious] = useState(false);
  const [relatedness, setRelatedness] = useState<string | null>("unassessed");
  const [outcome, setOutcome] = useState<string | null>("ongoing");
  const [desc, setDesc] = useState("");

  const { data: events = [] } = useQuery({
    queryKey: ["trial-aes", trial.id],
    queryFn: () => clinicalTrialsService.listAdverseEvents(trial.id),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["trial-aes", trial.id] });
  };
  const report = useMutation({
    mutationFn: () =>
      clinicalTrialsService.reportAdverseEvent(trial.id, {
        patient_id: patientId,
        event_term: term,
        severity: severity ?? undefined,
        is_serious: serious,
        relatedness: relatedness ?? undefined,
        outcome: outcome ?? undefined,
        description: desc || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Adverse event reported", { title: "Clinical trials" });
      setTerm("");
      setDesc("");
      setSerious(false);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Report failed" }),
  });
  const setOutcomeM = useMutation({
    mutationFn: (v: { id: string; outcome: string }) =>
      clinicalTrialsService.updateAdverseEvent(v.id, { outcome: v.outcome }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Update failed" }),
  });

  const sevTone = (s: string): BadgeTone =>
    s === "severe" ? "danger" : s === "moderate" ? "warning" : "neutral";

  return (
    <Modal opened onClose={onClose} title={`Adverse events — ${trial.protocol_number}`} size="lg">
      <Stack gap="sm">
        <PatientSearchSelect value={patientId} onChange={setPatientId} />
        <Group grow>
          <TextInput
            label="Event term"
            value={term}
            onChange={(e) => setTerm(e.currentTarget.value)}
            placeholder="Nausea"
          />
          <Select
            label="Severity"
            data={["mild", "moderate", "severe"].map((v) => ({ value: v, label: v }))}
            value={severity}
            onChange={setSeverity}
          />
        </Group>
        <Group grow>
          <Select
            label="Relatedness"
            data={AE_RELATEDNESS.map((v) => ({ value: v, label: v }))}
            value={relatedness}
            onChange={setRelatedness}
          />
          <Select
            label="Outcome"
            data={AE_OUTCOMES.map((v) => ({ value: v, label: v }))}
            value={outcome}
            onChange={setOutcome}
          />
        </Group>
        <TextInput
          label="Description"
          value={desc}
          onChange={(e) => setDesc(e.currentTarget.value)}
        />
        <Switch
          label="Serious (SAE)"
          checked={serious}
          onChange={(e) => setSerious(e.currentTarget.checked)}
        />
        <Button
          onClick={() => report.mutate()}
          loading={report.isPending}
          disabled={!patientId || !term.trim()}
        >
          Report event
        </Button>
        <Text fw={600} size="sm">
          Reported events ({events.length})
        </Text>
        {events.length === 0 ? (
          <Text size="sm" c="dimmed">
            No adverse events reported.
          </Text>
        ) : (
          events.map((ev) => (
            <Group key={ev.id} justify="space-between">
              <Stack gap={0}>
                <Group gap={6}>
                  {ev.is_serious && (
                    <Badge tone="danger" size="xs">
                      SAE
                    </Badge>
                  )}
                  <Badge tone={sevTone(ev.severity)} size="xs">
                    {ev.severity}
                  </Badge>
                  <Text size="sm">
                    {ev.event_term} · {ev.first_name} {ev.last_name}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {ev.relatedness} · {new Date(ev.reported_date).toLocaleDateString()}
                </Text>
              </Stack>
              <Select
                size="xs"
                w={130}
                data={AE_OUTCOMES.map((v) => ({ value: v, label: v }))}
                value={ev.outcome}
                onChange={(v) => v && setOutcomeM.mutate({ id: ev.id, outcome: v })}
                aria-label="Outcome"
              />
            </Group>
          ))
        )}
      </Stack>
    </Modal>
  );
}
