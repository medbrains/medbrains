import { Card, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { WellsDvtRequest, WellsDvtResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Switch } from "@/components/ui";
import { wellsDvtService } from "@/services/wellsDvt.service";

type CriterionKey = Exclude<keyof WellsDvtRequest, never>;

const CRITERIA: { key: CriterionKey; label: string; points: string }[] = [
  {
    key: "active_cancer",
    label: "Active cancer (treatment ≤ 6 months / palliative)",
    points: "+1",
  },
  {
    key: "paralysis_or_immobilisation",
    label: "Paralysis, paresis or recent plaster cast",
    points: "+1",
  },
  {
    key: "bedridden_or_surgery",
    label: "Bedridden ≥ 3 days or surgery within 12 weeks",
    points: "+1",
  },
  { key: "localized_tenderness", label: "Localised tenderness along deep veins", points: "+1" },
  { key: "entire_leg_swollen", label: "Entire leg swollen", points: "+1" },
  { key: "calf_swelling_3cm", label: "Calf swelling ≥ 3 cm vs other leg", points: "+1" },
  { key: "pitting_edema", label: "Pitting oedema (symptomatic leg)", points: "+1" },
  { key: "collateral_veins", label: "Collateral (non-varicose) superficial veins", points: "+1" },
  { key: "previous_dvt", label: "Previously documented DVT", points: "+1" },
  { key: "alternative_diagnosis", label: "Alternative diagnosis at least as likely", points: "−2" },
];

const TIER_TONE: Record<string, "danger" | "warning" | "success"> = {
  high: "danger",
  moderate: "warning",
  low: "success",
};

/** Wells DVT — pre-test probability for suspected deep vein thrombosis. Criteria in; the server
 *  scores them (incl. the −2 alternative-diagnosis) and returns the two-tier workup decision. */
export function WellsDvtTab() {
  const [criteria, setCriteria] = useState<Record<CriterionKey, boolean>>({
    active_cancer: false,
    paralysis_or_immobilisation: false,
    bedridden_or_surgery: false,
    localized_tenderness: false,
    entire_leg_swollen: false,
    calf_swelling_3cm: false,
    pitting_edema: false,
    collateral_veins: false,
    previous_dvt: false,
    alternative_diagnosis: false,
  });
  const [result, setResult] = useState<WellsDvtResult | null>(null);

  const compute = useMutation({
    mutationFn: () => wellsDvtService.computeWellsDvt(criteria),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  return (
    <Stack gap="md" maw={640}>
      <Text fw={600} size="sm">
        Wells score — suspected DVT
      </Text>
      <Text size="xs" c="dimmed">
        Pre-test probability for a suspected leg DVT. Drives the next step: D-dimer if DVT is
        unlikely, compression ultrasound if likely.
      </Text>

      {CRITERIA.map((c) => (
        <Switch
          key={c.key}
          label={`${c.label} (${c.points})`}
          checked={criteria[c.key]}
          onChange={(e) => setCriteria((p) => ({ ...p, [c.key]: e.currentTarget.checked }))}
        />
      ))}

      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Compute Wells DVT
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>Wells DVT {result.score}</Text>
              <Group gap="xs">
                <Badge tone={TIER_TONE[result.risk_tier] ?? "neutral"}>
                  {result.risk_tier} probability
                </Badge>
                <Badge tone={result.dvt_likely ? "danger" : "success"}>
                  {result.dvt_likely ? "DVT likely" : "DVT unlikely"}
                </Badge>
              </Group>
            </Group>
            <Text size="sm" fw={500}>
              {result.recommended_workup}
            </Text>
            <Text size="sm">{result.response}</Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
