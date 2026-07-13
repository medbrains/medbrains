import { Card, Group, SegmentedControl, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CpotResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Switch } from "@/components/ui";
import { cpotService } from "@/services/cpot.service";

const SCORES = ["0", "1", "2"];

const FIXED_DOMAINS: {
  key: "facial_expression" | "body_movements" | "muscle_tension";
  label: string;
  hint: string;
}[] = [
  {
    key: "facial_expression",
    label: "Facial expression",
    hint: "0 relaxed · 1 tense (frowning) · 2 grimacing (+ eyelids tightly closed)",
  },
  {
    key: "body_movements",
    label: "Body movements",
    hint: "0 no movement · 1 protection (slow, guarding site) · 2 restless (pulling tubes)",
  },
  {
    key: "muscle_tension",
    label: "Muscle tension",
    hint: "0 relaxed on passive flexion · 1 tense/rigid · 2 very tense, resistant",
  },
];

/** CPOT — behavioural pain score for ICU patients who cannot self-report. Domain scores in; the
 *  server sums them (0–8) and flags significant pain at ≥ 3. */
export function CpotTab() {
  const [scores, setScores] = useState({
    facial_expression: 0,
    body_movements: 0,
    muscle_tension: 0,
    ventilator_or_vocalization: 0,
  });
  const [intubated, setIntubated] = useState(true);
  const [result, setResult] = useState<CpotResult | null>(null);

  const compute = useMutation({
    mutationFn: () => cpotService.computeCpot({ ...scores, intubated }),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  const fourthHint = intubated
    ? "0 tolerating ventilator · 1 coughing but tolerating · 2 fighting the ventilator"
    : "0 normal tone/silent · 1 sighing/moaning · 2 crying out/sobbing";

  return (
    <Stack gap="md" maw={640}>
      <Text fw={600} size="sm">
        CPOT — behavioural pain (non-verbal ICU patient)
      </Text>
      <Text size="xs" c="dimmed">
        Use when the patient cannot self-report pain. Score each domain 0–2; a total ≥ 3 signals
        significant pain needing analgesia. Untreated pain worsens agitation and delirium.
      </Text>

      <Switch
        label={
          intubated
            ? "Intubated (fourth domain = ventilator)"
            : "Extubated (fourth domain = vocalisation)"
        }
        checked={intubated}
        onChange={(e) => setIntubated(e.currentTarget.checked)}
      />

      {FIXED_DOMAINS.map((d) => (
        <Stack key={d.key} gap={4}>
          <Text size="sm" fw={500}>
            {d.label}
          </Text>
          <SegmentedControl
            data={SCORES}
            value={String(scores[d.key])}
            onChange={(v) => setScores((p) => ({ ...p, [d.key]: Number(v) }))}
            aria-label={`${d.label} score`}
          />
          <Text size="xs" c="dimmed">
            {d.hint}
          </Text>
        </Stack>
      ))}

      <Stack gap={4}>
        <Text size="sm" fw={500}>
          {intubated ? "Compliance with the ventilator" : "Vocalisation"}
        </Text>
        <SegmentedControl
          data={SCORES}
          value={String(scores.ventilator_or_vocalization)}
          onChange={(v) => setScores((p) => ({ ...p, ventilator_or_vocalization: Number(v) }))}
          aria-label="Ventilator or vocalisation score"
        />
        <Text size="xs" c="dimmed">
          {fourthHint}
        </Text>
      </Stack>

      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Compute CPOT
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>CPOT total {result.total} / 8</Text>
              <Badge tone={result.significant_pain ? "danger" : "success"}>
                {result.significant_pain ? "Significant pain" : "No significant pain"}
              </Badge>
            </Group>
            <Text size="sm">{result.response}</Text>
            <Text size="xs" c="dimmed">
              Face {result.facial_expression} · Body {result.body_movements} · Muscle{" "}
              {result.muscle_tension} · {intubated ? "Ventilator" : "Vocalisation"}{" "}
              {result.ventilator_or_vocalization}
            </Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
