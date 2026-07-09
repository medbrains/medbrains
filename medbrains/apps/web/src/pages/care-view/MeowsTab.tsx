import { Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { MeowsResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, NumberField, Switch } from "@/components/ui";
import { meowsService } from "@/services/meows.service";

const bandTone = (band: string) =>
  band === "red" ? "danger" : band === "yellow" ? "warning" : "neutral";

/** MEOWS (Modified Early Obstetric Warning Score). Bedside params in; the server computes each
 *  parameter's band and the one-red-or-two-yellow escalation trigger — NEWS2 is not valid in
 *  pregnancy, so obstetric patients need this dedicated chart. */
export function MeowsTab() {
  const [rr, setRr] = useState(16);
  const [spo2, setSpo2] = useState(98);
  const [temp, setTemp] = useState(37.0);
  const [sbp, setSbp] = useState(120);
  const [dbp, setDbp] = useState(75);
  const [pulse, setPulse] = useState(80);
  const [notAlert, setNotAlert] = useState(false);
  const [result, setResult] = useState<MeowsResult | null>(null);

  const compute = useMutation({
    mutationFn: () =>
      meowsService.computeMeows({
        respiratory_rate: rr,
        spo2,
        temperature: temp,
        systolic_bp: sbp,
        diastolic_bp: dbp,
        pulse,
        not_alert: notAlert,
      }),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  return (
    <Stack gap="md" maw={640}>
      <Text fw={600} size="sm">
        MEOWS — obstetric vital signs
      </Text>
      <Text size="xs" c="dimmed">
        For pregnant or recently-delivered women. Each vital maps to a white / yellow / red band; a
        single red or two yellows triggers senior obstetric review.
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <NumberField
          label="Respiratory rate (/min)"
          value={rr}
          onChange={(v) => setRr(Number(v) || 0)}
          min={0}
          max={80}
        />
        <NumberField
          label="SpO₂ (%)"
          value={spo2}
          onChange={(v) => setSpo2(Number(v) || 0)}
          min={0}
          max={100}
        />
        <NumberField
          label="Temperature (°C)"
          value={temp}
          onChange={(v) => setTemp(Number(v) || 0)}
          min={20}
          max={45}
          step={0.1}
          decimalScale={1}
        />
        <NumberField
          label="Systolic BP (mmHg)"
          value={sbp}
          onChange={(v) => setSbp(Number(v) || 0)}
          min={0}
          max={300}
        />
        <NumberField
          label="Diastolic BP (mmHg)"
          value={dbp}
          onChange={(v) => setDbp(Number(v) || 0)}
          min={0}
          max={200}
        />
        <NumberField
          label="Pulse (/min)"
          value={pulse}
          onChange={(v) => setPulse(Number(v) || 0)}
          min={0}
          max={300}
        />
      </SimpleGrid>
      <Switch
        label="Not fully alert (responds to voice/pain only, or unresponsive)"
        checked={notAlert}
        onChange={(e) => setNotAlert(e.currentTarget.checked)}
      />
      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Compute MEOWS
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>
                {result.red_count} red · {result.yellow_count} yellow
              </Text>
              <Badge tone={result.triggered ? "danger" : "success"}>
                {result.triggered ? "TRIGGERED" : "Within parameters"}
              </Badge>
            </Group>
            <Text size="sm">{result.response}</Text>
            <Group gap="xs">
              {result.params.map((p) => (
                <Badge key={p.name} tone={bandTone(p.band)}>
                  {p.name}
                </Badge>
              ))}
            </Group>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
