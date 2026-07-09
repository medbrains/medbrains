import { Card, Divider, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { News2Result } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, NumberField, Switch } from "@/components/ui";
import { news2Service } from "@/services/news2.service";

/** NEWS2 (RCP 2017) early-warning score. Bedside params in; the server computes the
 *  authoritative aggregate + escalation band so the score can't be mis-added at the bedside. */
export function News2Tab() {
  const [rr, setRr] = useState(16);
  const [spo2, setSpo2] = useState(98);
  const [onOxygen, setOnOxygen] = useState(false);
  const [temp, setTemp] = useState(37.0);
  const [sbp, setSbp] = useState(120);
  const [pulse, setPulse] = useState(70);
  const [confused, setConfused] = useState(false);
  const [result, setResult] = useState<News2Result | null>(null);

  const compute = useMutation({
    mutationFn: () =>
      news2Service.computeNews2({
        respiratory_rate: rr,
        spo2,
        on_oxygen: onOxygen,
        temperature: temp,
        systolic_bp: sbp,
        pulse,
        confused_or_worse: confused,
      }),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  const riskTone = (risk: string) =>
    risk === "high" ? "danger" : risk === "medium" ? "warning" : "info";

  return (
    <Stack gap="md" maw={640}>
      <Text fw={600} size="sm">
        NEWS2 vital signs
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
          label="Pulse (/min)"
          value={pulse}
          onChange={(v) => setPulse(Number(v) || 0)}
          min={0}
          max={300}
        />
      </SimpleGrid>
      <Group gap="xl">
        <Switch
          label="On supplemental oxygen"
          checked={onOxygen}
          onChange={(e) => setOnOxygen(e.currentTarget.checked)}
        />
        <Switch
          label="Confusion / not fully alert (ACVPU)"
          checked={confused}
          onChange={(e) => setConfused(e.currentTarget.checked)}
        />
      </Group>
      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Compute NEWS2
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>
                NEWS2 total {result.total}
                {result.any_param_three ? " · single param scored 3" : ""}
              </Text>
              <Badge tone={riskTone(result.risk)}>{result.risk.toUpperCase()} risk</Badge>
            </Group>
            <Text size="sm">{result.response}</Text>
            <Divider />
            <Text size="xs" c="dimmed">
              RR {result.respiratory_rate} · SpO₂ {result.spo2} · O₂ {result.supplemental_o2} · Temp{" "}
              {result.temperature} · SBP {result.systolic_bp} · Pulse {result.pulse} · ACVPU{" "}
              {result.consciousness}
            </Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
