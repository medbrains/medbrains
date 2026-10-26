// The ward's early-warning escalations: who is deteriorating, how long it
// has waited, and the acknowledgement that records what was done.

import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type EwsEscalation, P } from "@medbrains/types";
import { IconBellCheck } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { type Column, DataTable } from "@/components";
import { AcknowledgeEscalationModal } from "@/components/EarlyWarning/AcknowledgeEscalationModal";
import {
  EWS_BAND_LABEL,
  EWS_BAND_TONE,
  EWS_RESPONSE_LABEL,
  EWS_TOOL_LABEL,
  ewsTotalText,
} from "@/components/EarlyWarning/ews-display";
import { Badge, Button, SegmentedControl } from "@/components/ui";
import { careViewService } from "@/services/careView.service";

type Status = "open" | "acknowledged" | "all";

const minutesAgo = (iso: string) =>
  Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));

export function EscalationsTab({
  wardId,
  focusId,
}: {
  wardId: string | null;
  focusId: string | null;
}) {
  const canAck = useHasPermission(P.NURSE.EWS.ACKNOWLEDGE);
  const [status, setStatus] = useState<Status>("open");
  const [acking, setAcking] = useState<EwsEscalation | null>(null);
  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["care-view", "ews-escalations", status, wardId],
    queryFn: () =>
      careViewService.listEwsEscalations({ status, ...(wardId ? { ward_id: wardId } : {}) }),
    // A ward board: refreshed while open, bounded to every 30 seconds.
    refetchInterval: 30_000,
  });
  const columns: Column<EwsEscalation>[] = [
    {
      key: "patient",
      label: "Patient",
      render: (r) => (
        <Stack gap={0}>
          <Text size="sm" fw={r.id === focusId ? 700 : 400}>
            {r.patient_name}
          </Text>
          <Text size="xs" c="dimmed" ff="monospace">
            {r.uhid} · {r.ward_name ?? "—"} {r.bed_name ?? ""}
          </Text>
        </Stack>
      ),
    },
    {
      key: "score",
      label: "Score",
      render: (r) => (
        <Group gap={4}>
          <Text size="sm" fw={600}>
            {EWS_TOOL_LABEL[r.ews_tool]} {ewsTotalText(r.ews_total, r.incomplete)}
          </Text>
          <Badge tone={EWS_BAND_TONE[r.band]}>{EWS_BAND_LABEL[r.band]}</Badge>
        </Group>
      ),
    },
    {
      key: "waiting",
      label: "Raised",
      render: (r) => (
        <Stack gap={0}>
          <Text size="sm">{minutesAgo(r.created_at)} min ago</Text>
          {r.status === "open" && (
            <Text size="xs" c={r.level > 0 ? "danger" : "dimmed"}>
              {r.level > 0 ? `Escalated ${r.level}×` : "Not yet escalated further"}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "response",
      label: "Response",
      render: (r) =>
        r.status === "acknowledged" && r.response_action ? (
          <Stack gap={0}>
            <Text size="sm">{EWS_RESPONSE_LABEL[r.response_action]}</Text>
            <Text size="xs" c="dimmed">
              {r.acknowledged_by_name} — {r.response_note}
            </Text>
          </Stack>
        ) : r.status === "open" && canAck ? (
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconBellCheck size={14} />}
            onClick={() => setAcking(r)}
          >
            Acknowledge
          </Button>
        ) : (
          <Badge tone={r.status === "open" ? "danger" : "neutral"}>{r.status}</Badge>
        ),
    },
  ];
  return (
    <Stack>
      <SegmentedControl
        aria-label="Escalation status"
        data={[
          { value: "open", label: "Open" },
          { value: "acknowledged", label: "Acknowledged" },
          { value: "all", label: "All" },
        ]}
        value={status}
        onChange={(v) => setStatus(v as Status)}
      />
      <DataTable
        columns={columns}
        data={data}
        loading={isLoading}
        error={error}
        onRetry={() => refetch()}
        rowKey={(r) => r.id}
        emptyTitle={status === "open" ? "No open escalations" : "No escalations"}
        caption="Early-warning escalations"
        captionVisuallyHidden
      />
      {acking && <AcknowledgeEscalationModal escalation={acking} onClose={() => setAcking(null)} />}
    </Stack>
  );
}
