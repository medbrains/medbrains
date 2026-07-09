import { Card, Group, SegmentedControl, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { PewsResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Switch } from "@/components/ui";
import { pewsService } from "@/services/pews.service";

const DOMAINS: {
  key: "behaviour" | "cardiovascular" | "respiratory";
  label: string;
  hint: string;
}[] = [
  {
    key: "behaviour",
    label: "Behaviour",
    hint: "0 playing · 1 sleeping · 2 irritable · 3 lethargic/confused",
  },
  {
    key: "cardiovascular",
    label: "Cardiovascular",
    hint: "0 pink/CR 1–2s · 1 pale/CR 3s · 2 grey/CR 4s/HR+20 · 3 mottled/CR ≥5s/HR+30 or brady",
  },
  {
    key: "respiratory",
    label: "Respiratory",
    hint: "0 normal · 1 RR+10/accessory · 2 RR+20/recessing · 3 RR−5 with grunting/FiO₂ ≥50%",
  },
];

const SCORES = ["0", "1", "2", "3"];

/** PEWS (Brighton Paediatric Early Warning Score). Domain scores in; the server sums them and
 *  applies the escalation trigger — NEWS2/MEOWS are not valid in children. */
export function PewsTab() {
  const [scores, setScores] = useState({ behaviour: 0, cardiovascular: 0, respiratory: 0 });
  const [nebuliser, setNebuliser] = useState(false);
  const [vomiting, setVomiting] = useState(false);
  const [result, setResult] = useState<PewsResult | null>(null);

  const compute = useMutation({
    mutationFn: () =>
      pewsService.computePews({
        ...scores,
        quarter_hourly_nebuliser: nebuliser,
        persistent_vomiting: vomiting,
      }),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  return (
    <Stack gap="md" maw={640}>
      <Text fw={600} size="sm">
        PEWS — paediatric domain scores
      </Text>
      <Text size="xs" c="dimmed">
        For children. Score each domain 0–3; any domain at 3 or an aggregate ≥ 4 triggers urgent
        paediatric review.
      </Text>
      {DOMAINS.map((d) => (
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
      <Switch
        label="On quarter-hourly nebulisers (+2)"
        checked={nebuliser}
        onChange={(e) => setNebuliser(e.currentTarget.checked)}
      />
      <Switch
        label="Persistent post-operative vomiting (+2)"
        checked={vomiting}
        onChange={(e) => setVomiting(e.currentTarget.checked)}
      />
      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Compute PEWS
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>
                PEWS total {result.total}
                {result.extra > 0 ? ` (incl. +${result.extra})` : ""}
              </Text>
              <Badge tone={result.triggered ? "danger" : result.total >= 1 ? "warning" : "success"}>
                {result.triggered ? "URGENT" : result.total >= 1 ? "Elevated" : "Normal"}
              </Badge>
            </Group>
            <Text size="sm">{result.response}</Text>
            <Text size="xs" c="dimmed">
              Behaviour {result.behaviour} · Cardiovascular {result.cardiovascular} · Respiratory{" "}
              {result.respiratory} · highest domain {result.max_domain}
            </Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
