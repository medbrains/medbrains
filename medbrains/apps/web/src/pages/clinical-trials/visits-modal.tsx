// IPD VisitsModal — split from clinical-trials.tsx (pure move).

import { Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type { ClinicalTrial } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import type { BadgeTone } from "@/components/ui";
import { Badge, Button, toast } from "@/components/ui";
import { clinicalTrialsService } from "@/services/clinicalTrials.service";

export function VisitsModal({ trial, onClose }: { trial: ClinicalTrial; onClose: () => void }) {
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [visitName, setVisitName] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [procedures, setProcedures] = useState("");

  const { data: visits = [] } = useQuery({
    queryKey: ["trial-visits", trial.id],
    queryFn: () => clinicalTrialsService.listTrialVisits(trial.id),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["trial-visits", trial.id] });
  };
  const schedule = useMutation({
    mutationFn: () =>
      clinicalTrialsService.scheduleTrialVisit(trial.id, {
        patient_id: patientId,
        visit_name: visitName,
        scheduled_date: date ?? "",
        procedures: procedures || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Visit scheduled", { title: "Clinical trials" });
      setVisitName("");
      setProcedures("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Schedule failed" }),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      clinicalTrialsService.updateTrialVisit(v.id, { status: v.status }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Update failed" }),
  });

  const visitTone = (s: string): BadgeTone => {
    if (s === "completed") return "success";
    if (s === "missed") return "danger";
    if (s === "rescheduled") return "warning";
    return "neutral";
  };

  return (
    <Modal opened onClose={onClose} title={`Visit schedule — ${trial.protocol_number}`} size="lg">
      <Stack gap="sm">
        <PatientSearchSelect value={patientId} onChange={setPatientId} />
        <Group grow>
          <TextInput
            label="Visit name"
            value={visitName}
            onChange={(e) => setVisitName(e.currentTarget.value)}
            placeholder="Screening / Day 0 / Day 28"
          />
          <DateInput label="Scheduled date" value={date} onChange={setDate} />
        </Group>
        <TextInput
          label="Procedures"
          value={procedures}
          onChange={(e) => setProcedures(e.currentTarget.value)}
          placeholder="CBC, ECG, PK sampling"
        />
        <Button
          onClick={() => schedule.mutate()}
          loading={schedule.isPending}
          disabled={!patientId || !visitName.trim() || !date}
        >
          Schedule visit
        </Button>
        <Text fw={600} size="sm">
          Scheduled visits ({visits.length})
        </Text>
        {visits.length === 0 ? (
          <Text size="sm" c="dimmed">
            No visits scheduled.
          </Text>
        ) : (
          visits.map((v) => (
            <Group key={v.id} justify="space-between">
              <Stack gap={0}>
                <Group gap={6}>
                  <Badge tone={visitTone(v.status)} size="xs">
                    {v.status}
                  </Badge>
                  <Text size="sm">
                    {v.visit_name} · {v.first_name} {v.last_name}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {new Date(v.scheduled_date).toLocaleDateString()}
                  {v.procedures ? ` · ${v.procedures}` : ""}
                </Text>
              </Stack>
              {v.status === "scheduled" && (
                <Group gap="xs">
                  <Button
                    size="xs"
                    tone="primary"
                    onClick={() => update.mutate({ id: v.id, status: "completed" })}
                  >
                    Complete
                  </Button>
                  <Button
                    size="xs"
                    tone="danger"
                    onClick={() => update.mutate({ id: v.id, status: "missed" })}
                  >
                    Missed
                  </Button>
                </Group>
              )}
            </Group>
          ))
        )}
      </Stack>
    </Modal>
  );
}
