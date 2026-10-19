import type { StickyNote } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { filterMine, noteActions, toggleKind } from "./notes-logic";

const note = (over: Partial<StickyNote>): StickyNote => ({
  id: "n",
  body: "Critical lab value",
  colour: "pink",
  pinned: false,
  expires_at: null,
  author_id: "me",
  author_name: "Me",
  created_at: "2026-10-19T08:00:00Z",
  updated_at: "2026-10-19T08:00:00Z",
  share_id: null,
  shares: [],
  is_system: false,
  source_url: null,
  auto_resolve: false,
  can_auto_resolve: false,
  resolved_at: null,
  ...over,
});

describe("filterMine", () => {
  it("keeps a resolved note out of the active list and under resolved", () => {
    const open = note({ id: "open" });
    const done = note({ id: "done", resolved_at: "2026-10-19T09:00:00Z" });
    expect(filterMine([open, done], "active")).toEqual([open]);
    expect(filterMine([open, done], "resolved")).toEqual([done]);
  });
});

describe("noteActions", () => {
  it("never offers edit or share on a note from a notification", () => {
    const a = noteActions(note({ is_system: true, can_auto_resolve: true }));
    expect(a).toEqual({ canEdit: false, canShare: false, canToggleAutoResolve: true });
  });
  it("offers auto-resolve only when there is a resolvable source still open", () => {
    expect(noteActions(note({})).canToggleAutoResolve).toBe(false);
    const resolved = note({ can_auto_resolve: true, resolved_at: "2026-10-19T09:00:00Z" });
    expect(noteActions(resolved).canToggleAutoResolve).toBe(false);
  });
});

describe("toggleKind", () => {
  it("adds once, removes, and keeps a stable order", () => {
    expect(toggleKind(["urgent"], "lab", true)).toEqual(["lab", "urgent"]);
    expect(toggleKind(["lab", "urgent"], "lab", true)).toEqual(["lab", "urgent"]);
    expect(toggleKind(["lab", "urgent"], "urgent", false)).toEqual(["lab"]);
  });
});
