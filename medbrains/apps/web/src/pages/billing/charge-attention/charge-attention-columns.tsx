// The charge attention queue's columns: who, what charge, its amount and age,
// where it came from, why it is here, and what the viewer may do about it.

import { Group, Stack, Text } from "@mantine/core";
import type { ChargeAttentionItem } from "@medbrains/types";
import { IconReceipt, IconUserPlus, IconX } from "@tabler/icons-react";
import type { Column } from "@/components";
import { Badge, IconButton, Tooltip } from "@/components/ui";
import {
  ageLabel,
  isDetectedReason,
  isLeakageReason,
  moduleLabel,
  NO_TARIFF,
  REASON_IMPLANT_NO_PATIENT,
  reasonLabel,
  rupees,
  STATUS_LABEL,
  STATUS_TONE,
} from "./charge-attention-labels";

export type ChargeAttentionAction = "post" | "dismiss" | "name_patient";

/** The lead-in to who the implant registry has an implant of this batch for. */
export const REGISTRY_HINT = "May be the same implant as the registry entry for:";

/** What a row with no patient named says in the patient column. */
export const NO_PATIENT = "No patient named";

interface ColumnOptions {
  /** May work charges a module could not post. */
  canResolve: boolean;
  /** May work leakage rows: care or stock never billed, implants with no patient. */
  canResolveUnbilled: boolean;
  /** May name the patient on an unnamed implant (rewrites the store's record). */
  canNameRecipient: boolean;
  /** Amounts are hidden from this viewer: show that, not "No tariff". */
  amountsHidden: boolean;
  pendingId: string | null;
  onAction: (kind: ChargeAttentionAction, item: ChargeAttentionItem) => void;
}

/**
 * Post and dismiss buttons, only on an open item and only for its kind's
 * resolver; an implant used without a patient offers "Name patient" before
 * Post, and "Change patient" while it is open (a wrong pick).
 */
function Actions({ row, o }: { row: ChargeAttentionItem; o: ColumnOptions }) {
  const allowed = isLeakageReason(row.reason) ? o.canResolveUnbilled : o.canResolve;
  if (row.status !== "open" || !allowed) return null;
  const implant = row.reason === REASON_IMPLANT_NO_PATIENT;
  // A row with no tariff would post ₹0; the server refuses it too.
  const unpriced =
    (isDetectedReason(row.reason) || implant) &&
    (row.unit_price_override === null || (implant && Number(row.unit_price_override) === 0));
  const unnamed = row.patient_id === null;
  const nameLabel = unnamed ? "Name patient" : "Change patient";
  const postBlocked = unpriced || unnamed;
  const postHint = unnamed
    ? "Name the patient first"
    : unpriced
      ? NO_TARIFF
      : "Post this charge to the patient's bill";
  return (
    <Group gap={4} wrap="nowrap">
      {implant && o.canNameRecipient && (
        <Tooltip label="Name the patient this implant was used on">
          <IconButton
            tone="primary"
            aria-label={nameLabel}
            onClick={() => o.onAction("name_patient", row)}
          >
            <IconUserPlus size={16} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip label={postHint}>
        <IconButton
          tone="success"
          aria-label="Post charge"
          disabled={postBlocked}
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
          {r.patient_id === null ? (
            <Text size="sm" c="dimmed">
              {NO_PATIENT}
            </Text>
          ) : (
            <>
              <Text size="sm">{r.patient_name}</Text>
              <Text size="xs" ff="monospace" c="dimmed">
                {r.uhid}
              </Text>
            </>
          )}
          {r.registry_patients && (
            <Text size="xs" c="dimmed">
              {REGISTRY_HINT} {r.registry_patients}
            </Text>
          )}
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
      key: "amount",
      label: "Amount",
      render: (r) => (
        <Text size="sm" ff="monospace" c={r.amount === null ? "dimmed" : undefined}>
          {o.amountsHidden ? "Hidden" : rupees(r.amount)}
        </Text>
      ),
    },
    { key: "age", label: "Age", render: (r) => <Text size="sm">{ageLabel(r.age_days)}</Text> },
    {
      key: "from",
      label: "From",
      render: (r) => (
        <Stack gap={0}>
          <Text size="sm">
            {moduleLabel(r.source_module)}
            {r.department_name ? ` · ${r.department_name}` : ""}
          </Text>
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
