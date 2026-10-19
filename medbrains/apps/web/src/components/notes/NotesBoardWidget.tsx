import { Loader, Stack, Text } from "@mantine/core";
import type { StickyNote } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { notesService } from "@/services/notes.service";
import { NoteCard } from "./NoteCard";
import { NOTES_KEY } from "./NotesPanel";

/** How many notes the dashboard tile shows; the rest are in the Notes panel. */
const SHOWN = 5;

/**
 * Dashboard tile: pinned notes on my departments' boards and notes handed to
 * me — what the team needs to see at the start of a shift.
 */
export function NotesBoardWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: NOTES_KEY,
    queryFn: () => notesService.list(),
  });
  const notes = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const all: StickyNote[] = [...data.boards.flatMap((b) => b.notes), ...data.shared_with_me];
    return all
      .filter(
        (n) => (n.pinned || data.shared_with_me.includes(n)) && !seen.has(n.id) && seen.add(n.id),
      )
      .slice(0, SHOWN);
  }, [data]);

  if (isLoading) return <Loader size="sm" />;
  // An outage must not read as an empty board.
  if (isError)
    return (
      <Text size="sm" c="dimmed">
        Notes could not be loaded just now.
      </Text>
    );
  if (notes.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No pinned notes on your boards. Open Notes in the top bar to write one.
      </Text>
    );
  }
  return (
    <Stack gap="xs">
      {notes.map((n) => (
        <NoteCard key={n.id} note={n} />
      ))}
    </Stack>
  );
}
