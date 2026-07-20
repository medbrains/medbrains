// IPD RandomizationModal — split from clinical-trials.tsx (pure move).

import { Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import type { ClinicalTrial } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, toast } from "@/components/ui";
import { clinicalTrialsService } from "@/services/clinicalTrials.service";

export function RandomizationModal({
  trial,
  onClose,
}: {
  trial: ClinicalTrial;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [arm, setArm] = useState("");
  const [code, setCode] = useState("");
  const [unblindId, setUnblindId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["trial-randomizations", trial.id],
    queryFn: () => clinicalTrialsService.listRandomizations(trial.id),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["trial-randomizations", trial.id] });
  };
  const randomize = useMutation({
    mutationFn: () =>
      clinicalTrialsService.randomizePatient(trial.id, {
        patient_id: patientId,
        arm,
        randomization_code: code || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Patient randomized", { title: "Clinical trials" });
      setArm("");
      setCode("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Randomize failed" }),
  });
  const unblind = useMutation({
    mutationFn: () => clinicalTrialsService.unblindRandomization(unblindId ?? "", { reason }),
    onSuccess: () => {
      invalidate();
      toast.success("Unblinded", { title: "Clinical trials" });
      setUnblindId(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Unblind failed" }),
  });

  return (
    <Modal opened onClose={onClose} title={`Randomization — ${trial.protocol_number}`} size="lg">
      <Stack gap="sm">
        <PatientSearchSelect value={patientId} onChange={setPatientId} />
        <Group grow>
          <TextInput
            label="Arm (from IWRS)"
            value={arm}
            onChange={(e) => setArm(e.currentTarget.value)}
            placeholder="Arm A / Arm B"
          />
          <TextInput
            label="Randomization code"
            value={code}
            onChange={(e) => setCode(e.currentTarget.value)}
            placeholder="R-0007"
          />
        </Group>
        <Button
          onClick={() => randomize.mutate()}
          loading={randomize.isPending}
          disabled={!patientId || !arm.trim()}
        >
          Randomize patient
        </Button>

        {unblindId && (
          <Group align="flex-end" gap="xs">
            <TextInput
              label="Unblinding reason"
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
              placeholder="Medical emergency — SAE management"
              style={{ flex: 1 }}
            />
            <Button
              tone="danger"
              onClick={() => unblind.mutate()}
              loading={unblind.isPending}
              disabled={!reason.trim()}
            >
              Confirm unblind
            </Button>
            <Button tone="ghost" onClick={() => setUnblindId(null)}>
              Cancel
            </Button>
          </Group>
        )}

        <Text fw={600} size="sm">
          Randomized patients ({rows.length})
        </Text>
        {rows.length === 0 ? (
          <Text size="sm" c="dimmed">
            No patients randomized.
          </Text>
        ) : (
          rows.map((r) => (
            <Group key={r.id} justify="space-between">
              <Group gap={6}>
                <Text size="sm">
                  {r.first_name} {r.last_name}
                </Text>
                {r.randomization_code && (
                  <Badge tone="neutral" size="xs">
                    {r.randomization_code}
                  </Badge>
                )}
                {r.is_unblinded ? (
                  <Badge tone="warning" size="xs">
                    unblinded · {r.arm}
                  </Badge>
                ) : (
                  <Badge tone="info" size="xs">
                    blinded
                  </Badge>
                )}
              </Group>
              {!r.is_unblinded && (
                <Button size="xs" tone="danger" onClick={() => setUnblindId(r.id)}>
                  Unblind
                </Button>
              )}
            </Group>
          ))
        )}
      </Stack>
    </Modal>
  );
}
