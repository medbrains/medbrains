import { Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { QsofaResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, NumberField, Switch } from "@/components/ui";
import { sepsisService } from "@/services/sepsis.service";

/** qSOFA sepsis screen. Bedside params in; the server computes the authoritative score + the
 *  Hour-1-bundle escalation trigger so a score >= 2 can't be missed at the bedside. */
export function SepsisTab() {
  const [rr, setRr] = useState(16);
  const [sbp, setSbp] = useState(120);
  const [altered, setAltered] = useState(false);
  const [result, setResult] = useState<QsofaResult | null>(null);

  const compute = useMutation({
    mutationFn: () =>
      sepsisService.computeQsofa({
        respiratory_rate: rr,
        systolic_bp: sbp,
        altered_mentation: altered,
      }),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  return (
    <Stack gap="md" maw={640}>
      <Text fw={600} size="sm">
        qSOFA sepsis screen
      </Text>
      <Text size="xs" c="dimmed">
        For a patient with suspected infection. Each criterion scores 1; a total ≥ 2 flags high risk
        of a poor outcome and triggers the Surviving Sepsis Hour-1 bundle.
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <NumberField
          label="Respiratory rate (/min) — ≥22 scores"
          value={rr}
          onChange={(v) => setRr(Number(v) || 0)}
          min={0}
          max={80}
        />
        <NumberField
          label="Systolic BP (mmHg) — ≤100 scores"
          value={sbp}
          onChange={(v) => setSbp(Number(v) || 0)}
          min={0}
          max={300}
        />
      </SimpleGrid>
      <Switch
        label="Altered mentation (GCS < 15 / not fully alert)"
        checked={altered}
        onChange={(e) => setAltered(e.currentTarget.checked)}
      />
      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Compute qSOFA
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>qSOFA total {result.total}</Text>
              <Badge tone={result.high_risk ? "danger" : "info"}>
                {result.high_risk ? "HIGH risk" : "LOWER risk"}
              </Badge>
            </Group>
            <Text size="sm">{result.response}</Text>
            <Text size="xs" c="dimmed">
              RR {result.respiratory_rate} · SBP {result.systolic_bp} · Mentation {result.mentation}
            </Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
