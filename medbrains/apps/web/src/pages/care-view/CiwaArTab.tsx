import { Card, Group, NumberInput, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CiwaArRequest, CiwaArResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { ciwaArService } from "@/services/ciwaAr.service";

type ItemKey = keyof CiwaArRequest;

const ITEMS_0_7: { key: ItemKey; label: string }[] = [
  { key: "nausea_vomiting", label: "Nausea / vomiting" },
  { key: "tremor", label: "Tremor" },
  { key: "paroxysmal_sweats", label: "Paroxysmal sweats" },
  { key: "anxiety", label: "Anxiety" },
  { key: "agitation", label: "Agitation" },
  { key: "tactile_disturbances", label: "Tactile disturbances" },
  { key: "auditory_disturbances", label: "Auditory disturbances" },
  { key: "visual_disturbances", label: "Visual disturbances" },
  { key: "headache", label: "Headache / fullness" },
];

const SEVERITY_TONE: Record<string, "danger" | "warning" | "success"> = {
  severe: "danger",
  "mild-to-moderate": "warning",
  minimal: "success",
};

const ZERO: CiwaArRequest = {
  nausea_vomiting: 0,
  tremor: 0,
  paroxysmal_sweats: 0,
  anxiety: 0,
  agitation: 0,
  tactile_disturbances: 0,
  auditory_disturbances: 0,
  visual_disturbances: 0,
  headache: 0,
  orientation: 0,
};

/** CIWA-Ar — alcohol-withdrawal severity. Ten item scores in; the server totals them and returns the
 *  severity band and the symptom-triggered benzodiazepine threshold (total ≥ 8). */
export function CiwaArTab() {
  const [values, setValues] = useState<CiwaArRequest>(ZERO);
  const [result, setResult] = useState<CiwaArResult | null>(null);

  const setItem = (key: ItemKey, v: number) => setValues((p) => ({ ...p, [key]: v }));

  const compute = useMutation({
    mutationFn: () => ciwaArService.computeCiwaAr(values),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  return (
    <Stack gap="md" maw={640}>
      <Text fw={600} size="sm">
        CIWA-Ar — alcohol withdrawal
      </Text>
      <Text size="xs" c="dimmed">
        Score each item; the total drives symptom-triggered benzodiazepine dosing (≥ 8) and flags
        severe withdrawal (≥ 16) with its seizure / delirium-tremens risk.
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        {ITEMS_0_7.map((it) => (
          <NumberInput
            key={it.key}
            label={it.label}
            description="0–7"
            value={values[it.key]}
            onChange={(v) => setItem(it.key, typeof v === "number" ? v : 0)}
            min={0}
            max={7}
          />
        ))}
        <NumberInput
          label="Orientation / sensorium"
          description="0–4"
          value={values.orientation}
          onChange={(v) => setItem("orientation", typeof v === "number" ? v : 0)}
          min={0}
          max={4}
        />
      </SimpleGrid>

      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Compute CIWA-Ar
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>CIWA-Ar total {result.total} / 67</Text>
              <Group gap="xs">
                <Badge tone={SEVERITY_TONE[result.severity] ?? "neutral"}>{result.severity}</Badge>
                {result.medication_indicated && <Badge tone="danger">Medicate</Badge>}
              </Group>
            </Group>
            <Text size="sm">{result.response}</Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
