import { Card, Divider, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { NutritionScreening } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, NumberField, Switch } from "@/components/ui";
import { nutritionScreeningService } from "@/services/nutritionScreening.service";

const riskTone = (risk: string) =>
  risk === "high" ? "danger" : risk === "medium" ? "warning" : "success";

function Panel({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const key = ["nutrition-screenings", patientId];
  const [height, setHeight] = useState<number | "">("");
  const [weight, setWeight] = useState<number | "">("");
  const [loss, setLoss] = useState<number | "">("");
  const [acute, setAcute] = useState(false);

  const { data: history = [] } = useQuery({
    queryKey: key,
    queryFn: () => nutritionScreeningService.listNutritionScreenings(patientId),
    enabled: !!patientId,
  });

  const create = useMutation({
    mutationFn: () =>
      nutritionScreeningService.createNutritionScreening({
        patient_id: patientId,
        height_cm: Number(height),
        weight_kg: Number(weight),
        weight_loss_percent: loss === "" ? 0 : Number(loss),
        acute_disease_no_intake: acute,
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: key });
      notifications.show({
        title: `MUST ${r.total_score} — ${r.risk.toUpperCase()} risk`,
        message:
          r.risk === "high"
            ? "Refer to dietitian; start nutrition care plan and monitor."
            : r.risk === "medium"
              ? "Observe: document intake for 3 days and rescreen."
              : "Low risk — rescreen weekly per policy.",
        color: riskTone(r.risk),
      });
      setLoss("");
      setAcute(false);
    },
    onError: (e: Error) =>
      notifications.show({ title: "Save failed", message: e.message, color: "danger" }),
  });

  const liveBmi =
    height !== "" && weight !== "" && Number(height) > 0
      ? Number(weight) / (Number(height) / 100) ** 2
      : null;
  const canSave = height !== "" && weight !== "" && Number(height) > 0 && Number(weight) > 0;

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        MUST screening
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <NumberField
          label="Height (cm)"
          value={height}
          onChange={(v) => setHeight(v === "" ? "" : Number(v))}
          min={50}
          max={260}
        />
        <NumberField
          label="Weight (kg)"
          value={weight}
          onChange={(v) => setWeight(v === "" ? "" : Number(v))}
          min={1}
          max={500}
          step={0.1}
          decimalScale={1}
        />
        <NumberField
          label="Unplanned weight loss (%)"
          value={loss}
          onChange={(v) => setLoss(v === "" ? "" : Number(v))}
          min={0}
          max={100}
          step={0.1}
          decimalScale={1}
        />
      </SimpleGrid>
      <Switch
        label="Acutely ill with no nutritional intake > 5 days"
        checked={acute}
        onChange={(e) => setAcute(e.currentTarget.checked)}
      />
      {liveBmi != null && (
        <Text size="sm">
          BMI <Badge tone={liveBmi < 18.5 ? "warning" : "neutral"}>{liveBmi.toFixed(1)}</Badge>
        </Text>
      )}
      <Button
        tone="primary"
        loading={create.isPending}
        disabled={!canSave}
        onClick={() => create.mutate()}
      >
        Save screening
      </Button>

      {history.length > 0 && (
        <Stack gap={4}>
          <Divider />
          <Text fw={600} size="sm">
            History
          </Text>
          {history.map((h: NutritionScreening) => (
            <Group key={h.id} justify="space-between">
              <Text size="xs" c="dimmed">
                {new Date(h.created_at).toLocaleString()} — BMI {h.bmi.toFixed(1)} · MUST{" "}
                {h.total_score}
              </Text>
              <Badge tone={riskTone(h.risk)}>{h.risk}</Badge>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

/** MUST nutritional screening (NABH admission requirement) for a selected patient. */
export function NutritionTab() {
  const [patientId, setPatientId] = useState("");
  return (
    <Stack gap="md" maw={680}>
      <PatientSearchSelect value={patientId} onChange={setPatientId} />
      {patientId ? (
        <Card withBorder padding="md">
          <Panel patientId={patientId} />
        </Card>
      ) : (
        <Text size="sm" c="dimmed">
          Select a patient to screen for malnutrition risk (MUST).
        </Text>
      )}
    </Stack>
  );
}
