/**
 * OfflineNursingNotes — second T3 example.
 *
 * Free-form nursing note attached to a shift. Same shape as
 * OfflinePatientNotes but with shift context (shift_id) instead of
 * patient. After this one, we have TWO T3-text components doing
 * the same boilerplate — extract `useCrdtText` next.
 *
 * The naive replace-all-on-keystroke is the same compromise as
 * OfflinePatientNotes. Loro's text CRDT handles concurrent merges
 * deterministically; the wire format is just chunkier than a
 * proper diff-and-apply editor would produce.
 */

import { useEffect, useState } from "react";
import { Badge, Group, Stack, Text, Textarea } from "@mantine/core";
import {
  IconAlertCircle,
  IconCheck,
  IconCloud,
  IconCloudOff,
  IconNotes,
} from "@tabler/icons-react";
import { useCrdtDoc, type CrdtConnectionStatus } from "@medbrains/crdt";

interface OfflineNursingNotesProps {
  shiftId: string;
  tenantId: string;
  deviceId: string;
  edgeUrl: string;
  authorName: string;
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
          Saved
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
        <Badge color="blue" leftSection={<IconNotes size={12} />}>
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

export function OfflineNursingNotes({
  shiftId,
  tenantId,
  deviceId,
  edgeUrl,
  authorName,
}: OfflineNursingNotesProps) {
  const { doc, ready, status, unsyncedOps } = useCrdtDoc(
    `nursing-notes/${shiftId}`,
    {
      edgeUrl,
      tenantId,
      deviceId,
    },
  );

  const [text, setText] = useState<string>("");

  useEffect(() => {
    if (!ready) return;
    const lt = doc.getText("body");
    setText(lt.toString());
    const unsubscribe = doc.subscribe(() => {
      setText(lt.toString());
    });
    return () => {
      unsubscribe();
    };
  }, [doc, ready]);

  const handleChange = (next: string) => {
    if (!ready) return;
    const lt = doc.getText("body");
    lt.update(next);
    doc.getMap("meta").set("last_author", authorName);
    doc.getMap("meta").set("last_edited_at", Date.now());
  };

  if (!ready) {
    return <Text c="dimmed">Loading offline-capable nursing notes…</Text>;
  }

  const lastAuthor = doc.getMap("meta").get("last_author");
  const lastEditedAt = doc.getMap("meta").get("last_edited_at");

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Nursing notes (shift {shiftId.slice(0, 8)})
        </Text>
        <SyncBadge status={status} unsynced={unsyncedOps} />
      </Group>

      <Textarea
        autosize
        minRows={6}
        maxRows={20}
        placeholder="Shift narrative — concurrent edits from co-workers merge automatically."
        value={text}
        onChange={(e) => handleChange(e.currentTarget.value)}
      />

      <Text size="xs" c="dimmed" ff="monospace">
        doc: nursing-notes/{shiftId} · last edit:{" "}
        {typeof lastAuthor === "string" ? lastAuthor : "—"} ·{" "}
        {typeof lastEditedAt === "number"
          ? new Date(lastEditedAt).toLocaleString()
          : "—"}
      </Text>
    </Stack>
  );
}
