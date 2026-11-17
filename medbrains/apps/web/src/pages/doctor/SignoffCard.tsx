/**
 * One pending record in the doctor's sign-off queue: what it is, whose it
 * is, how overdue, and the action the server accepts for it.
 */
import { Card, Group, Stack, Text, Tooltip } from "@mantine/core";
import type { PendingSignoffEntry } from "@medbrains/types";
import { IconAlertTriangle, IconSignature } from "@tabler/icons-react";
import { RefillDecision } from "@/components/Doctor/RefillDecision";
import { StoreSubstitutionDecision } from "@/components/Doctor/StoreSubstitutionDecision";
import { Badge, type BadgeTone, IconButton } from "@/components/ui";
import type { SignableTypes } from "@/hooks/useSignableTypes";
import { signoffAction, signoffLabel } from "./signoff-action";

interface SignoffCardProps {
  item: PendingSignoffEntry;
  types: SignableTypes | undefined;
  onSign: (item: PendingSignoffEntry) => void;
}

/** A pending record as a card, red-edged when overdue. */
export function SignoffCard({ item, types, onSign }: SignoffCardProps) {
  const ageHours = (Date.now() - new Date(item.created_at).getTime()) / 3_600_000;
  const isOverdue = ageHours > 24 && item.legal_class === "medico_legal";
  const countersign = verbalCountersign(item);
  const flagged = isOverdue || countersign?.overdue;
  return (
    <Card
      withBorder
      padding="sm"
      style={flagged ? { borderColor: "var(--mantine-color-red-6)" } : undefined}
    >
      <Group justify="space-between" wrap="nowrap">
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs">
            <Badge size="xs">{signoffLabel(item.record_type, types)}</Badge>
            <Badge size="xs" tone={legalColor(item.legal_class)}>
              {item.legal_class.replace("_", " ")}
            </Badge>
            {isOverdue && (
              <Badge size="xs" tone="danger" leftSection={<IconAlertTriangle size={10} />}>
                Overdue
              </Badge>
            )}
            {countersign && (
              <Badge
                size="xs"
                tone={countersign.overdue ? "danger" : "warning"}
                leftSection={<IconAlertTriangle size={10} />}
              >
                {countersign.label}
              </Badge>
            )}
            {item.transcribed && (
              <Badge size="xs" tone="neutral">
                Nurse-transcribed
              </Badge>
            )}
          </Group>
          <Text size="sm" fw={600} lineClamp={1}>
            {item.patient_name || item.summary || `${item.record_id.slice(0, 8)}…`}
          </Text>
          <Text size="xs" c="dimmed">
            {item.uhid ? `UHID ${item.uhid} • ` : ""}
            {item.summary || "No summary available"}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {item.context ? `${item.context} • ` : ""}
            Created {new Date(item.created_at).toLocaleString()} • {Math.round(ageHours)}h ago
          </Text>
          {item.risk_label && (
            <Badge size="xs" tone="warning" leftSection={<IconAlertTriangle size={10} />}>
              {item.risk_label}
            </Badge>
          )}
        </Stack>
        <SignoffActionCell item={item} types={types} onSign={onSign} />
      </Group>
    </Card>
  );
}

/** The decision or the Sign button for one entry; nothing for a type the server does not sign. */
function SignoffActionCell({
  item,
  types,
  onSign,
}: {
  item: PendingSignoffEntry;
  types: SignableTypes | undefined;
  onSign: (item: PendingSignoffEntry) => void;
}) {
  switch (signoffAction(item.record_type, types)) {
    case "refill":
      return <RefillDecision item={item} />;
    case "substitution":
      return <StoreSubstitutionDecision item={item} />;
    case "none":
      return null;
    case "sign":
      return (
        <Tooltip label="Sign">
          <IconButton tone="primary" size="lg" onClick={() => onSign(item)} aria-label="Sign">
            <IconSignature size={18} />
          </IconButton>
        </Tooltip>
      );
  }
}

/** Verbal/telephone order countersign status for a pending entry, if applicable. */
export function verbalCountersign(
  item: PendingSignoffEntry,
): { label: string; overdue: boolean } | null {
  if (item.order_mode !== "verbal" && item.order_mode !== "telephone") return null;
  const mode = item.order_mode === "telephone" ? "Telephone" : "Verbal";
  const dueMs = item.countersign_due_at ? new Date(item.countersign_due_at).getTime() : null;
  if (dueMs !== null && dueMs < Date.now()) {
    return { label: `${mode} order — countersign overdue`, overdue: true };
  }
  const by =
    dueMs !== null
      ? ` by ${new Date(dueMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "";
  return { label: `${mode} order — countersign${by}`, overdue: false };
}

/** The badge tone for a record's legal class. */
function legalColor(legalClass: string): BadgeTone {
  switch (legalClass) {
    case "medico_legal":
      return "danger";
    case "statutory_export":
      return "warning";
    case "clinical":
      return "info";
    default:
      return "neutral";
  }
}
