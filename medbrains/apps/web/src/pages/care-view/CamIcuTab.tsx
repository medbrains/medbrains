import { Card, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CamIcuResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Select, Switch } from "@/components/ui";
import { camIcuService } from "@/services/camIcu.service";

// RASS -5 (unarousable) .. +4 (combative); 0 is alert and calm. CAM-ICU cannot be scored at -4/-5.
const RASS_OPTIONS = [
  { value: "4", label: "+4 Combative" },
  { value: "3", label: "+3 Very agitated" },
  { value: "2", label: "+2 Agitated" },
  { value: "1", label: "+1 Restless" },
  { value: "0", label: "0 Alert and calm" },
  { value: "-1", label: "-1 Drowsy" },
  { value: "-2", label: "-2 Light sedation" },
  { value: "-3", label: "-3 Moderate sedation" },
  { value: "-4", label: "-4 Deep sedation" },
  { value: "-5", label: "-5 Unarousable" },
];

/** CAM-ICU — RASS-gated delirium screen. Feature values in; the server applies the diagnostic tree
 *  (Feature 1 AND Feature 2 AND (Feature 3 OR Feature 4)) and returns the delirium result. */
export function CamIcuTab() {
  const [rass, setRass] = useState("0");
  const [acute, setAcute] = useState(false);
  const [inattention, setInattention] = useState(false);
  const [disorganized, setDisorganized] = useState(false);
  const [result, setResult] = useState<CamIcuResult | null>(null);

  const compute = useMutation({
    mutationFn: () =>
      camIcuService.computeCamIcu({
        rass: Number(rass),
        acute_change_or_fluctuating: acute,
        inattention,
        disorganized_thinking: disorganized,
      }),
    onSuccess: setResult,
    onError: (e: Error) =>
      notifications.show({ title: "Could not compute", message: e.message, color: "danger" }),
  });

  return (
    <Stack gap="md" maw={640}>
      <Text fw={600} size="sm">
        CAM-ICU — delirium screen
      </Text>
      <Text size="xs" c="dimmed">
        Screen every ICU patient at least once per shift. Establish arousal with RASS first — at
        RASS -4 or -5 the patient is too sedated and CAM-ICU cannot be assessed.
      </Text>

      <Select
        label="RASS (sedation / agitation level)"
        data={RASS_OPTIONS}
        value={rass}
        onChange={(v) => v && setRass(v)}
        allowDeselect={false}
      />

      <Switch
        label="Feature 1 — acute change in mental status or a fluctuating course"
        checked={acute}
        onChange={(e) => setAcute(e.currentTarget.checked)}
      />
      <Switch
        label="Feature 2 — inattention (errors on the attention screen)"
        checked={inattention}
        onChange={(e) => setInattention(e.currentTarget.checked)}
      />
      <Switch
        label="Feature 4 — disorganised thinking (errors on yes/no questions + command)"
        checked={disorganized}
        onChange={(e) => setDisorganized(e.currentTarget.checked)}
      />
      <Text size="xs" c="dimmed">
        Feature 3 (altered level of consciousness) is taken automatically from the RASS — any value
        other than 0.
      </Text>

      <Button tone="primary" loading={compute.isPending} onClick={() => compute.mutate()}>
        Screen for delirium
      </Button>

      {result && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>CAM-ICU (RASS {result.rass})</Text>
              <Badge
                tone={
                  !result.assessable ? "neutral" : result.delirium_present ? "danger" : "success"
                }
              >
                {!result.assessable
                  ? "Unable to assess"
                  : result.delirium_present
                    ? "POSITIVE — delirium"
                    : "Negative"}
              </Badge>
            </Group>
            <Text size="sm">{result.response}</Text>
            {result.assessable && (
              <Text size="xs" c="dimmed">
                Feature 1 {result.feature1_acute_or_fluctuating ? "✓" : "—"} · Feature 2{" "}
                {result.feature2_inattention ? "✓" : "—"} · Feature 3 (LOC){" "}
                {result.feature3_altered_loc ? "✓" : "—"} · Feature 4{" "}
                {result.feature4_disorganized_thinking ? "✓" : "—"}
              </Text>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
