// The insurance desk's alerts on the TPA screen: pre-auths whose running bill
// has reached 80% of the approval (action: request an enhancement), and rooms
// above the policy's room rent limit (action: record the family's consent).
// Hidden, and never fetched, without the kind's view permission. A failed
// load is shown as a fault, never as "nothing here".

import { Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type RevenueAlert, type RevenueAlertKind } from "@medbrains/types";
import { IconArrowUpRight, IconSignature } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { type Column, DataTable } from "@/components";
import { Badge, Button, Card } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { EnhancementModal } from "./EnhancementModal";
import { RoomConsentModal } from "./RoomConsentModal";
import { evidenceNumber, inr, isUnknown, percentUsed, REASON_LABEL } from "./revenue-alerts-labels";

interface KindCopy {
  title: string;
  blurb: string;
  empty: string;
  amountLabel: string;
  actionLabel: string;
  view: string;
  act: string;
}

const COPY: Record<RevenueAlertKind, KindCopy> = {
  preauth_used_up: {
    title: "Pre-auths nearly used up",
    blurb:
      "The running bill has reached 80% of the approved amount. Ask for an enhancement before the bill passes it.",
    empty: "No pre-auth is near its approved amount",
    amountLabel: "Bill so far",
    actionLabel: "Request enhancement",
    view: P.INSURANCE.ENHANCEMENT.VIEW,
    act: P.INSURANCE.ENHANCEMENT.REQUEST,
  },
  room_over_limit: {
    title: "Rooms above the policy limit",
    blurb:
      "The insurer may cut every room-linked charge in proportion. Record the family's consent, or move the patient.",
    empty: "No patient is in a room above their policy limit",
    amountLabel: "Expected cut",
    actionLabel: "Record consent",
    view: P.INSURANCE.ROOM_ELIGIBILITY.VIEW,
    act: P.INSURANCE.ROOM_ELIGIBILITY.RESOLVE,
  },
};

/** What the row's numbers say, in one line. */
function detail(row: RevenueAlert): string {
  if (row.kind === "preauth_used_up") {
    const used = percentUsed(row);
    return `Approved ${inr(evidenceNumber(row, "approved_amount"))}${used === null ? "" : ` · ${used}% used`}`;
  }
  return `Room ${inr(evidenceNumber(row, "room_rate"))}/day · allowed ${inr(evidenceNumber(row, "eligible_rate"))}`;
}

/** The kind's columns; the action shows only to someone who may take it. */
function columns(
  copy: KindCopy,
  canAct: boolean,
  onAct: (r: RevenueAlert) => void,
): Column<RevenueAlert>[] {
  return [
    {
      key: "patient",
      label: "Patient",
      render: (r) => (
        <Stack gap={0}>
          <Text size="sm">{r.patient_name}</Text>
          <Text size="xs" ff="monospace" c="dimmed">
            {r.uhid} · {r.payer ?? "Payer not recorded"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "reason",
      label: "Alert",
      render: (r) => (
        <Stack gap={2}>
          <Badge tone={isUnknown(r) ? "danger" : "warning"} size="sm">
            {REASON_LABEL[r.reason]}
          </Badge>
          {!isUnknown(r) && (
            <Text size="xs" c="dimmed">
              {detail(r)}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "amount",
      label: copy.amountLabel,
      render: (r) => (
        <Text size="sm" ff="monospace">
          {r.amount === null ? "—" : inr(r.amount)}
        </Text>
      ),
    },
    {
      key: "action",
      label: "Action",
      render: (r) =>
        canAct && !(r.reason === "room_eligibility_unknown") ? (
          <Button
            tone="secondary"
            size="xs"
            leftSection={
              r.kind === "preauth_used_up" ? (
                <IconArrowUpRight size={16} />
              ) : (
                <IconSignature size={16} />
              )
            }
            onClick={() => onAct(r)}
          >
            {copy.actionLabel}
          </Button>
        ) : null,
    },
  ];
}

/** One kind's open alerts with their action. */
export function RevenueAlertsPanel({ kind }: { kind: RevenueAlertKind }) {
  const copy = COPY[kind];
  const canView = useHasPermission(copy.view);
  const canAct = useHasPermission(copy.act);
  const [acting, setActing] = useState<RevenueAlert | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["billing", "revenue-alerts", kind],
    queryFn: () => billingService.listRevenueAlerts({ kind }),
    enabled: canView,
    refetchInterval: 60_000,
  });
  const cols = useMemo(() => columns(copy, canAct, setActing), [copy, canAct]);
  if (!canView) return null;
  return (
    <Card padding="md">
      <Stack gap="xs">
        <Text fw={600}>{copy.title}</Text>
        <Text size="sm" c="dimmed">
          {copy.blurb}
        </Text>
        <DataTable
          columns={cols}
          data={data ?? []}
          loading={isLoading}
          error={error}
          onRetry={() => refetch()}
          rowKey={(row) => row.id}
          emptyTitle={copy.empty}
          caption={copy.title}
          captionVisuallyHidden
        />
      </Stack>
      {acting && kind === "preauth_used_up" && (
        <EnhancementModal alert={acting} onClose={() => setActing(null)} />
      )}
      {acting && kind === "room_over_limit" && (
        <RoomConsentModal alert={acting} onClose={() => setActing(null)} />
      )}
    </Card>
  );
}
