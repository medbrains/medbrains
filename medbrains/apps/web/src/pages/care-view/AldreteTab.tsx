import { Card, Group, SegmentedControl, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { AldreteResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { aldreteService } from "@/services/aldrete.service";

type ParamKey = "activity" | "respiration" | "circulation" | "consciousness" | "oxygenation";

const PARAMS: { key: ParamKey; label: string; hint: string }[] = [
  { key: "activity", label: "Activity", hint: "2 moves 4 limbs · 1 moves 2 · 0 moves 0" },
  {
    key: "respiration",
    label: "Respiration",
    hint: "2 deep/coughs · 1 dyspnoea/shallow · 0 apnoeic",
  },
  {
    key: "circulation",
    label: "Circulation",
    hint: "BP vs pre-op: 2 ±20 mmHg · 1 ±20–50 · 0 >±50",
  },
  {
    key: "consciousness",
    label: "Consciousness",
    hint: "2 fully awake · 1 arousable on calling · 0 not responding",
  },
  {
    key: "oxygenation",
    label: "Oxygenation",
    hint: "2 SpO₂ >92% on air · 1 needs O₂ for >90% · 0 <90% on O₂",
  },
];

const SCORES = ["0", "1", "2"];

/** Modified Aldrete PACU discharge-readiness score. Components in; the server computes the total and
 *  the >= 9 discharge threshold so the number the OT discharge gate trusts is authoritative. */
export function AldreteTab() {
  const [scores, setScores] = useState<Record<ParamKey, number>>({
    activity: 2,
    respiration: 2,
    circulation: 2,
    consciousness: 2,
    oxygenation: 2,
  });
  const [result, setResult] = useState<AldreteResult | null>(null);

  const compute = useMutation({
    mutationFn: () => aldreteService.computeAldrete(scores),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  return (
    <Stack gap="md" maw={640}>
      <Text fw={600} size="sm">
        Aldrete recovery parameters
      </Text>
      <Text size="xs" c="dimmed">
        Post-anaesthesia recovery. Each parameter scores 0–2; a total ≥ 9 is the standard PACU
        discharge-readiness threshold.
      </Text>
      {PARAMS.map((p) => (
        <Stack key={p.key} gap={4}>
          <Text size="sm" fw={500}>
            {p.label}
          </Text>
          <SegmentedControl
            data={SCORES}
            value={String(scores[p.key])}
            onChange={(v) => setScores((s) => ({ ...s, [p.key]: Number(v) }))}
            aria-label={`${p.label} score`}
          />
          <Text size="xs" c="dimmed">
            {p.hint}
          </Text>
        </Stack>
      ))}
      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Compute Aldrete
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>Aldrete total {result.total} / 10</Text>
              <Badge tone={result.discharge_ready ? "success" : "warning"}>
                {result.discharge_ready ? "Discharge-ready" : "Not yet"}
              </Badge>
            </Group>
            <Text size="sm">{result.response}</Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
