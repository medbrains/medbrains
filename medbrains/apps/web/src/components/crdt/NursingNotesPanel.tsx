/**
 * NursingNotesPanel — nursing shift narrative, REST↔CRDT.
 *
 * Same UX as NotesPanel but keyed by shiftId.
 */

import { useEffect, useRef, useState } from "react";
import { Badge, Group, Stack, Text, Textarea } from "@mantine/core";
import { useNursingNotesSource } from "../../hooks/useNursingNotesSource";

interface NursingNotesPanelProps {
  shiftId: string;
  canEdit?: boolean;
}

const SAVE_DEBOUNCE_MS = 600;

export function NursingNotesPanel({ shiftId, canEdit = true }: NursingNotesPanelProps) {
  const { text, setText, lastAuthor, lastEditedAt, status, ready, unsyncedOps } = useNursingNotesSource(shiftId);
  const [draft, setDraft] = useState(text);
  const lastRemote = useRef(text);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
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
        <Text fw={600}>Nursing Shift Notes</Text>
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
        placeholder={canEdit ? "Shift narrative — concurrent edits merge automatically." : ""}
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
