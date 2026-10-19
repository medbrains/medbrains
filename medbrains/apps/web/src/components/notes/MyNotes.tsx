import { Group, Stack, Text } from "@mantine/core";
import type { StickyNote } from "@medbrains/types";
import { IconBellCog, IconEdit, IconPlus, IconShare, IconTrash } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { Button, IconButton, SegmentedControl, Switch } from "@/components/ui";
import { NoteCard } from "./NoteCard";
import { filterMine, type MineFilter, noteActions } from "./notes-logic";

export interface MyNoteHandlers {
  onNew: () => void;
  onSettings: () => void;
  onEdit: (note: StickyNote) => void;
  onShare: (note: StickyNote) => void;
  onRemove: (id: string) => void;
  onAutoResolve: (id: string, on: boolean) => void;
}

interface MyNotesProps {
  notes: StickyNote[];
  handlers: MyNoteHandlers;
}

const FILTERS = [
  { value: "active", label: "Active" },
  { value: "resolved", label: "Resolved" },
];

function MyNoteActions({ note, handlers }: { note: StickyNote; handlers: MyNoteHandlers }) {
  const can = noteActions(note);
  return (
    <>
      {can.canToggleAutoResolve && (
        <Switch
          label="Auto-resolve"
          checked={note.auto_resolve}
          onChange={(e) => handlers.onAutoResolve(note.id, e.currentTarget.checked)}
        />
      )}
      {can.canEdit && (
        <IconButton aria-label="Edit note" onClick={() => handlers.onEdit(note)}>
          <IconEdit size={16} />
        </IconButton>
      )}
      {can.canShare && (
        <IconButton aria-label="Share note" onClick={() => handlers.onShare(note)}>
          <IconShare size={16} />
        </IconButton>
      )}
      <IconButton
        aria-label={note.is_system ? "Dismiss note" : "Delete note"}
        tone="danger"
        onClick={() => handlers.onRemove(note.id)}
      >
        <IconTrash size={16} />
      </IconButton>
    </>
  );
}

/** My own notes: written by me or pinned from my notifications, active or resolved. */
export function MyNotes({ notes, handlers }: MyNotesProps) {
  const [filter, setFilter] = useState<MineFilter>("active");
  const shown = useMemo(() => filterMine(notes, filter), [notes, filter]);
  return (
    <Stack>
      <Group grow>
        <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={handlers.onNew}>
          New note
        </Button>
        <Button
          tone="secondary"
          leftSection={<IconBellCog size={16} />}
          onClick={handlers.onSettings}
        >
          From notifications
        </Button>
      </Group>
      <SegmentedControl
        aria-label="Show active or resolved notes"
        data={FILTERS}
        value={filter}
        onChange={(v) => setFilter(v === "resolved" ? "resolved" : "active")}
      />
      {shown.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          {filter === "active"
            ? "No notes yet. Write one, or pin a notification from the bell."
            : "Nothing has resolved itself this week."}
        </Text>
      )}
      {shown.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          showAuthor={false}
          actions={<MyNoteActions note={note} handlers={handlers} />}
        />
      ))}
    </Stack>
  );
}
