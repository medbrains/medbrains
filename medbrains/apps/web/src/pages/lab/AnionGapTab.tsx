import { Card, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { AnionGapResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, NumberField } from "@/components/ui";
import { anionGapService } from "@/services/anionGap.service";

const CATEGORY_TONE = { high: "danger", normal: "success", low: "warning" } as const;

/** Serum anion gap (+ optional albumin correction). Electrolytes in; the server computes the gap,
 *  the albumin-corrected gap, and the acid-base interpretation so the value is authoritative. */
export function AnionGapTab() {
  const [sodium, setSodium] = useState<number | "">("");
  const [chloride, setChloride] = useState<number | "">("");
  const [bicarbonate, setBicarbonate] = useState<number | "">("");
  const [albumin, setAlbumin] = useState<number | "">("");
  const [result, setResult] = useState<AnionGapResult | null>(null);

  const compute = useMutation({
    mutationFn: () =>
      anionGapService.computeAnionGap({
        sodium: Number(sodium),
        chloride: Number(chloride),
        bicarbonate: Number(bicarbonate),
        albumin_g_dl: albumin === "" ? undefined : Number(albumin),
      }),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  const ready = sodium !== "" && chloride !== "" && bicarbonate !== "";

  return (
    <Stack gap="md" maw={560}>
      <Text fw={600} size="sm">
        Serum anion gap
      </Text>
      <Group grow>
        <NumberField
          label="Sodium (mmol/L)"
          value={sodium}
          onChange={(v) => setSodium(v === "" ? "" : Number(v))}
          min={100}
          max={180}
        />
        <NumberField
          label="Chloride (mmol/L)"
          value={chloride}
          onChange={(v) => setChloride(v === "" ? "" : Number(v))}
          min={60}
          max={140}
        />
      </Group>
      <Group grow>
        <NumberField
          label="Bicarbonate (mmol/L)"
          value={bicarbonate}
          onChange={(v) => setBicarbonate(v === "" ? "" : Number(v))}
          min={2}
          max={50}
        />
        <NumberField
          label="Albumin (g/dL) — optional"
          value={albumin}
          onChange={(v) => setAlbumin(v === "" ? "" : Number(v))}
          min={0.5}
          max={6}
          step={0.1}
          decimalScale={1}
        />
      </Group>
      <Button
        tone="primary"
        loading={compute.isPending}
        disabled={!ready}
        onClick={() => compute.mutate()}
        w="fit-content"
      >
        Compute anion gap
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group gap="lg">
              <Badge tone="info">Gap {result.anion_gap} mmol/L</Badge>
              {result.corrected_anion_gap !== null && (
                <Badge tone="neutral">Albumin-corrected {result.corrected_anion_gap} mmol/L</Badge>
              )}
              <Badge tone={CATEGORY_TONE[result.category]}>{result.category.toUpperCase()}</Badge>
            </Group>
            <Text size="sm">{result.response}</Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
