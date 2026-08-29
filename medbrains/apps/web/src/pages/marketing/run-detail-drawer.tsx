import { Group, SegmentedControl, Stack, Text } from "@mantine/core";
import type { MarketingMessageRow, MarketingOutreachRun } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { Badge, Drawer } from "@/components/ui";
import { marketingService } from "@/services/marketing.service";

/**
 * Why somebody was excluded, said the way the desk would say it.
 *
 * The stored vocabulary is closed and operational — none of it is a clinical
 * reason and none may become one — so this map is the only place it turns into
 * a sentence.
 */
const BLOCKED_LABELS: Record<string, string> = {
  no_consent: "Never asked for permission",
  withdrawn: "They asked us to stop",
  suppressed: "On the do-not-contact list",
  over_cap: "Already messaged too recently",
  no_address: "No number on record",
  unknown: "Could not be checked",
};

const STATUS_TONE: Record<string, "success" | "info" | "warning" | "danger" | "neutral"> = {
  delivered: "success",
  sent: "info",
  queued: "neutral",
  blocked: "warning",
  failed: "danger",
};

/**
 * Who a run actually reached, and why it skipped the rest.
 *
 * This is the screen that answers the front-office phone call in one place
 * instead of a support ticket. Before the ledger existed a run was two
 * integers — `sent_count` and `failed_count` — so "did my mother get the
 * reminder" had no answer at all.
 *
 * It defaults to the excluded recipients rather than the whole list, because
 * that is the question people actually open it to ask. The sends are one
 * click away and rarely disputed.
 */
export function RunDetailDrawer({
  run,
  opened,
  onClose,
}: {
  run: MarketingOutreachRun | null;
  opened: boolean;
  onClose: () => void;
}) {
  const [view, setView] = useState("blocked");

  const {
    data: messages = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["marketing", "outreach", run?.id, "messages", view],
    queryFn: () =>
      marketingService.listRunMessages(run?.id ?? "", { blocked_only: view === "blocked" }),
    enabled: opened && Boolean(run?.id),
  });

  const tally = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of messages) {
      counts[m.status] = (counts[m.status] ?? 0) + 1;
    }
    return counts;
  }, [messages]);

  const columns = [
    {
      key: "display_name",
      label: "Recipient",
      render: (row: MarketingMessageRow) => (
        <Stack gap={0}>
          <Text fw={500}>{row.display_name ?? "Unnamed enquiry"}</Text>
          <Text size="xs" c="dimmed" ff="monospace">
            {/* Last four only. Recognising a row is the job here; redialling
                from it is the enquiry screen's. */}
            {row.address_tail ? `••• ${row.address_tail}` : "no number"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: MarketingMessageRow) => (
        <Badge tone={STATUS_TONE[row.status] ?? "neutral"} size="sm">
          {row.status}
        </Badge>
      ),
    },
    {
      key: "blocked_reason",
      label: "Why not",
      render: (row: MarketingMessageRow) =>
        row.blocked_reason ? (
          <Text size="sm">{BLOCKED_LABELS[row.blocked_reason] ?? row.blocked_reason}</Text>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
    {
      key: "when",
      label: "When",
      render: (row: MarketingMessageRow) => {
        const stamp = row.delivered_at ?? row.sent_at ?? row.queued_at;
        return (
          <Text size="sm" c="dimmed">
            {new Date(stamp).toLocaleString()}
          </Text>
        );
      },
    },
  ];

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Who this run reached"
      size="xl"
      position="right"
    >
      <Stack gap="md">
        {run && (
          <Group gap="xl">
            <Stack gap={0}>
              <Text size="xl" fw={700}>
                {run.sent_count}
              </Text>
              <Text size="xs" c="dimmed">
                Queued to send
              </Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xl" fw={700}>
                {tally.blocked ?? 0}
              </Text>
              <Text size="xs" c="dimmed">
                Excluded{view === "blocked" ? "" : " (of those shown)"}
              </Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xl" fw={700}>
                {run.failed_count}
              </Text>
              <Text size="xs" c="dimmed">
                Failed at the provider
              </Text>
            </Stack>
          </Group>
        )}

        <SegmentedControl
          size="xs"
          value={view}
          onChange={setView}
          data={[
            { label: "Excluded", value: "blocked" },
            { label: "Everyone", value: "all" },
          ]}
        />

        <DataTable
          columns={columns}
          data={messages}
          loading={isLoading}
          rowKey={(row: MarketingMessageRow) => row.id}
          emptyTitle={
            isError
              ? "The recipient list could not be loaded"
              : view === "blocked"
                ? "Nobody was excluded"
                : "No recipients recorded"
          }
          emptyDescription={
            isError
              ? // An empty exclusion list and a failed one look identical, and
                // one of them means somebody was silently dropped.
                "This is not a statement that nobody was excluded — the list failed to load."
              : view === "blocked"
                ? "Every recipient in the cohort was reachable."
                : "This run has not been started yet."
          }
        />

        <Text size="xs" c="dimmed">
          Excluded recipients are recorded, not discarded — an exclusion that exists only as a
          smaller number cannot answer why somebody was left out.
        </Text>
      </Stack>
    </Drawer>
  );
}
