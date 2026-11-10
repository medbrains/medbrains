// A patient's scoring plan, shown with their vitals: which SpO₂ scale and
// which tool their readings are scored with, who set it and why.

import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card } from "@/components/ui";
import { nurseActivitiesService } from "@/services/nurseActivities.service";
import { EwsPlanModal } from "./EwsPlanModal";
import { EWS_TOOL_LABEL } from "./ews-display";

export function EwsPlanCard({ encounterId }: { encounterId: string }) {
  const canView = useHasPermission(P.NURSE.EWS.VIEW);
  const canPlan = useHasPermission(P.NURSE.EWS.PLAN);
  const [opened, modal] = useDisclosure(false);
  const { data: plan } = useQuery({
    queryKey: ["ews-plan", encounterId],
    queryFn: () => nurseActivitiesService.getEwsPlan(encounterId),
    enabled: canView && encounterId.length > 0,
  });
  if (!canView || !encounterId) return null;
  return (
    <Card withBorder padding="sm">
      <Group justify="space-between">
        <Stack gap={2}>
          <Group gap="xs">
            <Text fw={600} size="sm">
              Scoring plan
            </Text>
            <Badge tone={plan?.spo2_scale2 ? "warning" : "neutral"}>
              {plan?.spo2_scale2 ? `SpO₂ Scale 2 · ${plan.scale2_target}` : "SpO₂ Scale 1"}
            </Badge>
            <Badge tone="neutral">
              {plan?.tool_override
                ? EWS_TOOL_LABEL[plan.tool_override]
                : "Tool by age and pregnancy"}
            </Badge>
          </Group>
          {plan?.set_by_name && (
            <Text size="xs" c="dimmed">
              Set by {plan.set_by_name} — {plan.reason}
            </Text>
          )}
        </Stack>
        {canPlan && (
          <Button tone="secondary" size="xs" onClick={modal.open}>
            Change plan
          </Button>
        )}
      </Group>
      {canPlan && <EwsPlanModal encounterId={encounterId} opened={opened} onClose={modal.close} />}
    </Card>
  );
}
