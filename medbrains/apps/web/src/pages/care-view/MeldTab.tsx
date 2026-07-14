import { Card, Group, NumberInput, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { MeldResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Switch } from "@/components/ui";
import { meldService } from "@/services/meld.service";

/** MELD — end-stage liver disease score from bilirubin, INR and creatinine. The server applies the
 *  flooring/capping rules and returns the score (6–40) with its 90-day mortality band. */
export function MeldTab() {
  const [bilirubin, setBilirubin] = useState<number>(1);
  const [inr, setInr] = useState<number>(1);
  const [creatinine, setCreatinine] = useState<number>(1);
  const [dialysis, setDialysis] = useState(false);
  const [result, setResult] = useState<MeldResult | null>(null);

  const compute = useMutation({
    mutationFn: () =>
      meldService.computeMeld({
        bilirubin_mg_dl: bilirubin,
        inr,
        creatinine_mg_dl: creatinine,
        dialysis_twice_past_week: dialysis,
      }),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  return (
    <Stack gap="md" maw={640}>
      <Text fw={600} size="sm">
        MELD — end-stage liver disease
      </Text>
      <Text size="xs" c="dimmed">
        Predicts 90-day mortality in chronic liver disease and prioritises transplant. Values &lt; 1
        are floored to 1; creatinine is capped at 4 (forced to 4 with dialysis).
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <NumberInput
          label="Bilirubin"
          description="mg/dL"
          value={bilirubin}
          onChange={(v) => setBilirubin(typeof v === "number" ? v : 0)}
          min={0}
          step={0.1}
          decimalScale={1}
        />
        <NumberInput
          label="INR"
          value={inr}
          onChange={(v) => setInr(typeof v === "number" ? v : 0)}
          min={0}
          step={0.1}
          decimalScale={1}
        />
        <NumberInput
          label="Creatinine"
          description="mg/dL"
          value={creatinine}
          onChange={(v) => setCreatinine(typeof v === "number" ? v : 0)}
          min={0}
          step={0.1}
          decimalScale={1}
        />
      </SimpleGrid>

      <Switch
        label="Dialysis ≥ 2× in the past week (forces creatinine to 4.0)"
        checked={dialysis}
        onChange={(e) => setDialysis(e.currentTarget.checked)}
      />

      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Compute MELD
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>MELD {result.score}</Text>
              <Badge
                tone={result.score >= 30 ? "danger" : result.score >= 15 ? "warning" : "success"}
              >
                mortality {result.mortality_band}
              </Badge>
            </Group>
            <Text size="sm">{result.response}</Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
