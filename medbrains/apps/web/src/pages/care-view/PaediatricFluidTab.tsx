import { Card, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { PaediatricFluidResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, NumberField } from "@/components/ui";
import { paediatricFluidService } from "@/services/paediatricFluid.service";

/** Paediatric maintenance IV fluid (Holliday-Segar / 4-2-1). Weight in; the server computes the
 *  hourly rate and 24h volume and always returns the isotonic-fluid safety reminder. */
export function PaediatricFluidTab() {
  const [weight, setWeight] = useState<number | "">("");
  const [result, setResult] = useState<PaediatricFluidResult | null>(null);

  const compute = useMutation({
    mutationFn: () => paediatricFluidService.computePaediatricFluid({ weight_kg: Number(weight) }),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  return (
    <Stack gap="md" maw={560}>
      <Text fw={600} size="sm">
        Paediatric maintenance fluid (Holliday-Segar)
      </Text>
      <NumberField
        label="Weight (kg)"
        value={weight}
        onChange={(v) => setWeight(v === "" ? "" : Number(v))}
        min={0.5}
        max={150}
        step={0.1}
        decimalScale={1}
        w={200}
      />
      <Button
        tone="primary"
        loading={compute.isPending}
        disabled={weight === ""}
        onClick={() => compute.mutate()}
        w="fit-content"
      >
        Compute maintenance fluid
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group gap="lg">
              <Badge tone="info">{result.hourly_ml} mL/hr</Badge>
              <Badge tone="neutral">{result.daily_ml} mL / 24 h</Badge>
            </Group>
            <Text size="sm" c="danger">
              {result.response}
            </Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
