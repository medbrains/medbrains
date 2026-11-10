// The score a reading was given: tool, total, band, each parameter's zone,
// what was not charted, when the next set is due and whether it escalated.

import { Group, Stack, Text } from "@mantine/core";
import type { EwsView } from "@medbrains/types";
import { IconAlertTriangle, IconBellRinging } from "@tabler/icons-react";
import { Alert, Badge, Card } from "@/components/ui";
import {
  EWS_BAND_LABEL,
  EWS_BAND_TONE,
  EWS_PARAM_LABEL,
  EWS_TOOL_LABEL,
  EWS_ZONE_TONE,
  ewsTotalText,
} from "./ews-display";

export function EwsResultCard({ ews }: { ews: EwsView }) {
  const due = new Date(ews.next_due_at).toLocaleString();
  return (
    <Card withBorder padding="md" aria-live="polite">
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={700}>
              {EWS_TOOL_LABEL[ews.tool]} {ewsTotalText(ews.total, ews.incomplete)}
            </Text>
            <Badge tone={EWS_BAND_TONE[ews.band]}>{EWS_BAND_LABEL[ews.band]}</Badge>
            {ews.spo2_scale === 2 && <Badge tone="neutral">SpO₂ Scale 2</Badge>}
            {ews.age_band && <Badge tone="neutral">Chart {ews.age_band}</Badge>}
          </Group>
          <Text size="sm">Next full set due {due}</Text>
        </Group>
        <Group gap={6} wrap="wrap">
          {ews.params.map((p) => (
            <Badge key={p.name} tone={EWS_ZONE_TONE[p.zone]} variant="light">
              {EWS_PARAM_LABEL[p.name] ?? p.name}: {p.score} ({p.zone})
            </Badge>
          ))}
        </Group>
        {ews.incomplete && (
          <Alert tone="warning" icon={<IconAlertTriangle size={16} />} title="Incomplete set">
            Not charted: {ews.missing.map((m) => EWS_PARAM_LABEL[m] ?? m).join(", ")}. The score is
            at least {ews.total}; chart the rest as soon as you can.
          </Alert>
        )}
        {ews.escalation_id && (
          <Alert tone="danger" icon={<IconBellRinging size={16} />} title="Escalated">
            The nurse in charge and the doctors responsible have been told. It waits for an
            acknowledgement on the care view and goes further if nobody responds.
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
