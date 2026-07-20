// Clinical-trials IrbModal — split from clinical-trials.tsx (pure move).

import { Group, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import type { ClinicalTrial } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { clinicalTrialsService } from "@/services/clinicalTrials.service";

const IRB_TYPES = ["initial", "amendment", "renewal", "sae_report", "closure"];
const IRB_STATUS = ["submitted", "under_review", "approved", "rejected", "deferred"];

export function IrbModal({ trial, onClose }: { trial: ClinicalTrial; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<string | null>("initial");
  const [committee, setCommittee] = useState("");
  const [ref, setRef] = useState("");

  const { data: subs = [] } = useQuery({
    queryKey: ["trial-irb", trial.id],
    queryFn: () => clinicalTrialsService.listIrbSubmissions(trial.id),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["trial-irb", trial.id] });
  };
  const create = useMutation({
    mutationFn: () =>
      clinicalTrialsService.createIrbSubmission(trial.id, {
        submission_type: type ?? "initial",
        committee_name: committee || undefined,
        reference_number: ref || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Submission recorded", { title: "Clinical trials" });
      setCommittee("");
      setRef("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      clinicalTrialsService.updateIrbSubmission(v.id, { status: v.status }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Update failed" }),
  });

  const irbTone = (s: string): BadgeTone => {
    if (s === "approved") return "success";
    if (s === "rejected") return "danger";
    if (s === "deferred") return "warning";
    if (s === "under_review") return "info";
    return "neutral";
  };

  return (
    <Modal
      opened
      onClose={onClose}
      title={`Ethics submissions — ${trial.protocol_number}`}
      size="lg"
    >
      <Stack gap="sm">
        <Group grow>
          <Select
            label="Type"
            data={IRB_TYPES.map((v) => ({ value: v, label: v.replace("_", " ") }))}
            value={type}
            onChange={setType}
          />
          <TextInput
            label="Committee"
            value={committee}
            onChange={(e) => setCommittee(e.currentTarget.value)}
            placeholder="Institutional Ethics Committee"
          />
          <TextInput
            label="Reference no."
            value={ref}
            onChange={(e) => setRef(e.currentTarget.value)}
          />
        </Group>
        <Button onClick={() => create.mutate()} loading={create.isPending}>
          Record submission
        </Button>
        <Text fw={600} size="sm">
          Submissions ({subs.length})
        </Text>
        {subs.length === 0 ? (
          <Text size="sm" c="dimmed">
            No ethics submissions recorded.
          </Text>
        ) : (
          subs.map((s) => (
            <Group key={s.id} justify="space-between">
              <Stack gap={0}>
                <Group gap={6}>
                  <Badge tone="neutral" size="xs">
                    {s.submission_type.replace("_", " ")}
                  </Badge>
                  <Badge tone={irbTone(s.status)} size="xs">
                    {s.status.replace("_", " ")}
                  </Badge>
                  <Text size="sm">{s.committee_name}</Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {s.reference_number ? `${s.reference_number} · ` : ""}
                  {new Date(s.submitted_date).toLocaleDateString()}
                </Text>
              </Stack>
              <Select
                size="xs"
                w={140}
                data={IRB_STATUS.map((v) => ({ value: v, label: v.replace("_", " ") }))}
                value={s.status}
                onChange={(v) => v && update.mutate({ id: s.id, status: v })}
                aria-label="Decision"
              />
            </Group>
          ))
        )}
      </Stack>
    </Modal>
  );
}
