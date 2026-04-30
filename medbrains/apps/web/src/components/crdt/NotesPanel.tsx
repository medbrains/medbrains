/**
 * NotesPanel — patient clinical notes, REST↔CRDT.
 *
 * Backed by useNotesSource. In CRDT mode the textarea binds to a
 * Loro text container — concurrent edits from two devices merge
 * deterministically (no overwrite). In REST mode it round-trips
 * through the existing patient-notes endpoint with TanStack Query.
 *
 * Saves on debounce + on blur; explicit "Save" button is unnecessary.
 */

import { useEffect, useRef, useState } from "react";
import { Badge, Group, Stack, Text, Textarea } from "@mantine/core";
import { useNotesSource } from "../../hooks/useNotesSource";

interface NotesPanelProps {
  patientId: string;
  canEdit?: boolean;
  /** Visible label, e.g. "Doctor Notes" or "Discharge Summary". */
  label?: string;
}

const SAVE_DEBOUNCE_MS = 600;

export function NotesPanel({ patientId, canEdit = true, label = "Notes" }: NotesPanelProps) {
  const { text, setText, lastAuthor, lastEditedAt, status, ready, unsyncedOps } = useNotesSource(patientId);
  const [draft, setDraft] = useState(text);
  const lastRemote = useRef(text);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Adopt remote changes when they don't conflict with an in-flight
    // local edit. Conservative: only sync down when the local draft
    // matches what we last sent — anything else means the user is
    // actively typing and we don't want to clobber.
    if (text !== lastRemote.current && draft === lastRemote.current) {
      setDraft(text);
      lastRemote.current = text;
    }
  }, [text, draft]);

  const onChange = (next: string) => {
    setDraft(next);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setText(next);
      lastRemote.current = next;
    }, SAVE_DEBOUNCE_MS);
  };

  const onBlur = () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (draft !== lastRemote.current) {
      setText(draft);
      lastRemote.current = draft;
    }
  };

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={600}>{label}</Text>
        <Group gap="xs">
          <Badge variant="light" size="sm" color={statusColor(status)}>{status}</Badge>
          {unsyncedOps > 0 && (
            <Badge variant="filled" size="sm" color="orange">saving…</Badge>
          )}
          {lastAuthor && lastEditedAt && (
            <Text size="xs" c="dimmed">
              {lastAuthor} · {new Date(lastEditedAt).toLocaleString()}
            </Text>
          )}
        </Group>
      </Group>
      <Textarea
        value={draft}
        onChange={(e) => onChange(e.currentTarget.value)}
        onBlur={onBlur}
        readOnly={!canEdit || !ready}
        autosize
        minRows={4}
        maxRows={20}
        placeholder={canEdit ? "Type clinical notes…" : "No notes recorded."}
      />
    </Stack>
  );
}

function statusColor(status: string) {
  if (status === "online" || status === "synced") return "green";
  if (status === "loading" || status === "connecting") return "gray";
  if (status === "error" || status === "disconnected") return "red";
  return "blue";
}
