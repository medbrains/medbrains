import { Card, Group, NumberInput, Select, SimpleGrid, Stack, Switch, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { SofaResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { sofaService } from "@/services/sofa.service";

const CV_OPTIONS = [
  { value: "0", label: "0 — MAP ≥ 70" },
  { value: "1", label: "1 — MAP < 70" },
  { value: "2", label: "2 — dopamine ≤ 5 or any dobutamine" },
  { value: "3", label: "3 — dopamine > 5 / adr ≤ 0.1 / noradr ≤ 0.1" },
  { value: "4", label: "4 — dopamine > 15 / adr > 0.1 / noradr > 0.1" },
];

/** SOFA — six-system organ-dysfunction score. Five systems computed from values + the cardiovascular
 *  sub-score (vasopressor-dependent); the server sums them (0–24) and returns the mortality band. */
export function SofaTab() {
  const [pao2Fio2, setPao2Fio2] = useState<number>(400);
  const [support, setSupport] = useState(false);
  const [platelets, setPlatelets] = useState<number>(250);
  const [bilirubin, setBilirubin] = useState<number>(0.8);
  const [cv, setCv] = useState("0");
  const [gcs, setGcs] = useState<number>(15);
  const [creatinine, setCreatinine] = useState<number>(0.9);
  const [result, setResult] = useState<SofaResult | null>(null);

  const compute = useMutation({
    mutationFn: () =>
      sofaService.computeSofa({
        pao2_fio2: pao2Fio2,
        respiratory_support: support,
        platelets,
        bilirubin_mg_dl: bilirubin,
        cardiovascular_score: Number(cv),
        gcs,
        creatinine_mg_dl: creatinine,
      }),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  return (
    <Stack gap="md" maw={680}>
      <Text fw={600} size="sm">
        SOFA — organ dysfunction
      </Text>
      <Text size="xs" c="dimmed">
        Grades six organ systems 0–4 (total 0–24). Track the trend: a rise of ≥ 2 from baseline with
        suspected infection defines sepsis (Sepsis-3).
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <NumberInput
          label="PaO₂/FiO₂"
          description="mmHg"
          value={pao2Fio2}
          onChange={(v) => setPao2Fio2(typeof v === "number" ? v : 0)}
          min={0}
        />
        <NumberInput
          label="Platelets"
          description="×10³/µL"
          value={platelets}
          onChange={(v) => setPlatelets(typeof v === "number" ? v : 0)}
          min={0}
        />
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
          label="Creatinine"
          description="mg/dL"
          value={creatinine}
          onChange={(v) => setCreatinine(typeof v === "number" ? v : 0)}
          min={0}
          step={0.1}
          decimalScale={1}
        />
        <NumberInput
          label="GCS"
          description="3–15"
          value={gcs}
          onChange={(v) => setGcs(typeof v === "number" ? v : 0)}
          min={3}
          max={15}
        />
      </SimpleGrid>

      <Switch
        label="On respiratory support (enables the <200 / <100 sub-scores)"
        checked={support}
        onChange={(e) => setSupport(e.currentTarget.checked)}
      />
      <Select
        label="Cardiovascular sub-score"
        data={CV_OPTIONS}
        value={cv}
        onChange={(v) => v && setCv(v)}
        allowDeselect={false}
      />

      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Compute SOFA
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>SOFA {result.total} / 24</Text>
              <Badge
                tone={result.total >= 10 ? "danger" : result.total >= 7 ? "warning" : "success"}
              >
                mortality {result.mortality_band}
              </Badge>
            </Group>
            <Text size="sm">{result.response}</Text>
            <Text size="xs" c="dimmed">
              Resp {result.respiration} · coag {result.coagulation} · liver {result.liver} · CV{" "}
              {result.cardiovascular} · CNS {result.cns} · renal {result.renal}
            </Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
