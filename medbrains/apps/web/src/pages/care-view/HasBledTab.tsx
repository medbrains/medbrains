import { Card, Group, NumberInput, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { HasBledResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Switch } from "@/components/ui";
import { hasBledService } from "@/services/hasBled.service";

type FactorKey =
  | "uncontrolled_hypertension"
  | "abnormal_renal_function"
  | "abnormal_liver_function"
  | "stroke"
  | "bleeding_history"
  | "labile_inr"
  | "drugs_antiplatelet_nsaid"
  | "alcohol_excess";

const FACTORS: { key: FactorKey; label: string }[] = [
  { key: "uncontrolled_hypertension", label: "Uncontrolled hypertension (SBP > 160)" },
  {
    key: "abnormal_renal_function",
    label: "Abnormal renal function (dialysis/transplant/Cr > 200)",
  },
  { key: "abnormal_liver_function", label: "Abnormal liver function (cirrhosis / deranged LFTs)" },
  { key: "stroke", label: "Prior stroke" },
  { key: "bleeding_history", label: "Bleeding history or predisposition" },
  { key: "labile_inr", label: "Labile INR (TTR < 60% on a VKA)" },
  { key: "drugs_antiplatelet_nsaid", label: "Antiplatelet agents or NSAIDs" },
  { key: "alcohol_excess", label: "Alcohol excess (≥ 8 units/week)" },
];

/** HAS-BLED — bleeding risk for AF anticoagulation. Age + factors in; the server sums them and flags
 *  high risk (≥ 3). A high score prompts managing modifiable factors, NOT withholding anticoagulation. */
export function HasBledTab() {
  const [age, setAge] = useState<number>(70);
  const [factors, setFactors] = useState<Record<FactorKey, boolean>>({
    uncontrolled_hypertension: false,
    abnormal_renal_function: false,
    abnormal_liver_function: false,
    stroke: false,
    bleeding_history: false,
    labile_inr: false,
    drugs_antiplatelet_nsaid: false,
    alcohol_excess: false,
  });
  const [result, setResult] = useState<HasBledResult | null>(null);

  const compute = useMutation({
    mutationFn: () => hasBledService.computeHasBled({ age, ...factors }),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  return (
    <Stack gap="md" maw={640}>
      <Text fw={600} size="sm">
        HAS-BLED — bleeding risk on AF anticoagulation
      </Text>
      <Text size="xs" c="dimmed">
        Counterpart to CHA₂DS₂-VASc. A high score (≥ 3) is not a reason to withhold anticoagulation
        — it flags modifiable bleeding factors to correct and prompts closer review.
      </Text>

      <NumberInput
        label="Age (years) — 'Elderly' scores at > 65"
        value={age}
        onChange={(v) => setAge(typeof v === "number" ? v : 0)}
        min={0}
        max={130}
      />

      {FACTORS.map((f) => (
        <Switch
          key={f.key}
          label={`${f.label} (+1)`}
          checked={factors[f.key]}
          onChange={(e) => setFactors((p) => ({ ...p, [f.key]: e.currentTarget.checked }))}
        />
      ))}

      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Compute HAS-BLED
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>HAS-BLED {result.score}</Text>
              <Badge tone={result.high_risk ? "danger" : "success"}>{result.risk} risk</Badge>
            </Group>
            <Text size="sm">{result.response}</Text>
            {result.elderly_point > 0 && (
              <Text size="xs" c="dimmed">
                Includes the elderly (age &gt; 65) point.
              </Text>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
