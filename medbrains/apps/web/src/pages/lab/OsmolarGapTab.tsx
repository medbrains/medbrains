import { Card, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { OsmolarGapResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, NumberField } from "@/components/ui";
import { osmolarGapService } from "@/services/osmolarGap.service";

const CATEGORY_TONE = { elevated: "danger", normal: "success" } as const;

/** Serum osmolar gap (measured − calculated osmolality). The companion to the anion gap in the
 *  toxic-alcohol workup; the server computes the calculated osmolality, the gap and the reading. */
export function OsmolarGapTab() {
  const [sodium, setSodium] = useState<number | "">("");
  const [glucose, setGlucose] = useState<number | "">("");
  const [bun, setBun] = useState<number | "">("");
  const [measured, setMeasured] = useState<number | "">("");
  const [ethanol, setEthanol] = useState<number | "">("");
  const [result, setResult] = useState<OsmolarGapResult | null>(null);

  const compute = useMutation({
    mutationFn: () =>
      osmolarGapService.computeOsmolarGap({
        sodium: Number(sodium),
        glucose_mg_dl: Number(glucose),
        bun_mg_dl: Number(bun),
        measured_osm: Number(measured),
        ethanol_mg_dl: ethanol === "" ? undefined : Number(ethanol),
      }),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  const ready = sodium !== "" && glucose !== "" && bun !== "" && measured !== "";

  return (
    <Stack gap="md" maw={560}>
      <Text fw={600} size="sm">
        Serum osmolar gap
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
          label="Glucose (mg/dL)"
          value={glucose}
          onChange={(v) => setGlucose(v === "" ? "" : Number(v))}
          min={20}
          max={1500}
        />
      </Group>
      <Group grow>
        <NumberField
          label="BUN (mg/dL)"
          value={bun}
          onChange={(v) => setBun(v === "" ? "" : Number(v))}
          min={2}
          max={300}
        />
        <NumberField
          label="Measured osmolality (mOsm/kg)"
          value={measured}
          onChange={(v) => setMeasured(v === "" ? "" : Number(v))}
          min={200}
          max={400}
        />
      </Group>
      <NumberField
        label="Ethanol (mg/dL) — optional"
        value={ethanol}
        onChange={(v) => setEthanol(v === "" ? "" : Number(v))}
        min={0}
        max={600}
        w={260}
      />
      <Button
        tone="primary"
        loading={compute.isPending}
        disabled={!ready}
        onClick={() => compute.mutate()}
        w="fit-content"
      >
        Compute osmolar gap
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group gap="lg">
              <Badge tone="neutral">Calculated {result.calculated_osm} mOsm/kg</Badge>
              <Badge tone="info">Gap {result.osmolar_gap} mOsm/kg</Badge>
              <Badge tone={CATEGORY_TONE[result.category]}>{result.category.toUpperCase()}</Badge>
            </Group>
            <Text size="sm">{result.response}</Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
