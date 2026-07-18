// IPD DischargeTatTab — split from ipd.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { IpdDischargeTatLog } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, toast } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";

export function DischargeTatTab({ admissionId }: { admissionId: string }) {
  const canView = useHasPermission(P.IPD.DISCHARGE_TAT_VIEW);
  const queryClient = useQueryClient();

  const { data: tat, isLoading } = useQuery({
    queryKey: ["ipd-discharge-tat", admissionId],
    queryFn: () => ipdService.getDischargeTat(admissionId),
    enabled: canView,
  });

  const initMutation = useMutation({
    mutationFn: () => ipdService.initiateDischargeTat(admissionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-discharge-tat", admissionId] });
      toast.success("Discharge TAT tracking started", { title: "Initiated" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string>) => ipdService.updateDischargeTat(admissionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-discharge-tat", admissionId] });
      toast.success("Discharge milestone recorded", { title: "Updated" });
    },
  });

  if (!canView)
    return (
      <Text c="dimmed" size="sm">
        No permission to view discharge TAT.
      </Text>
    );
  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  const log = tat as IpdDischargeTatLog | null;

  if (!log) {
    return (
      <Stack>
        <Text c="dimmed" size="sm">
          Discharge TAT tracking has not been initiated for this admission.
        </Text>
        <Button
          tone="primary"
          size="sm"
          onClick={() => initMutation.mutate()}
          loading={initMutation.isPending}
        >
          Start Discharge TAT Tracking
        </Button>
      </Stack>
    );
  }

  const milestones = [
    {
      key: "discharge_initiated_at",
      label: "Discharge Initiated",
      value: log.discharge_initiated_at,
    },
    { key: "billing_cleared_at", label: "Billing Cleared", value: log.billing_cleared_at },
    { key: "pharmacy_cleared_at", label: "Pharmacy Cleared", value: log.pharmacy_cleared_at },
    { key: "nursing_cleared_at", label: "Nursing Cleared", value: log.nursing_cleared_at },
    { key: "doctor_cleared_at", label: "Doctor Cleared", value: log.doctor_cleared_at },
    {
      key: "discharge_completed_at",
      label: "Discharge Completed",
      value: log.discharge_completed_at,
    },
  ];

  return (
    <Stack>
      <Text fw={500}>Discharge TAT Timeline</Text>
      {log.total_tat_minutes != null && (
        <Badge size="lg" tone="primary">
          Total TAT: {log.total_tat_minutes} minutes
        </Badge>
      )}
      <Stack gap="xs">
        {milestones.map((m) => (
          <Group
            key={m.key}
            p="xs"
            style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 0 }}
            justify="space-between"
          >
            <Group>
              {m.value ? (
                <Badge tone="success" size="sm" variant="dot">
                  Done
                </Badge>
              ) : (
                <Badge tone="neutral" size="sm" variant="dot">
                  Pending
                </Badge>
              )}
              <Text size="sm">{m.label}</Text>
            </Group>
            {m.value ? (
              <Text size="xs" c="dimmed">
                {new Date(m.value).toLocaleString()}
              </Text>
            ) : (
              <Button
                tone="secondary"
                size="xs"
                onClick={() => updateMutation.mutate({ [m.key]: new Date().toISOString() })}
                loading={updateMutation.isPending}
              >
                Mark Complete
              </Button>
            )}
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Phase 3a — New Sub-Tabs
// ══════════════════════════════════════════════════════════
