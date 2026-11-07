// The charge attention queue's columns: who, what charge, where it came from,
// why it is here, and what the viewer may do about it.

import { Group, Stack, Text } from "@mantine/core";
import type { ChargeAttentionItem } from "@medbrains/types";
import { IconReceipt, IconX } from "@tabler/icons-react";
import type { Column } from "@/components";
import { Badge, IconButton, Tooltip } from "@/components/ui";
import { moduleLabel, reasonLabel, STATUS_LABEL, STATUS_TONE } from "./charge-attention-labels";

export type ChargeAttentionAction = "post" | "dismiss";

interface ColumnOptions {
  canResolve: boolean;
  pendingId: string | null;
  onAction: (kind: ChargeAttentionAction, item: ChargeAttentionItem) => void;
}

/** Post and dismiss buttons, only on an open item and only for a resolver. */
function Actions({ row, o }: { row: ChargeAttentionItem; o: ColumnOptions }) {
  if (row.status !== "open" || !o.canResolve) return null;
  return (
    <Group gap={4} wrap="nowrap">
      <Tooltip label="Post this charge to the patient's bill">
        <IconButton
          tone="success"
          aria-label="Post charge"
          loading={o.pendingId === row.id}
          onClick={() => o.onAction("post", row)}
        >
          <IconReceipt size={16} />
        </IconButton>
      </Tooltip>
      <Tooltip label="Dismiss with a reason">
        <IconButton tone="danger" aria-label="Dismiss" onClick={() => o.onAction("dismiss", row)}>
          <IconX size={16} />
        </IconButton>
      </Tooltip>
    </Group>
  );
}

/** Who resolved the item and, when dismissed, why. */
function Resolution({ row }: { row: ChargeAttentionItem }) {
  if (row.status === "open") return null;
  return (
    <Text size="xs" c="dimmed">
      {row.resolved_by_name ?? "Someone"}
      {row.dismiss_reason ? ` · ${row.dismiss_reason}` : ""}
    </Text>
  );
}

/** The queue table's columns for the given viewer and in-flight post. */
export function chargeAttentionColumns(o: ColumnOptions): Column<ChargeAttentionItem>[] {
  return [
    {
      key: "patient",
      label: "Patient",
      render: (r) => (
        <Stack gap={0}>
          <Text size="sm">{r.patient_name}</Text>
          <Text size="xs" ff="monospace" c="dimmed">
            {r.uhid}
          </Text>
        </Stack>
      ),
    },
    {
      key: "charge",
      label: "Charge",
      render: (r) => (
        <Stack gap={0}>
          <Text size="sm">{r.description_override ?? r.charge_code}</Text>
          <Text size="xs" ff="monospace" c="dimmed">
            {r.charge_code} × {r.quantity}
          </Text>
        </Stack>
      ),
    },
    {
      key: "from",
      label: "From",
      render: (r) => (
        <Stack gap={0}>
          <Text size="sm">{moduleLabel(r.source_module)}</Text>
          <Text size="xs" ff="monospace" c="dimmed">
            {new Date(r.created_at).toLocaleString()} · {r.created_by_name ?? "System"}
          </Text>
        </Stack>
      ),
    },
    { key: "reason", label: "Why", render: (r) => <Text size="sm">{reasonLabel(r.reason)}</Text> },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Stack gap={4} align="flex-start">
          <Badge size="sm" tone={STATUS_TONE[r.status]}>
            {STATUS_LABEL[r.status]}
          </Badge>
          <Resolution row={r} />
        </Stack>
      ),
    },
    { key: "actions", label: "Actions", render: (r) => <Actions row={r} o={o} /> },
  ];
}
