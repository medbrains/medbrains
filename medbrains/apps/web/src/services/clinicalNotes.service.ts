import { clinicalNotesApi } from "@medbrains/api/modules/clinical-notes";
import { encountersApi } from "@medbrains/api/modules/encounters";
import { fhirApi } from "@medbrains/api/modules/fhir";
import { patientsApi } from "@medbrains/api/modules/patients";

export const clinicalNotesService = {
  listNoteTypes: (...args: Parameters<typeof clinicalNotesApi.listNoteTypes>) =>
    clinicalNotesApi.listNoteTypes(...args),
  listMyUnsignedNotes: () => clinicalNotesApi.listMyUnsignedNotes(),
  exportVisitFhir: (encounterId: string) => fhirApi.searchFhirCompositions(encounterId),
  listPatientNotes: (...args: Parameters<typeof patientsApi.listPatientNotes>) =>
    patientsApi.listPatientNotes(...args),
  listEncounterNotes: (...args: Parameters<typeof encountersApi.listEncounterNotes>) =>
    encountersApi.listEncounterNotes(...args),
  createNote: (...args: Parameters<typeof encountersApi.createNote>) =>
    encountersApi.createNote(...args),
  saveNoteDraft: (...args: Parameters<typeof clinicalNotesApi.saveNoteDraft>) =>
    clinicalNotesApi.saveNoteDraft(...args),
  signNote: (...args: Parameters<typeof clinicalNotesApi.signNote>) =>
    clinicalNotesApi.signNote(...args),
  reviseNote: (...args: Parameters<typeof clinicalNotesApi.reviseNote>) =>
    clinicalNotesApi.reviseNote(...args),
  discardNote: (...args: Parameters<typeof clinicalNotesApi.discardNote>) =>
    clinicalNotesApi.discardNote(...args),
  countersignNote: (noteId: string) => clinicalNotesApi.countersignNote(noteId),
  returnNote: (noteId: string, comment: string) => clinicalNotesApi.returnNote(noteId, comment),
  listPendingCountersign: () => clinicalNotesApi.listPendingCountersign(),
  markNoteInError: (...args: Parameters<typeof clinicalNotesApi.markNoteInError>) =>
    clinicalNotesApi.markNoteInError(...args),
};
