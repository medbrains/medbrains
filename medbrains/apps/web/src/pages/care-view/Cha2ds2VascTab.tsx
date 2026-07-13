import { Card, Group, NumberInput, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { Cha2ds2VascResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Switch } from "@/components/ui";
import { cha2ds2VascService } from "@/services/cha2ds2Vasc.service";

type FactorKey =
  | "congestive_heart_failure"
  | "hypertension"
  | "diabetes"
  | "stroke_tia_thromboembolism"
  | "vascular_disease";

const FACTORS: { key: FactorKey; label: string; points: string }[] = [
  {
    key: "congestive_heart_failure",
    label: "Congestive heart failure / LV dysfunction",
    points: "+1",
  },
  { key: "hypertension", label: "Hypertension", points: "+1" },
  { key: "diabetes", label: "Diabetes mellitus", points: "+1" },
  {
    key: "stroke_tia_thromboembolism",
    label: "Prior stroke / TIA / thromboembolism",
    points: "+2",
  },
  { key: "vascular_disease", label: "Vascular disease (MI, PAD, aortic plaque)", points: "+1" },
];

const ANTICOAG_TONE: Record<string, "danger" | "warning" | "success"> = {
  recommended: "danger",
  consider: "warning",
  "not recommended": "success",
};

/** CHA2DS2-VASc — stroke risk in atrial fibrillation. Age + sex + risk factors in; the server
 *  weights them and returns the oral-anticoagulation recommendation (keyed off the non-sex score). */
export function Cha2ds2VascTab() {
  const [age, setAge] = useState<number>(70);
  const [sexFemale, setSexFemale] = useState(false);
  const [factors, setFactors] = useState<Record<FactorKey, boolean>>({
    congestive_heart_failure: false,
    hypertension: false,
    diabetes: false,
    stroke_tia_thromboembolism: false,
    vascular_disease: false,
  });
  const [result, setResult] = useState<Cha2ds2VascResult | null>(null);

  const compute = useMutation({
    mutationFn: () =>
      cha2ds2VascService.computeCha2ds2Vasc({ age, sex_female: sexFemale, ...factors }),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  return (
    <Stack gap="md" maw={640}>
      <Text fw={600} size="sm">
        CHA₂DS₂-VASc — stroke risk in atrial fibrillation
      </Text>
      <Text size="xs" c="dimmed">
        Stratifies annual stroke risk to guide oral anticoagulation in non-valvular AF. Female sex
        is a modifier — the recommendation keys off the score excluding sex.
      </Text>

      <NumberInput
        label="Age (years)"
        value={age}
        onChange={(v) => setAge(typeof v === "number" ? v : 0)}
        min={0}
        max={130}
      />
      <Switch
        label="Female sex (+1 modifier)"
        checked={sexFemale}
        onChange={(e) => setSexFemale(e.currentTarget.checked)}
      />

      {FACTORS.map((f) => (
        <Switch
          key={f.key}
          label={`${f.label} (${f.points})`}
          checked={factors[f.key]}
          onChange={(e) => setFactors((p) => ({ ...p, [f.key]: e.currentTarget.checked }))}
        />
      ))}

      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Compute CHA₂DS₂-VASc
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>CHA₂DS₂-VASc {result.score}</Text>
              <Badge tone={ANTICOAG_TONE[result.anticoagulation] ?? "neutral"}>
                Anticoagulation {result.anticoagulation}
              </Badge>
            </Group>
            <Text size="sm">{result.response}</Text>
            <Text size="xs" c="dimmed">
              Age {result.age_points} · sex {result.sex_points} · non-sex score{" "}
              {result.non_sex_score}
            </Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
