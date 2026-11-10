// The insurance settlements queue's columns: who, claim vs bill vs
// settlement, where it came from, and the actions the viewer may take.

import { Group, Stack, Text } from "@mantine/core";
import type { ClaimSettlementPosting, ClaimSettlementStatus } from "@medbrains/types";
import { IconArrowBackUp, IconCheck, IconX } from "@tabler/icons-react";
import type { Column } from "@/components";
import { rupees } from "@/components/payments/collect/collect-math";
import { Badge, type BadgeTone, IconButton, Tooltip } from "@/components/ui";
import { canDecide, SETTLEMENT_SOURCE_LABELS, settlementView } from "@/lib/claim-settlements";
import type { DecisionKind } from "./DecisionModal";

const STATUS_LABEL: Record<ClaimSettlementStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  reversed: "Reversed",
};

const STATUS_TONE: Record<ClaimSettlementStatus, BadgeTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  reversed: "neutral",
};

interface ColumnOptions {
  userId: string | undefined;
  canApprove: boolean;
  canReverse: boolean;
  onDecide: (kind: DecisionKind, posting: ClaimSettlementPosting) => void;
}

function Actions({ row, o }: { row: ClaimSettlementPosting; o: ColumnOptions }) {
  if (row.status === "approved" && o.canReverse) {
    return (
      <Tooltip label="Reverse this posting">
        <IconButton aria-label="Reverse posting" onClick={() => o.onDecide("reverse", row)}>
          <IconArrowBackUp size={16} />
        </IconButton>
      </Tooltip>
    );
  }
  if (row.status !== "pending" || !o.canApprove) return null;
  if (!canDecide(row, o.userId)) {
    return (
      <Text size="xs" c="dimmed">
        You recorded it — needs a second approver
      </Text>
    );
  }
  return (
    <Group gap={4} wrap="nowrap">
      <Tooltip label="Review and approve">
        <IconButton
          tone="success"
          aria-label="Review and approve"
          onClick={() => o.onDecide("approve", row)}
        >
          <IconCheck size={16} />
        </IconButton>
      </Tooltip>
      <Tooltip label="Reject">
        <IconButton tone="danger" aria-label="Reject" onClick={() => o.onDecide("reject", row)}>
          <IconX size={16} />
        </IconButton>
      </Tooltip>
    </Group>
  );
}

export function settlementColumns(o: ColumnOptions): Column<ClaimSettlementPosting>[] {
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
      key: "claim",
      label: "Claim",
      render: (r) => (
        <Stack gap={0}>
          <Text size="sm">{r.claim_number ?? "No claim number"}</Text>
          <Text size="xs" c="dimmed">
            {r.payer ?? "Insurer"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "bill",
      label: "Bill",
      render: (r) => {
        const v = settlementView(r);
        return (
          <Stack gap={0}>
            <Text size="sm" ff="monospace">
              {r.invoice_number}
            </Text>
            <Text size="xs" c="dimmed">
              {rupees(Number(r.invoice_total))} · open {rupees(v.open)}
            </Text>
          </Stack>
        );
      },
    },
    {
      key: "settled",
      label: "Settled",
      render: (r) => {
        const v = settlementView(r);
        return (
          <Stack gap={0}>
            <Text size="sm" fw={600}>
              {rupees(v.settled)}
            </Text>
            <Text size="xs" c="dimmed">
              TDS {rupees(v.tds)} · deductions {rupees(Number(r.deduction_total))}
            </Text>
          </Stack>
        );
      },
    },
    {
      key: "reference",
      label: "UTR / date",
      render: (r) => (
        <Stack gap={0}>
          <Text size="sm" ff="monospace">
            {r.payment_reference ?? "—"}
          </Text>
          <Text size="xs" c="dimmed">
            {r.settlement_date ?? ""}
          </Text>
        </Stack>
      ),
    },
    {
      key: "source",
      label: "From",
      render: (r) => (
        <Stack gap={0}>
          <Text size="sm">{SETTLEMENT_SOURCE_LABELS[r.source]}</Text>
          <Text size="xs" c="dimmed">
            {r.recorded_by_name ?? "System"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Stack gap={4} align="flex-start">
          <Badge size="sm" tone={STATUS_TONE[r.status]} miw={88}>
            {STATUS_LABEL[r.status]}
          </Badge>
          {r.needs_review && (
            <Tooltip label={r.review_reason ?? "Needs review"}>
              <Badge size="sm" tone="warning" variant="outline">
                Needs review
              </Badge>
            </Tooltip>
          )}
        </Stack>
      ),
    },
    { key: "actions", label: "Actions", render: (r) => <Actions row={r} o={o} /> },
  ];
}
