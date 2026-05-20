import type { TriageEntry, TriageEntryInput } from "../hooks/useTriageSource";

interface NarrativeNotes {
  text: string;
  last_author?: string;
  last_edited_at?: string;
}

export const clinicalSourcesService = {
  getPatientNotes: async (_patientId: string): Promise<NarrativeNotes> => ({
    text: "",
    last_author: undefined,
    last_edited_at: undefined,
  }),
  updatePatientNotes: async (_patientId: string, _text: string): Promise<never> => {
    throw new Error("patient-notes REST endpoint not implemented yet");
  },
  getNursingNotes: async (_shiftId: string): Promise<NarrativeNotes> => ({
    text: "",
    last_author: undefined,
    last_edited_at: undefined,
  }),
  updateNursingNotes: async (_shiftId: string, _text: string): Promise<never> => {
    throw new Error("nursing-notes REST endpoint not implemented yet");
  },
  listTriageEntries: async (_visitId: string): Promise<TriageEntry[]> => [],
  createTriageEntry: async (_visitId: string, _entry: TriageEntryInput): Promise<never> => {
    throw new Error("triage REST endpoint not implemented yet");
  },
};
