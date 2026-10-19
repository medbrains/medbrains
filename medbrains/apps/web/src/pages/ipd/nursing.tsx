// IPD NursingTab — admission nursing assessment, care plans, shift handovers.

import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { IpdHandoverReport } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import { NursingAssessmentSection } from "./nursing-assessment-section";
import { CarePlansSection } from "./nursing-care-plans";

export function NursingTab({ admissionId }: { admissionId: string }) {
  // Shift handovers carry their own read code.
  // An empty handover list reads as "nothing was handed over".
  const canListHandovers = useHasPermission(P.IPD.HANDOVER_LIST);

  const { data: handovers } = useQuery({
    queryKey: ["ipd-handovers", admissionId],
    queryFn: () => ipdService.listHandovers(admissionId),
    enabled: canListHandovers,
  });

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

      <NursingAssessmentSection admissionId={admissionId} />
      <CarePlansSection admissionId={admissionId} />

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
