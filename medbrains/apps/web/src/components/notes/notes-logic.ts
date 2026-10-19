import type { StickyNote } from "@medbrains/types";

export type MineFilter = "active" | "resolved";

/** My notes under one filter: notes that cleared themselves only under "resolved". */
export function filterMine(notes: StickyNote[], filter: MineFilter): StickyNote[] {
  return notes.filter((n) => (n.resolved_at !== null) === (filter === "resolved"));
}

/** What the author may do with one of their notes. A note from a notification is the system's text: dismiss it, never edit or share it. */
export function noteActions(note: StickyNote) {
  return {
    canEdit: !note.is_system,
    canShare: !note.is_system,
    canToggleAutoResolve: note.can_auto_resolve && note.resolved_at === null,
  };
}

/** Kinds chosen after toggling one on or off, in a stable order. */
export function toggleKind(kinds: string[], key: string, on: boolean): string[] {
  const next = new Set(kinds);
  if (on) next.add(key);
  else next.delete(key);
  return [...next].sort();
}
