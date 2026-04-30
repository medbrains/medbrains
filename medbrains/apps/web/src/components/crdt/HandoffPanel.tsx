/**
 * HandoffPanel — nursing shift handoff log, REST↔CRDT.
 *
 * Mounts useHandoffSource which switches transparently between the
 * REST adapter and the edge CRDT path based on TenantConfigProvider.
 * Renders a tiny add form + a reverse-chronological timeline with a
 * live unsynced-ops indicator.
 */

import { useState } from "react";
import { Badge, Button, Card, Group, Select, Stack, Text, Textarea, Timeline } from "@mantine/core";
import { useHandoffSource, type HandoffEntryInput } from "../../hooks/useHandoffSource";

interface HandoffPanelProps {
  shiftId: string;
  canAppend?: boolean;
}

const categoryColor: Record<HandoffEntryInput["category"], string> = {
  alert: "red",
  info: "blue",
  task: "yellow",
};

export function HandoffPanel({ shiftId, canAppend = true }: HandoffPanelProps) {
  const { entries, append, status, ready, unsyncedOps } = useHandoffSource(shiftId);
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<HandoffEntryInput["category"]>("info");

  const onAdd = () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    append({ note: trimmed, category });
    setNote("");
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fw={600}>Shift Handoff</Text>
        <Group gap="xs">
          <Badge variant="light" size="sm" color={statusColor(status)}>{status}</Badge>
          {unsyncedOps > 0 && (
            <Badge variant="filled" size="sm" color="orange">{unsyncedOps} unsynced</Badge>
          )}
        </Group>
      </Group>

      {canAppend && (
        <Card withBorder padding="sm">
          <Stack gap="xs">
            <Group gap="xs">
              <Select
                size="xs"
                value={category}
                onChange={(v) => v && setCategory(v as HandoffEntryInput["category"])}
                data={[
                  { value: "info", label: "Info" },
                  { value: "alert", label: "Alert" },
                  { value: "task", label: "Task" },
                ]}
                w={120}
              />
              <Textarea
                placeholder="Handoff note…"
                value={note}
                onChange={(e) => setNote(e.currentTarget.value)}
                autosize
                minRows={1}
                maxRows={4}
                style={{ flex: 1 }}
              />
              <Button size="xs" onClick={onAdd} disabled={!ready || !note.trim()}>
                Add
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {entries.length === 0 ? (
        <Text size="sm" c="dimmed">No handoff entries yet.</Text>
      ) : (
        <Timeline bulletSize={20} lineWidth={2}>
          {entries.map((e, i) => (
            <Timeline.Item
              key={`${e.ts}-${i}`}
              bullet={<Badge size="xs" color={categoryColor[e.category]}>{e.category[0]}</Badge>}
              title={
                <Group gap="xs">
                  <Text size="sm" fw={600}>{new Date(e.ts).toLocaleString()}</Text>
                  <Text size="xs" c="dimmed">— {e.author}</Text>
                </Group>
              }
            >
              <Text size="sm">{e.note}</Text>
            </Timeline.Item>
          ))}
        </Timeline>
      )}
    </Stack>
  );
}

function statusColor(status: string) {
  if (status === "online" || status === "synced") return "green";
  if (status === "loading" || status === "connecting") return "gray";
  if (status === "error" || status === "disconnected") return "red";
  return "blue";
}
