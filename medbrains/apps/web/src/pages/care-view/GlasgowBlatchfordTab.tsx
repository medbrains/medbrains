import { Card, Group, NumberInput, SimpleGrid, Stack, Switch, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { GlasgowBlatchfordResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { glasgowBlatchfordService } from "@/services/glasgowBlatchford.service";

type MarkerKey = "pulse_100_plus" | "melena" | "syncope" | "hepatic_disease" | "cardiac_failure";

const MARKERS: { key: MarkerKey; label: string }[] = [
  { key: "pulse_100_plus", label: "Pulse ≥ 100 (+1)" },
  { key: "melena", label: "Melaena (+1)" },
  { key: "syncope", label: "Syncope (+2)" },
  { key: "hepatic_disease", label: "Hepatic disease (+2)" },
  { key: "cardiac_failure", label: "Cardiac failure (+2)" },
];

const RISK_TONE: Record<string, "danger" | "warning" | "success"> = {
  high: "danger",
  intermediate: "warning",
  "very low": "success",
};

/** Glasgow-Blatchford — upper-GI-bleed risk. Labs + BP + markers in; the server scores and returns
 *  the risk band. A score of 0 flags a possible outpatient. */
export function GlasgowBlatchfordTab() {
  const [urea, setUrea] = useState<number>(5);
  const [hemoglobin, setHemoglobin] = useState<number>(14);
  const [male, setMale] = useState(true);
  const [systolic, setSystolic] = useState<number>(120);
  const [markers, setMarkers] = useState<Record<MarkerKey, boolean>>({
    pulse_100_plus: false,
    melena: false,
    syncope: false,
    hepatic_disease: false,
    cardiac_failure: false,
  });
  const [result, setResult] = useState<GlasgowBlatchfordResult | null>(null);

  const compute = useMutation({
    mutationFn: () =>
      glasgowBlatchfordService.computeGlasgowBlatchford({
        urea_mmol_l: urea,
        hemoglobin_g_dl: hemoglobin,
        sex_male: male,
        systolic_bp: systolic,
        ...markers,
      }),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  return (
    <Stack gap="md" maw={640}>
      <Text fw={600} size="sm">
        Glasgow-Blatchford — upper GI bleed
      </Text>
      <Text size="xs" c="dimmed">
        Risk-stratifies acute upper GI bleeding. A score of 0 may allow outpatient management; a
        high score needs urgent resuscitation and endoscopy.
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <NumberInput
          label="Urea"
          description="mmol/L"
          value={urea}
          onChange={(v) => setUrea(typeof v === "number" ? v : 0)}
          min={0}
          step={0.1}
          decimalScale={1}
        />
        <NumberInput
          label="Haemoglobin"
          description="g/dL"
          value={hemoglobin}
          onChange={(v) => setHemoglobin(typeof v === "number" ? v : 0)}
          min={0}
          step={0.1}
          decimalScale={1}
        />
        <NumberInput
          label="Systolic BP"
          description="mmHg"
          value={systolic}
          onChange={(v) => setSystolic(typeof v === "number" ? v : 0)}
          min={0}
        />
      </SimpleGrid>

      <Switch
        label={male ? "Male (haemoglobin thresholds)" : "Female (haemoglobin thresholds)"}
        checked={male}
        onChange={(e) => setMale(e.currentTarget.checked)}
      />

      {MARKERS.map((m) => (
        <Switch
          key={m.key}
          label={m.label}
          checked={markers[m.key]}
          onChange={(e) => setMarkers((p) => ({ ...p, [m.key]: e.currentTarget.checked }))}
        />
      ))}

      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Compute GBS
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>GBS {result.score} / 23</Text>
              <Badge tone={RISK_TONE[result.risk] ?? "neutral"}>{result.risk} risk</Badge>
            </Group>
            <Text size="sm">{result.response}</Text>
            <Text size="xs" c="dimmed">
              Urea {result.urea_points} · Hb {result.hemoglobin_points} · SBP{" "}
              {result.systolic_bp_points}
            </Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
