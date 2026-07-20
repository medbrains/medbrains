// Home-healthcare EscalationsPanel — split from home-healthcare.tsx (pure move).

import { Group, Modal, Select, Stack, Text, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { BadgeTone } from "@/components/ui";
import { Badge, Button, toast } from "@/components/ui";
import { homeHealthService } from "@/services/homeHealth.service";

export function EscalationsPanel({
  patientId,
  canManage,
}: {
  patientId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [raiseOpen, raise] = useDisclosure(false);
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState<string | null>("high");

  const { data = [] } = useQuery({
    queryKey: ["home-escalations", patientId],
    queryFn: () => homeHealthService.listEscalations(patientId),
    refetchInterval: 30_000,
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["home-escalations", patientId] });
  };
  const raiseM = useMutation({
    mutationFn: () =>
      homeHealthService.raiseEscalation({
        patient_id: patientId,
        reason,
        severity: severity ?? undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Escalation raised", { title: "Home healthcare" });
      raise.close();
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const updateM = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      homeHealthService.updateEscalation(v.id, { status: v.status }),
    onSuccess: () => {
      invalidate();
      toast.success("Escalation updated", { title: "Home healthcare" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  const sevTone = (s: string): BadgeTone =>
    s === "critical" ? "danger" : s === "high" ? "warning" : "neutral";
  const statTone = (s: string): BadgeTone => {
    if (s === "resolved") return "success";
    if (s === "ambulance_requested") return "warning";
    if (s === "cancelled") return "neutral";
    return "danger";
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fw={600} size="sm">
          Emergency escalations
        </Text>
        {canManage && (
          <Button size="xs" tone="danger" onClick={raise.open}>
            Raise escalation
          </Button>
        )}
      </Group>
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No escalations.
        </Text>
      ) : (
        data.map((e) => (
          <Group key={e.id} justify="space-between">
            <Stack gap={0}>
              <Group gap={6}>
                <Badge tone={sevTone(e.severity)} size="xs">
                  {e.severity}
                </Badge>
                <Badge tone={statTone(e.status)} size="xs">
                  {e.status}
                </Badge>
                <Text size="sm">{e.reason}</Text>
              </Group>
              <Text size="xs" c="dimmed">
                {new Date(e.created_at).toLocaleString()}
              </Text>
            </Stack>
            {canManage && (e.status === "raised" || e.status === "ambulance_requested") && (
              <Group gap="xs">
                {e.status === "raised" && (
                  <Button
                    size="xs"
                    tone="danger"
                    onClick={() => updateM.mutate({ id: e.id, status: "ambulance_requested" })}
                  >
                    Request ambulance
                  </Button>
                )}
                <Button
                  size="xs"
                  tone="secondary"
                  onClick={() => updateM.mutate({ id: e.id, status: "resolved" })}
                >
                  Resolve
                </Button>
              </Group>
            )}
          </Group>
        ))
      )}
      <Modal opened={raiseOpen} onClose={raise.close} title="Raise emergency escalation">
        <Stack gap="sm">
          <Textarea
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            placeholder="SpO2 87% (< 92 threshold)"
            minRows={2}
          />
          <Select
            label="Severity"
            data={["low", "medium", "high", "critical"].map((v) => ({ value: v, label: v }))}
            value={severity}
            onChange={setSeverity}
          />
          <Button
            tone="danger"
            onClick={() => raiseM.mutate()}
            loading={raiseM.isPending}
            disabled={!reason.trim()}
          >
            Raise
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
