import { Card, Group, NumberInput, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { Curb65Request, Curb65Result } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Switch } from "@/components/ui";
import { curb65Service } from "@/services/curb65.service";

type CriterionKey = "confusion" | "urea_over_7" | "respiratory_rate_30_plus" | "low_blood_pressure";

const CRITERIA: { key: CriterionKey; label: string }[] = [
  { key: "confusion", label: "Confusion (new disorientation / AMT ≤ 8)" },
  { key: "urea_over_7", label: "Urea > 7 mmol/L (BUN > 19 mg/dL)" },
  { key: "respiratory_rate_30_plus", label: "Respiratory rate ≥ 30/min" },
  { key: "low_blood_pressure", label: "Low BP (systolic < 90 or diastolic ≤ 60)" },
];

const RISK_TONE: Record<string, "danger" | "warning" | "success"> = {
  severe: "danger",
  moderate: "warning",
  low: "success",
};

/** CURB-65 — community-acquired pneumonia severity. Four criteria + age; the server scores each 1
 *  point and returns the risk band and site-of-care disposition. */
export function Curb65Tab() {
  const [criteria, setCriteria] = useState<Record<CriterionKey, boolean>>({
    confusion: false,
    urea_over_7: false,
    respiratory_rate_30_plus: false,
    low_blood_pressure: false,
  });
  const [age, setAge] = useState<number>(70);
  const [result, setResult] = useState<Curb65Result | null>(null);

  const compute = useMutation({
    mutationFn: () => curb65Service.computeCurb65({ ...criteria, age } as Curb65Request),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  return (
    <Stack gap="md" maw={640}>
      <Text fw={600} size="sm">
        CURB-65 — pneumonia severity
      </Text>
      <Text size="xs" c="dimmed">
        Community-acquired pneumonia site-of-care score. 0–1 low (outpatient), 2 moderate (consider
        admission), 3–5 severe (admit; 4–5 assess for ICU).
      </Text>

      {CRITERIA.map((c) => (
        <Switch
          key={c.key}
          label={`${c.label} (+1)`}
          checked={criteria[c.key]}
          onChange={(e) => setCriteria((p) => ({ ...p, [c.key]: e.currentTarget.checked }))}
        />
      ))}
      <NumberInput
        label="Age (years) — scores at ≥ 65"
        value={age}
        onChange={(v) => setAge(typeof v === "number" ? v : 0)}
        min={0}
        max={130}
      />

      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Compute CURB-65
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>CURB-65 {result.score} / 5</Text>
              <Badge tone={RISK_TONE[result.risk] ?? "neutral"}>{result.risk}</Badge>
            </Group>
            <Text size="sm" fw={500}>
              {result.disposition}
            </Text>
            <Text size="sm">{result.response}</Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
