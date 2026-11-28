/** The `/encounters` API area. Moved from `client.ts`; one module per first path segment. */
import type { CreateNoteRequest, Note } from "@medbrains/types";
import { request } from "../client.js";

export const encountersApi = {
  listEncounterNotes: (encounterId: string) =>
    request<Note[]>(`/encounters/${encounterId}/clinical-notes`),
  createNote: (encounterId: string, data: CreateNoteRequest) =>
    request<Note>(`/encounters/${encounterId}/clinical-notes`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
