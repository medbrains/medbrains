// IPD CreateTrialModal — split from clinical-trials.tsx (pure move).

import { Group, Modal, NumberInput, Select, Stack, TextInput } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, toast } from "@/components/ui";
import { clinicalTrialsService } from "@/services/clinicalTrials.service";
import { STATUSES } from "./shared";

export function CreateTrialModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [protocol, setProtocol] = useState("");
  const [title, setTitle] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [phase, setPhase] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>("planned");
  const [pi, setPi] = useState("");
  const [enroll, setEnroll] = useState<number | "">("");

  const create = useMutation({
    mutationFn: () =>
      clinicalTrialsService.createClinicalTrial({
        protocol_number: protocol,
        title,
        sponsor: sponsor || undefined,
        phase: phase ?? undefined,
        status: status ?? undefined,
        principal_investigator: pi || undefined,
        target_enrollment: typeof enroll === "number" ? enroll : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clinical-trials"] });
      toast.success("Trial registered", { title: "Clinical trials" });
      onClose();
      setProtocol("");
      setTitle("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Register failed" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Register clinical trial" size="lg">
      <Stack gap="sm">
        <Group grow>
          <TextInput
            label="Protocol number"
            value={protocol}
            onChange={(e) => setProtocol(e.currentTarget.value)}
            required
          />
          <Select
            label="Phase"
            data={["I", "II", "III", "IV"].map((v) => ({ value: v, label: `Phase ${v}` }))}
            value={phase}
            onChange={setPhase}
            clearable
          />
        </Group>
        <TextInput
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          required
        />
        <Group grow>
          <TextInput
            label="Sponsor"
            value={sponsor}
            onChange={(e) => setSponsor(e.currentTarget.value)}
          />
          <TextInput
            label="Principal investigator"
            value={pi}
            onChange={(e) => setPi(e.currentTarget.value)}
          />
        </Group>
        <Group grow>
          <Select
            label="Status"
            data={STATUSES.map((v) => ({ value: v, label: v }))}
            value={status}
            onChange={setStatus}
          />
          <NumberInput
            label="Target enrollment"
            value={enroll}
            onChange={(v) => setEnroll(typeof v === "number" ? v : "")}
            min={0}
          />
        </Group>
        <Button
          onClick={() => create.mutate()}
          loading={create.isPending}
          disabled={!protocol.trim() || !title.trim()}
        >
          Register
        </Button>
      </Stack>
    </Modal>
  );
}
