/**
 * OfflineHandoffCard — T2 CRDT proof point (second example).
 *
 * Nursing handoff entries: timestamped, append-only, never edited
 * after-the-fact. Same shape as OfflineVitalsCard but different
 * domain — proves the pattern generalizes to any append-only
 * clinical event stream.
 *
 * If we end up with 3+ components that all look like this (vitals,
 * handoff, triage, telemetry, …), THAT is the signal to extract a
 * `useAppendOnlyCrdtList<T>` helper. Until then, copies over
 * abstraction.
 *
 * Tier classification: T2 (append-only). Last-write-wins is fine
 * because each entry is a distinct event with its own timestamp.
 */

import { useMemo } from "react";
import { Badge, Button, Group, Stack, Text, Textarea } from "@mantine/core";
import { useState } from "react";
import { IconCloud, IconCloudOff, IconAlertCircle, IconCheck, IconClock } from "@tabler/icons-react";
import { useCrdtDoc, type CrdtConnectionStatus } from "@medbrains/crdt";

interface OfflineHandoffCardProps {
  shiftId: string;
  tenantId: string;
  deviceId: string;
  edgeUrl: string;
  authorName: string;
}

interface HandoffEntry {
  ts: number;
  author: string;
  note: string;
  category: "alert" | "info" | "task";
}

const SyncBadge = ({
  status,
  unsynced,
}: {
  status: CrdtConnectionStatus;
  unsynced: number;
}) => {
  switch (status) {
    case "online":
      return unsynced > 0 ? (
        <Badge color="orange" leftSection={<IconCloudOff size={12} />}>
          {unsynced} pending
        </Badge>
      ) : (
        <Badge color="teal" leftSection={<IconCheck size={12} />}>
          Synced
        </Badge>
      );
    case "offline":
      return (
        <Badge color="orange" leftSection={<IconCloudOff size={12} />}>
          Offline {unsynced > 0 ? `· ${unsynced} queued` : ""}
        </Badge>
      );
    case "syncing":
      return (
        <Badge color="blue" leftSection={<IconClock size={12} />}>
          Syncing…
        </Badge>
      );
    case "error":
      return (
        <Badge color="red" leftSection={<IconAlertCircle size={12} />}>
          Edge error
        </Badge>
      );
    default:
      return (
        <Badge color="gray" leftSection={<IconCloud size={12} />}>
          Connecting
        </Badge>
      );
  }
};

const CATEGORY_COLORS: Record<HandoffEntry["category"], string> = {
  alert: "red",
  info: "blue",
  task: "violet",
};

export function OfflineHandoffCard({
  shiftId,
  tenantId,
  deviceId,
  edgeUrl,
  authorName,
}: OfflineHandoffCardProps) {
  const { doc, ready, status, unsyncedOps } = useCrdtDoc(`handoff/${shiftId}`, {
    edgeUrl,
    tenantId,
    deviceId,
  });

  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState<HandoffEntry["category"]>("info");

  const entries = useMemo(() => {
    if (!ready) return [];
    const list = doc.getList("entries");
    const out: HandoffEntry[] = [];
    for (let i = 0; i < list.length; i++) {
      const v = list.get(i);
      if (v && typeof v === "object") {
        out.push(v as HandoffEntry);
      }
    }
    return out.sort((a, b) => b.ts - a.ts); // newest first
  }, [doc, ready, unsyncedOps, status]);

  const append = () => {
    if (!ready || !draft.trim()) return;
    const list = doc.getList("entries");
    list.insert(list.length, {
      ts: Date.now(),
      author: authorName,
      note: draft.trim(),
      category,
    });
    setDraft("");
  };

  if (!ready) {
    return <Text c="dimmed">Loading offline-capable handoff log…</Text>;
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Shift handoff (offline-tolerant)
        </Text>
        <SyncBadge status={status} unsynced={unsyncedOps} />
      </Group>

      <Stack gap="xs">
        <Group gap="xs">
          {(["alert", "info", "task"] as const).map((c) => (
            <Button
              key={c}
              size="xs"
              variant={category === c ? "filled" : "light"}
              color={CATEGORY_COLORS[c]}
              onClick={() => setCategory(c)}
            >
              {c}
            </Button>
          ))}
        </Group>
        <Textarea
          minRows={2}
          placeholder="Add a handoff entry — appends immutably to the shift log"
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button onClick={append} disabled={!draft.trim()}>
            Add entry
          </Button>
        </Group>
      </Stack>

      <Stack gap="xs">
        {entries.map((e, i) => (
          <Group key={`${e.ts}-${i}`} gap="xs" align="flex-start">
            <Badge color={CATEGORY_COLORS[e.category]} size="sm">
              {e.category}
            </Badge>
            <Stack gap={2} style={{ flex: 1 }}>
              <Text size="sm">{e.note}</Text>
              <Text size="xs" c="dimmed">
                {new Date(e.ts).toLocaleString()} · {e.author}
              </Text>
            </Stack>
          </Group>
        ))}
        {entries.length === 0 && (
          <Text size="sm" c="dimmed">
            No entries yet for this shift.
          </Text>
        )}
      </Stack>

      <Text size="xs" c="dimmed" ff="monospace">
        doc: handoff/{shiftId} · {entries.length} entr
        {entries.length === 1 ? "y" : "ies"}
      </Text>
    </Stack>
  );
}
