// IPD NursingTab — split from ipd.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import type { IpdCarePlan, IpdHandoverReport } from "@medbrains/types";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";

export function NursingTab({ admissionId }: { admissionId: string }) {
  const { data: carePlans } = useQuery({
    queryKey: ["ipd-care-plans", admissionId],
    queryFn: () => ipdService.listCarePlans(admissionId),
  });
  const { data: handovers } = useQuery({
    queryKey: ["ipd-handovers", admissionId],
    queryFn: () => ipdService.listHandovers(admissionId),
  });

  const plans = (carePlans ?? []) as IpdCarePlan[];
  const reports = (handovers ?? []) as IpdHandoverReport[];

  return (
    <Stack>
      <Group justify="flex-end">
        <Button
          tone="secondary"
          size="xs"
          leftSection={<IconAlertTriangle size={14} />}
          component="a"
          href="/quality"
          target="_blank"
        >
          Report Incident
        </Button>
      </Group>

      <Text fw={600} size="sm">
        Care Plans
      </Text>
      {plans.map((cp) => (
        <Stack
          key={cp.id}
          gap={4}
          p="xs"
          style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 0 }}
        >
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              {cp.nursing_diagnosis}
            </Text>
            <Badge
              size="xs"
              tone={
                cp.status === "active" ? "success" : cp.status === "resolved" ? "neutral" : "danger"
              }
            >
              {cp.status}
            </Badge>
          </Group>
          {cp.goals && <Text size="xs">Goals: {cp.goals}</Text>}
          {cp.evaluation && <Text size="xs">Eval: {cp.evaluation}</Text>}
        </Stack>
      ))}
      {plans.length === 0 && (
        <Text c="dimmed" size="sm">
          No care plans yet.
        </Text>
      )}

      <Text fw={600} size="sm" mt="md">
        Handover Reports (ISBAR)
      </Text>
      {reports.map((h) => (
        <Stack
          key={h.id}
          gap={4}
          p="xs"
          style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 0 }}
        >
          <Group justify="space-between">
            <Badge size="xs">{h.shift} shift</Badge>
            <Text size="xs" c="dimmed">
              {h.handover_date}
            </Text>
            {h.acknowledged_at && (
              <Badge size="xs" tone="success">
                Acknowledged
              </Badge>
            )}
          </Group>
          {h.situation && (
            <Text size="xs">
              <b>S:</b> {h.situation}
            </Text>
          )}
          {h.background && (
            <Text size="xs">
              <b>B:</b> {h.background}
            </Text>
          )}
          {h.assessment && (
            <Text size="xs">
              <b>A:</b> {h.assessment}
            </Text>
          )}
          {h.recommendation && (
            <Text size="xs">
              <b>R:</b> {h.recommendation}
            </Text>
          )}
        </Stack>
      ))}
      {reports.length === 0 && (
        <Text c="dimmed" size="sm">
          No handover reports yet.
        </Text>
      )}
    </Stack>
  );
}

// ── Attenders ──────────────────────────────────────────
