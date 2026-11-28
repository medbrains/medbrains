import { Group, Stack, Text } from "@mantine/core";
import { type ModuleToken, TOKEN_PRIORITY_LABEL, TOKEN_PRIORITY_REASON } from "@medbrains/types";
import { Badge, Tooltip } from "@/components/ui";
import { formatWaited, hasAged } from "@/lib/token-ageing";

/**
 * Why a token is where it is in the queue, for the desk that has to explain it.
 *
 * A patient ahead of the queue for a reason nobody at the desk witnessed looks
 * like a queue-jump. So the badge says why on hover and never shows a raw
 * database value; a token that has aged up (migration 1006: one step per 30
 * minutes) says how long it has waited; and a token the desk moved up shows the
 * reason the desk typed, which the escalation form promised and no screen showed.
 */
export function TokenPriorityCell({ row }: { row: ModuleToken }) {
  const lane = row.priority_label ?? TOKEN_PRIORITY_LABEL[row.priority] ?? row.priority;
  const badge = row.priority !== "normal" && (
    <Tooltip label={TOKEN_PRIORITY_REASON[row.priority] ?? `${lane} — a lane this queue offers`}>
      <Badge tone={row.priority === "carried_over" ? "accent" : "warning"}>{lane}</Badge>
    </Tooltip>
  );
  const waited = hasAged(row.priority, row.created_at) && (
    <Tooltip
      label={`Waiting ${formatWaited(row.created_at)} — moved up the queue, never ahead of an emergency`}
    >
      <Badge tone="info">{formatWaited(row.created_at)}</Badge>
    </Tooltip>
  );
  if (!badge && !waited) return "—";
  return (
    <Stack gap={2} align="flex-start">
      <Group gap={4} wrap="nowrap">
        {badge}
        {waited}
      </Group>
      {badge && row.priority_reason && <Text size="xs">{row.priority_reason}</Text>}
    </Stack>
  );
}
