// The insurance desk's alerts on the TPA screen: pre-auths whose running bill
// has reached the hospital's alert share of the approval, or all of it
// (action: request an enhancement), insured inpatients with no usable pre-auth
// (action: raise or renew it on the pre-auth screen, or dismiss the alert with
// why none is needed: cash, not covered), and rooms above the
// policy's room rent limit (action: record the family's consent).
// Hidden, and never fetched, without the kind's view permission. A failed
// load is shown as a fault, never as "nothing here".

import { Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type RevenueAlert, type RevenueAlertKind } from "@medbrains/types";
import { IconArrowUpRight, IconSignature, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { type Column, DataTable } from "@/components";
import { Badge, Button, Card } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { DismissPreauthModal } from "./DismissPreauthModal";
import { EnhancementModal } from "./EnhancementModal";
import { RoomConsentModal } from "./RoomConsentModal";
import {
  evidenceNumber,
  hasInvalidThreshold,
  inr,
  isMissingPreauth,
  isUnknown,
  liveApproval,
  percentUsed,
  reasonLabel,
} from "./revenue-alerts-labels";

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
      "The running bill is near or past the approved amount: ask for an enhancement before the bill passes it. An insured patient with no usable pre-auth needs one raised or renewed on the pre-auth screen.",
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
  if (isMissingPreauth(row)) {
    return "Insured inpatient: raise or renew the pre-auth before the bill grows";
  }
  if (row.kind === "preauth_used_up") {
    const used = percentUsed(row);
    return `Approved ${inr(liveApproval(row))}${used === null ? "" : ` · ${used}% used`}`;
  }
  return `Room ${inr(evidenceNumber(row, "room_rate"))}/day · allowed ${inr(evidenceNumber(row, "eligible_rate"))}`;
}

/**
 * Whether the row's action applies: an enhancement only on a readable
 * approval, a consent only on a room that was checked.
 */
function canActOn(row: RevenueAlert): boolean {
  return row.reason === "preauth_used_up" || row.reason === "room_over_limit";
}

/** What the desk chose to do on a row. */
interface Acting {
  row: RevenueAlert;
  dismiss: boolean;
}

/** Which of the row actions the caller holds the permission for. */
interface Allowed {
  act: boolean;
  dismiss: boolean;
}

/** The row's action button, or nothing when it has none or the caller may not take it. */
function actionFor(copy: KindCopy, r: RevenueAlert, may: Allowed, onAct: (a: Acting) => void) {
  if (isMissingPreauth(r)) {
    if (!may.dismiss) return null;
    return (
      <Button
        tone="secondary"
        size="xs"
        leftSection={<IconX size={16} />}
        onClick={() => onAct({ row: r, dismiss: true })}
      >
        No pre-auth needed
      </Button>
    );
  }
  if (!may.act || !canActOn(r)) return null;
  return (
    <Button
      tone="secondary"
      size="xs"
      leftSection={
        r.kind === "preauth_used_up" ? <IconArrowUpRight size={16} /> : <IconSignature size={16} />
      }
      onClick={() => onAct({ row: r, dismiss: false })}
    >
      {copy.actionLabel}
    </Button>
  );
}

/** The kind's columns; the action shows only to someone who may take it. */
function columns(copy: KindCopy, may: Allowed, onAct: (a: Acting) => void): Column<RevenueAlert>[] {
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
          <Badge tone={isUnknown(r) || isMissingPreauth(r) ? "danger" : "warning"} size="sm">
            {reasonLabel(r)}
          </Badge>
          {!isUnknown(r) && (
            <Text size="xs" c="dimmed">
              {detail(r)}
            </Text>
          )}
          {hasInvalidThreshold(r) && (
            <Badge tone="danger" size="sm">
              Alert threshold unreadable: warned at 80%
            </Badge>
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
      render: (r) => actionFor(copy, r, may, onAct),
    },
  ];
}

/** One kind's open alerts with their action. */
export function RevenueAlertsPanel({ kind }: { kind: RevenueAlertKind }) {
  const copy = COPY[kind];
  const canView = useHasPermission(copy.view);
  const canAct = useHasPermission(copy.act);
  const canDismiss = useHasPermission(P.INSURANCE.PREAUTH_MISSING.DISMISS);
  const [acting, setActing] = useState<Acting | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["billing", "revenue-alerts", kind],
    queryFn: () => billingService.listRevenueAlerts({ kind }),
    enabled: canView,
    refetchInterval: 60_000,
  });
  const cols = useMemo(
    () => columns(copy, { act: canAct, dismiss: canDismiss }, setActing),
    [copy, canAct, canDismiss],
  );
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
      {acting?.dismiss && (
        <DismissPreauthModal alert={acting.row} onClose={() => setActing(null)} />
      )}
      {acting && !acting.dismiss && kind === "preauth_used_up" && (
        <EnhancementModal alert={acting.row} onClose={() => setActing(null)} />
      )}
      {acting && kind === "room_over_limit" && (
        <RoomConsentModal alert={acting.row} onClose={() => setActing(null)} />
      )}
    </Card>
  );
}
