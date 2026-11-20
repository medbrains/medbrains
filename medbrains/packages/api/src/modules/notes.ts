/** The `/notes` API area. Moved from `client.ts`; one module per first path segment. */
import { request } from "../client.js";

export const notesApi = {
  // ── Sticky notes ──
  listStickyNotes: () => request<import("@medbrains/types").StickyNotesView>("/notes"),
  createStickyNote: (data: import("@medbrains/types").SaveStickyNote) =>
    request<{ id: string }>("/notes", { method: "POST", body: JSON.stringify(data) }),
  updateStickyNote: (id: string, data: import("@medbrains/types").SaveStickyNote) =>
    request<{ id: string }>(`/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteStickyNote: (id: string) => request<void>(`/notes/${id}`, { method: "DELETE" }),
  setStickyNoteShares: (id: string, data: import("@medbrains/types").SetStickyNoteShares) =>
    request<{ id: string }>(`/notes/${id}/shares`, { method: "PUT", body: JSON.stringify(data) }),
  removeStickyNoteShare: (shareId: string) =>
    request<void>(`/notes/shares/${shareId}`, { method: "DELETE" }),
  pinNotificationToNotes: (notificationId: string) =>
    request<{ id: string }>(`/notes/from-notification/${notificationId}`, { method: "POST" }),
  getStickyNotePreferences: () =>
    request<import("@medbrains/types").StickyNotePreferences>("/notes/preferences"),
  setStickyNotePreferences: (kinds: string[]) =>
    request<import("@medbrains/types").StickyNotePreferences>("/notes/preferences", {
      method: "PUT",
      body: JSON.stringify({ kinds }),
    }),
  setStickyNoteAutoResolve: (id: string, autoResolve: boolean) =>
    request<{ id: string }>(`/notes/${id}/auto-resolve`, {
      method: "PUT",
      body: JSON.stringify({ auto_resolve: autoResolve }),
    }),
  listStickyNoteRecipients: (q: string) =>
    request<import("@medbrains/types").NoteRecipients>(
      `/notes/recipients?q=${encodeURIComponent(q)}`,
    ),
};
