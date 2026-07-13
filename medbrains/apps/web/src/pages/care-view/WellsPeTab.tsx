import { Card, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { WellsPeRequest, WellsPeResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Switch } from "@/components/ui";
import { wellsPeService } from "@/services/wellsPe.service";

type CriterionKey = Exclude<keyof WellsPeRequest, never>;

const CRITERIA: { key: CriterionKey; label: string; points: string }[] = [
  { key: "clinical_signs_dvt", label: "Clinical signs & symptoms of DVT", points: "+3" },
  { key: "pe_most_likely", label: "PE is the most likely diagnosis", points: "+3" },
  { key: "heart_rate_over_100", label: "Heart rate > 100 bpm", points: "+1.5" },
  {
    key: "immobilization_or_surgery",
    label: "Immobilisation ≥ 3 days or surgery in last 4 weeks",
    points: "+1.5",
  },
  { key: "previous_dvt_pe", label: "Previous DVT / PE", points: "+1.5" },
  { key: "hemoptysis", label: "Haemoptysis", points: "+1" },
  { key: "malignancy", label: "Active malignancy", points: "+1" },
];

const TIER_TONE: Record<string, "danger" | "warning" | "success"> = {
  high: "danger",
  moderate: "warning",
  low: "success",
};

/** Wells score for suspected PE — pre-test probability. Criteria in; the server weights and
 *  stratifies them (three-tier) and returns the two-tier likely/unlikely workup decision. */
export function WellsPeTab() {
  const [criteria, setCriteria] = useState<Record<CriterionKey, boolean>>({
    clinical_signs_dvt: false,
    pe_most_likely: false,
    heart_rate_over_100: false,
    immobilization_or_surgery: false,
    previous_dvt_pe: false,
    hemoptysis: false,
    malignancy: false,
  });
  const [result, setResult] = useState<WellsPeResult | null>(null);

  const compute = useMutation({
    mutationFn: () => wellsPeService.computeWellsPe(criteria),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  return (
    <Stack gap="md" maw={640}>
      <Text fw={600} size="sm">
        Wells score — suspected pulmonary embolism
      </Text>
      <Text size="xs" c="dimmed">
        Pre-test probability for a patient with suspected PE (this is diagnostic, not the VTE
        prophylaxis score). It drives the next step: D-dimer if PE is unlikely, CTPA if likely.
      </Text>

      {CRITERIA.map((c) => (
        <Switch
          key={c.key}
          label={`${c.label} (${c.points})`}
          checked={criteria[c.key]}
          onChange={(e) => setCriteria((p) => ({ ...p, [c.key]: e.currentTarget.checked }))}
        />
      ))}

      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Compute Wells score
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>Wells score {result.score}</Text>
              <Group gap="xs">
                <Badge tone={TIER_TONE[result.risk_tier] ?? "neutral"}>
                  {result.risk_tier} probability
                </Badge>
                <Badge tone={result.pe_likely ? "danger" : "success"}>
                  {result.pe_likely ? "PE likely" : "PE unlikely"}
                </Badge>
              </Group>
            </Group>
            <Text size="sm" fw={500}>
              {result.recommended_workup}
            </Text>
            <Text size="sm">{result.response}</Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
