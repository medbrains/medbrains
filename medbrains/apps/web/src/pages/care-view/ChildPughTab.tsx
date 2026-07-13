import { Card, Group, NumberInput, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { ChildPughResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { childPughService } from "@/services/childPugh.service";

const ASCITES = [
  { value: "none", label: "None (+1)" },
  { value: "mild", label: "Mild (+2)" },
  { value: "moderate_severe", label: "Moderate–severe (+3)" },
];

const ENCEPHALOPATHY = [
  { value: "none", label: "None (+1)" },
  { value: "grade_1_2", label: "Grade 1–2 (+2)" },
  { value: "grade_3_4", label: "Grade 3–4 (+3)" },
];

const CLASS_TONE: Record<string, "danger" | "warning" | "success"> = {
  C: "danger",
  B: "warning",
  A: "success",
};

/** Child-Pugh — cirrhosis severity (class A/B/C). Three labs + ascites + encephalopathy in; the
 *  server scores each 1–3 and classifies the total (5–15). */
export function ChildPughTab() {
  const [bilirubin, setBilirubin] = useState<number>(1);
  const [albumin, setAlbumin] = useState<number>(4);
  const [inr, setInr] = useState<number>(1);
  const [ascites, setAscites] = useState("none");
  const [encephalopathy, setEncephalopathy] = useState("none");
  const [result, setResult] = useState<ChildPughResult | null>(null);

  const compute = useMutation({
    mutationFn: () =>
      childPughService.computeChildPugh({
        bilirubin_mg_dl: bilirubin,
        albumin_g_dl: albumin,
        inr,
        ascites,
        encephalopathy,
      }),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  return (
    <Stack gap="md" maw={640}>
      <Text fw={600} size="sm">
        Child-Pugh — cirrhosis severity
      </Text>
      <Text size="xs" c="dimmed">
        Classifies chronic liver disease (A/B/C) to guide prognosis, procedural risk and
        hepatically-cleared drug dosing.
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
          label="Albumin"
          description="g/dL"
          value={albumin}
          onChange={(v) => setAlbumin(typeof v === "number" ? v : 0)}
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
      </SimpleGrid>

      <Select
        label="Ascites"
        data={ASCITES}
        value={ascites}
        onChange={(v) => v && setAscites(v)}
        allowDeselect={false}
      />
      <Select
        label="Hepatic encephalopathy"
        data={ENCEPHALOPATHY}
        value={encephalopathy}
        onChange={(v) => v && setEncephalopathy(v)}
        allowDeselect={false}
      />

      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Compute Child-Pugh
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>Child-Pugh {result.total} / 15</Text>
              <Badge tone={CLASS_TONE[result.class] ?? "neutral"}>Class {result.class}</Badge>
            </Group>
            <Text size="sm">{result.response}</Text>
            <Text size="xs" c="dimmed">
              Bilirubin {result.bilirubin_points} · albumin {result.albumin_points} · INR{" "}
              {result.inr_points} · ascites {result.ascites_points} · encephalopathy{" "}
              {result.encephalopathy_points}
            </Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
