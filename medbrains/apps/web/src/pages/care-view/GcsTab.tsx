import { Card, Group, SegmentedControl, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { GcsResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { gcsService } from "@/services/gcs.service";

type Component = { key: "eye" | "verbal" | "motor"; label: string; max: number; hint: string };

const COMPONENTS: Component[] = [
  {
    key: "eye",
    label: "Eye opening",
    max: 4,
    hint: "4 spontaneous · 3 to voice · 2 to pain · 1 none",
  },
  {
    key: "verbal",
    label: "Verbal response",
    max: 5,
    hint: "5 oriented · 4 confused · 3 words · 2 sounds · 1 none",
  },
  {
    key: "motor",
    label: "Motor response",
    max: 6,
    hint: "6 obeys · 5 localises · 4 withdraws · 3 flexion · 2 extension · 1 none",
  },
];

const severityTone = (s: string) =>
  s === "severe" ? "danger" : s === "moderate" ? "warning" : "success";

/** Glasgow Coma Scale calculator. Components in; the server computes the authoritative total + coma
 *  severity band, including the GCS ≤ 8 airway-protection trigger. */
export function GcsTab() {
  const [scores, setScores] = useState({ eye: 4, verbal: 5, motor: 6 });
  const [result, setResult] = useState<GcsResult | null>(null);

  const compute = useMutation({
    mutationFn: () => gcsService.computeGcs(scores),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  return (
    <Stack gap="md" maw={640}>
      <Text fw={600} size="sm">
        Glasgow Coma Scale
      </Text>
      {COMPONENTS.map((c) => (
        <Stack key={c.key} gap={4}>
          <Text size="sm" fw={500}>
            {c.label}
          </Text>
          <SegmentedControl
            data={Array.from({ length: c.max }, (_, i) => String(i + 1))}
            value={String(scores[c.key])}
            onChange={(v) => setScores((s) => ({ ...s, [c.key]: Number(v) }))}
            aria-label={`${c.label} score`}
          />
          <Text size="xs" c="dimmed">
            {c.hint}
          </Text>
        </Stack>
      ))}
      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Compute GCS
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>
                GCS {result.total} / 15 (E{result.eye} V{result.verbal} M{result.motor})
              </Text>
              <Badge tone={severityTone(result.severity)}>{result.severity.toUpperCase()}</Badge>
            </Group>
            <Text size="sm">{result.response}</Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
