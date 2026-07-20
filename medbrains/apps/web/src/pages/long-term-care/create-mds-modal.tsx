// Long-term-care CreateMdsModal — split from long-term-care.tsx (pure move).

import { Group, Modal, NumberInput, Select, Stack, Textarea } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, toast } from "@/components/ui";
import { longTermCareService } from "@/services/longTermCare.service";

const MDS_TYPES = ["admission", "quarterly", "annual", "significant_change", "discharge"];
const COGNITIVE = ["intact", "mild impairment", "moderate impairment", "severe impairment"];
const CONTINENCE = [
  "continent",
  "occasionally incontinent",
  "frequently incontinent",
  "incontinent",
];

export function CreateMdsModal({
  patientId,
  opened,
  onClose,
}: {
  patientId: string;
  opened: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<string | null>("admission");
  const [cognitive, setCognitive] = useState<string | null>(null);
  const [mood, setMood] = useState<number | "">("");
  const [adl, setAdl] = useState<number | "">("");
  const [continence, setContinence] = useState<string | null>(null);
  const [nutrition, setNutrition] = useState("");

  const create = useMutation({
    mutationFn: () =>
      longTermCareService.createMdsAssessment({
        patient_id: patientId,
        assessment_type: type ?? "admission",
        cognitive_status: cognitive ?? undefined,
        mood_score: typeof mood === "number" ? mood : undefined,
        adl_dependency_score: typeof adl === "number" ? adl : undefined,
        continence_status: continence ?? undefined,
        nutrition_notes: nutrition || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mds", patientId] });
      toast.success("Assessment started", { title: "Long-term care" });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="New MDS assessment" size="lg">
      <Stack gap="sm">
        <Group grow>
          <Select
            label="Type"
            data={MDS_TYPES.map((t) => ({ value: t, label: t.replace("_", " ") }))}
            value={type}
            onChange={setType}
          />
          <Select
            label="Cognition"
            data={COGNITIVE.map((c) => ({ value: c, label: c }))}
            value={cognitive}
            onChange={setCognitive}
            clearable
          />
        </Group>
        <Group grow>
          <NumberInput
            label="Mood score (PHQ-9)"
            value={mood}
            onChange={(v) => setMood(typeof v === "number" ? v : "")}
            min={0}
            max={27}
          />
          <NumberInput
            label="ADL dependency"
            value={adl}
            onChange={(v) => setAdl(typeof v === "number" ? v : "")}
            min={0}
            max={28}
          />
          <Select
            label="Continence"
            data={CONTINENCE.map((c) => ({ value: c, label: c }))}
            value={continence}
            onChange={setContinence}
            clearable
          />
        </Group>
        <Textarea
          label="Nutrition notes"
          value={nutrition}
          onChange={(e) => setNutrition(e.currentTarget.value)}
        />
        <Button onClick={() => create.mutate()} loading={create.isPending}>
          Start assessment
        </Button>
      </Stack>
    </Modal>
  );
}
