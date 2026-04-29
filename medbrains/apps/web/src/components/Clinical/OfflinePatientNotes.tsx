/**
 * OfflinePatientNotes — T3 CRDT proof point.
 *
 * Free-form clinical notes that two providers can edit concurrently.
 * Loro merges the text deterministically (operational transform under
 * the hood) and presents a single converged document. Last-typed-
 * letter-wins is wrong here — that's why this is T3 (CRDT-with-
 * commit-gate) instead of T2 (append-only): a senior reviewer
 * eventually signs off on the merged result before it's frozen into
 * the cloud audit chain.
 *
 * The signing-off step is **not** in this component yet — it lands
 * when first tier-1 hospital wires the conflict-resolution UI.
 * Until then, the doc is freely editable and the audit chain on the
 * edge captures every keystroke for after-the-fact reconciliation.
 *
 * Tier classification: T3 (CRDT with commit gate). NEVER use this
 * pattern for prescription orders or anything money-related — those
 * are T1 server-authoritative.
 */

import { useEffect, useState } from "react";
import { Badge, Group, Stack, Text, Textarea } from "@mantine/core";
import { IconCloud, IconCloudOff, IconAlertCircle, IconCheck, IconWriting } from "@tabler/icons-react";
import { useCrdtDoc, type CrdtConnectionStatus } from "@medbrains/crdt";

interface OfflinePatientNotesProps {
  patientId: string;
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
        <Badge color="blue" leftSection={<IconWriting size={12} />}>
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

export function OfflinePatientNotes({
  patientId,
  tenantId,
  deviceId,
  edgeUrl,
  authorName,
}: OfflinePatientNotesProps) {
  const { doc, ready, status, unsyncedOps } = useCrdtDoc(`notes/${patientId}`, {
    edgeUrl,
    tenantId,
    deviceId,
  });

  // Local mirror of the LoroText so React re-renders when remote
  // changes arrive. We subscribe to the doc and pull the current
  // string on every event.
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
    // Naive replace-all — for a real editor we'd diff and apply
    // ranged inserts/deletes for tighter merges. The replace-all
    // path is correct (Loro will compute the minimal op set
    // internally for export), it just produces larger updates than
    // a per-keystroke editor would.
    lt.update(next);
    // Stamp metadata about who edited last so the commit-gate UI
    // can show provenance later.
    doc.getMap("meta").set("last_author", authorName);
    doc.getMap("meta").set("last_edited_at", Date.now());
  };

  if (!ready) {
    return <Text c="dimmed">Loading offline-capable notes…</Text>;
  }

  const lastAuthor = doc.getMap("meta").get("last_author");
  const lastEditedAt = doc.getMap("meta").get("last_edited_at");

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Clinical notes (offline-tolerant)
        </Text>
        <SyncBadge status={status} unsynced={unsyncedOps} />
      </Group>

      <Textarea
        autosize
        minRows={6}
        maxRows={20}
        placeholder="Type the encounter note. Concurrent edits from another provider will merge automatically."
        value={text}
        onChange={(e) => handleChange(e.currentTarget.value)}
      />

      <Text size="xs" c="dimmed" ff="monospace">
        doc: notes/{patientId} · last edit:{" "}
        {typeof lastAuthor === "string" ? lastAuthor : "—"} ·{" "}
        {typeof lastEditedAt === "number"
          ? new Date(lastEditedAt).toLocaleString()
          : "—"}
      </Text>
    </Stack>
  );
}
