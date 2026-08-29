import { Group, SegmentedControl, Stack, Text, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { MarketingCallback } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconClockPause, IconPhoneCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { Badge, Button, Card, Modal, toast } from "@/components/ui";
import { marketingService } from "@/services/marketing.service";

/**
 * How long the call has been owed, said the way a caller would say it.
 *
 * The sign matters more than the precision: "18 min late" and "due in 2 h" are
 * different instructions, and a bare timestamp makes the reader work out which
 * one they are looking at.
 */
function owedFor(seconds: number): { label: string; late: boolean } {
  const late = seconds >= 0;
  const abs = Math.abs(seconds);
  const mins = Math.round(abs / 60);
  if (mins < 1) return { label: late ? "just now" : "in under a minute", late };
  if (mins < 60) return { label: late ? `${mins} min late` : `in ${mins} min`, late };
  const hours = abs / 3600;
  if (hours < 48) {
    const h = hours.toFixed(hours < 10 ? 1 : 0);
    return { label: late ? `${h} h late` : `in ${h} h`, late };
  }
  const days = (hours / 24).toFixed(0);
  return { label: late ? `${days} days late` : `in ${days} days`, late };
}

/**
 * The calls the desk owes.
 *
 * Every missed inbound call already booked one of these — `ingest_call`
 * inserts a callback whenever a caller rings and nobody picks up — and until
 * now no screen could open them. The funnel tab could show the *count* of
 * callbacks still owed and not one of the callbacks.
 *
 * Ordered by how long the call has been owed, oldest first. Conversion falls
 * roughly fourfold past five minutes, and a desk with more enquiries than
 * capacity is otherwise choosing whoever happens to be on screen.
 */
export function MarketingCallbacksTab() {
  const queryClient = useQueryClient();
  const canWork = useHasPermission(P.MARKETING.INTERACTIONS_LOG);
  const [scope, setScope] = useState("all");
  const [active, setActive] = useState<MarketingCallback | null>(null);
  const [note, setNote] = useState("");
  const [snoozeHours, setSnoozeHours] = useState("2");
  const snoozeModal = useDisclosure(false);

  const {
    data: callbacks = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["marketing", "callbacks", scope],
    queryFn: () => marketingService.listCallbacks({ scope: scope === "mine" ? "mine" : undefined }),
    // The list goes stale the moment a colleague works a row, and two agents
    // ringing the same person is the failure this screen exists to prevent.
    refetchInterval: 60_000,
  });

  const { data: summary } = useQuery({
    queryKey: ["marketing", "callbacks", "summary"],
    queryFn: () => marketingService.callbackSummary(),
    refetchInterval: 60_000,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["marketing", "callbacks"] });

  const completeMutation = useMutation({
    mutationFn: (row: MarketingCallback) =>
      marketingService.completeCallback(row.id, { note: note.trim() || undefined }),
    onSuccess: (row) => {
      invalidate();
      setActive(null);
      setNote("");
      toast.success(`Call to ${row.display_name ?? row.primary_phone ?? "the enquiry"} logged`, {
        title: "Callback closed",
      });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not close callback" }),
  });

  const rescheduleMutation = useMutation({
    mutationFn: (row: MarketingCallback) => {
      const due = new Date(Date.now() + Number(snoozeHours) * 3_600_000);
      return marketingService.rescheduleCallback(row.id, {
        due_at: due.toISOString(),
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      invalidate();
      snoozeModal[1].close();
      setActive(null);
      setNote("");
      toast.success("Moved to later today", { title: "Callback rescheduled" });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not reschedule" }),
  });

  const overdue = useMemo(
    () => callbacks.filter((c) => c.overdue_seconds >= 0).length,
    [callbacks],
  );

  const columns = [
    {
      key: "who",
      label: "Who to call",
      render: (row: MarketingCallback) => (
        <Stack gap={0}>
          <Text fw={500}>{row.display_name ?? "Unnamed enquiry"}</Text>
          <Text size="xs" c="dimmed" ff="monospace">
            {row.primary_phone ?? "no number on file"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "owed",
      label: "Owed",
      render: (row: MarketingCallback) => {
        const { label, late } = owedFor(row.overdue_seconds);
        // Not colour alone — the word "late" carries the state for anyone who
        // cannot separate the two badge tones.
        return late ? (
          <Badge tone="danger" size="sm">
            {label}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            {label}
          </Text>
        );
      },
    },
    {
      key: "stage_name",
      label: "Stage",
      render: (row: MarketingCallback) => (
        <Text size="sm" c={row.stage_name ? undefined : "dimmed"}>
          {row.stage_name ?? "Not filed"}
        </Text>
      ),
    },
    {
      key: "assigned_to_name",
      label: "Assigned",
      render: (row: MarketingCallback) => (
        <Text size="sm" c={row.assigned_to_name ? undefined : "dimmed"}>
          {row.assigned_to_name ?? "Anyone"}
        </Text>
      ),
    },
    {
      key: "note",
      label: "Note",
      render: (row: MarketingCallback) => (
        <Text size="sm" c="dimmed" lineClamp={2}>
          {row.note ?? "—"}
        </Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: MarketingCallback) =>
        canWork ? (
          <Group gap="xs" wrap="nowrap">
            <Button
              tone="primary"
              size="xs"
              leftSection={<IconPhoneCheck size={14} />}
              loading={completeMutation.isPending && active?.id === row.id}
              onClick={() => {
                setActive(row);
                completeMutation.mutate(row);
              }}
            >
              Called
            </Button>
            <Button
              tone="ghost"
              size="xs"
              leftSection={<IconClockPause size={14} />}
              onClick={() => {
                setActive(row);
                setNote("");
                snoozeModal[1].open();
              }}
            >
              Later
            </Button>
          </Group>
        ) : null,
    },
  ];

  return (
    <Stack>
      {summary && (
        <Card>
          <Group gap="xl">
            <Stack gap={0}>
              <Text size="xl" fw={700}>
                {summary.open}
              </Text>
              <Text size="xs" c="dimmed">
                Calls owed
              </Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xl" fw={700} c={summary.overdue > 0 ? "red" : undefined}>
                {summary.overdue}
              </Text>
              <Text size="xs" c="dimmed">
                Past due
              </Text>
            </Stack>
            {summary.oldest_overdue_seconds !== null && (
              <Stack gap={0}>
                <Text size="xl" fw={700}>
                  {owedFor(summary.oldest_overdue_seconds).label}
                </Text>
                <Text size="xs" c="dimmed">
                  Longest anyone has waited
                </Text>
              </Stack>
            )}
          </Group>
        </Card>
      )}

      <Group justify="space-between">
        <SegmentedControl
          size="xs"
          value={scope}
          onChange={setScope}
          data={[
            { label: "Whole desk", value: "all" },
            { label: "Mine", value: "mine" },
          ]}
        />
        {overdue > 0 && (
          <Text size="sm">
            <Text span fw={700} c="red">
              {overdue}
            </Text>{" "}
            of these are already late.
          </Text>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={callbacks}
        loading={isLoading}
        rowKey={(row: MarketingCallback) => row.id}
        emptyTitle={isError ? "The callback list could not be loaded" : "Nobody is waiting"}
        emptyDescription={
          isError
            ? // An empty worklist and a failed one look identical, and one of
              // them means somebody is not being called back.
              "This is not a statement that no calls are owed — the list failed to load."
            : "Missed calls book a callback automatically. When one comes in, it appears here."
        }
      />

      <Modal
        opened={snoozeModal[0]}
        onClose={snoozeModal[1].close}
        title="Ring back later"
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            The call stays owed — it moves down the list rather than off it.
          </Text>
          <SegmentedControl
            fullWidth
            value={snoozeHours}
            onChange={setSnoozeHours}
            data={[
              { label: "2 hours", value: "2" },
              { label: "This evening", value: "6" },
              { label: "Tomorrow", value: "24" },
            ]}
          />
          <Textarea
            label="Note"
            placeholder="Asked to be called after six"
            autosize
            minRows={2}
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button tone="ghost" size="xs" onClick={snoozeModal[1].close}>
              Cancel
            </Button>
            <Button
              tone="primary"
              size="xs"
              loading={rescheduleMutation.isPending}
              onClick={() => active && rescheduleMutation.mutate(active)}
            >
              Move it
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
