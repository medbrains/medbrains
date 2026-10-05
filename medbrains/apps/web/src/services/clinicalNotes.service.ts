import { api } from "@medbrains/api";

export const clinicalNotesService = {
  listNoteTypes: (...args: Parameters<typeof api.listNoteTypes>) => api.listNoteTypes(...args),
  listEncounterNotes: (...args: Parameters<typeof api.listEncounterNotes>) =>
    api.listEncounterNotes(...args),
  createNote: (...args: Parameters<typeof api.createNote>) => api.createNote(...args),
  saveNoteDraft: (...args: Parameters<typeof api.saveNoteDraft>) => api.saveNoteDraft(...args),
  signNote: (...args: Parameters<typeof api.signNote>) => api.signNote(...args),
  reviseNote: (...args: Parameters<typeof api.reviseNote>) => api.reviseNote(...args),
  discardNote: (...args: Parameters<typeof api.discardNote>) => api.discardNote(...args),
  markNoteInError: (...args: Parameters<typeof api.markNoteInError>) =>
    api.markNoteInError(...args),
};
