// IPD CandidatesModal — split from clinical-trials.tsx (pure move).

import { Group, Modal, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import type { ClinicalTrial } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, toast } from "@/components/ui";
import { clinicalTrialsService } from "@/services/clinicalTrials.service";

export function CandidatesModal({
  trial,
  onClose,
}: {
  trial: ClinicalTrial | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [minAge, setMinAge] = useState<number | "">(trial?.min_age ?? "");
  const [maxAge, setMaxAge] = useState<number | "">(trial?.max_age ?? "");
  const [sex, setSex] = useState<string | null>(trial?.eligibility_sex ?? null);
  const [codes, setCodes] = useState((trial?.diagnosis_codes ?? []).join(", "));

  const save = useMutation({
    mutationFn: () =>
      clinicalTrialsService.updateClinicalTrial(trial?.id ?? "", {
        min_age: typeof minAge === "number" ? minAge : undefined,
        max_age: typeof maxAge === "number" ? maxAge : undefined,
        eligibility_sex: sex ?? undefined,
        diagnosis_codes: codes
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clinical-trials"] });
      void qc.invalidateQueries({ queryKey: ["trial-candidates", trial?.id] });
      toast.success("Eligibility saved — re-screened", { title: "Clinical trials" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Save failed" }),
  });

  const { data: candidates = [], isFetching } = useQuery({
    queryKey: ["trial-candidates", trial?.id],
    queryFn: () => clinicalTrialsService.screenTrialCandidates(trial?.id ?? ""),
    enabled: !!trial,
  });

  return (
    <Modal
      opened={!!trial}
      onClose={onClose}
      title={`Candidates — ${trial?.protocol_number ?? ""}`}
      size="lg"
    >
      <Stack gap="sm">
        <Group grow>
          <NumberInput
            label="Min age"
            value={minAge}
            onChange={(v) => setMinAge(typeof v === "number" ? v : "")}
            min={0}
          />
          <NumberInput
            label="Max age"
            value={maxAge}
            onChange={(v) => setMaxAge(typeof v === "number" ? v : "")}
            min={0}
          />
          <Select
            label="Biological sex"
            data={["male", "female", "other"].map((v) => ({ value: v, label: v }))}
            value={sex}
            onChange={setSex}
            clearable
          />
        </Group>
        <TextInput
          label="Required diagnosis ICD codes (comma-separated)"
          value={codes}
          onChange={(e) => setCodes(e.currentTarget.value)}
          placeholder="I10, E11.9"
        />
        <Button onClick={() => save.mutate()} loading={save.isPending}>
          Save eligibility & re-screen
        </Button>
        <Text fw={600} size="sm">
          Matched patients {isFetching ? "…" : `(${candidates.length})`}
        </Text>
        {candidates.length === 0 ? (
          <Text size="sm" c="dimmed">
            No patients match the current eligibility.
          </Text>
        ) : (
          candidates.map((c) => (
            <Group key={c.id} gap="xs">
              <Text size="sm">
                {c.first_name} {c.last_name}
              </Text>
              <Badge tone="neutral" size="xs">
                {c.age ?? "?"}y · {c.biological_sex ?? "?"}
              </Badge>
            </Group>
          ))
        )}
      </Stack>
    </Modal>
  );
}
