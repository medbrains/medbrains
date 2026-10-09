import { api } from "@medbrains/api";

export const clinicalNotesService = {
  listNoteTypes: (...args: Parameters<typeof api.listNoteTypes>) => api.listNoteTypes(...args),
  listMyUnsignedNotes: () => api.listMyUnsignedNotes(),
  exportVisitFhir: (encounterId: string) => api.searchFhirCompositions(encounterId),
  listPatientNotes: (...args: Parameters<typeof api.listPatientNotes>) =>
    api.listPatientNotes(...args),
  listEncounterNotes: (...args: Parameters<typeof api.listEncounterNotes>) =>
    api.listEncounterNotes(...args),
  createNote: (...args: Parameters<typeof api.createNote>) => api.createNote(...args),
  saveNoteDraft: (...args: Parameters<typeof api.saveNoteDraft>) => api.saveNoteDraft(...args),
  signNote: (...args: Parameters<typeof api.signNote>) => api.signNote(...args),
  reviseNote: (...args: Parameters<typeof api.reviseNote>) => api.reviseNote(...args),
  discardNote: (...args: Parameters<typeof api.discardNote>) => api.discardNote(...args),
  countersignNote: (noteId: string) => api.countersignNote(noteId),
  returnNote: (noteId: string, comment: string) => api.returnNote(noteId, comment),
  listPendingCountersign: () => api.listPendingCountersign(),
  markNoteInError: (...args: Parameters<typeof api.markNoteInError>) =>
    api.markNoteInError(...args),
};
