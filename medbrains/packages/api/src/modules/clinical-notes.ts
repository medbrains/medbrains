/** The `/clinical-notes` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  Note,
  NoteSectionPatch,
  NoteType,
  PendingCountersign,
  UnsignedNote,
} from "@medbrains/types";
import { request } from "../client.js";

export const clinicalNotesApi = {
  // ── Clinical notes (case sheet) ─────────────────────────
  listNoteTypes: (encounterId?: string) =>
    request<NoteType[]>(
      `/clinical-notes/types${encounterId ? `?encounter_id=${encounterId}` : ""}`,
    ),
  listMyUnsignedNotes: () => request<UnsignedNote[]>("/clinical-notes/mine/unsigned"),
  listPendingCountersign: () =>
    request<PendingCountersign[]>("/clinical-notes/countersign/pending"),
  countersignNote: (noteId: string) =>
    request<Note>(`/clinical-notes/${noteId}/countersign`, { method: "POST", body: "{}" }),
  returnNote: (noteId: string, comment: string) =>
    request<Note>(`/clinical-notes/${noteId}/return`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    }),
  saveNoteDraft: (noteId: string, sections: NoteSectionPatch[]) =>
    request<Note>(`/clinical-notes/${noteId}/draft`, {
      method: "PUT",
      body: JSON.stringify({ sections }),
    }),
  signNote: (noteId: string, lateEntryReason?: string) =>
    request<Note>(`/clinical-notes/${noteId}/sign`, {
      method: "POST",
      body: JSON.stringify({ late_entry_reason: lateEntryReason }),
    }),
  reviseNote: (noteId: string) =>
    request<Note>(`/clinical-notes/${noteId}/revise`, { method: "POST", body: "{}" }),
  discardNote: (noteId: string) =>
    request<Note | null>(`/clinical-notes/${noteId}/discard`, { method: "POST", body: "{}" }),
  markNoteInError: (noteId: string, reason: string) =>
    request<Note>(`/clinical-notes/${noteId}/entered-in-error`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};
