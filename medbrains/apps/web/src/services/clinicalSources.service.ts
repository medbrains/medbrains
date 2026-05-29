import { api } from "@medbrains/api";
import type { TriageEntry, TriageEntryInput } from "@/hooks/useTriageSource";

interface NarrativeNotes {
  text: string;
  last_author?: string;
  last_edited_at?: string;
}

type ClinicalNotesResponse = Awaited<ReturnType<typeof api.getPatientNotes>>;
type NursingNotesResponse = Awaited<ReturnType<typeof api.getNursingShiftNotes>>;

export const clinicalSourcesService = {
  getPatientNotes: async (patientId: string): Promise<NarrativeNotes> =>
    toNarrativeNotes(await api.getPatientNotes(patientId)),
  updatePatientNotes: async (patientId: string, text: string): Promise<NarrativeNotes> =>
    toNarrativeNotes(await api.updatePatientNotes(patientId, { text })),
  getNursingNotes: async (shiftId: string): Promise<NarrativeNotes> =>
    toNarrativeNotes(await api.getNursingShiftNotes(shiftId)),
  updateNursingNotes: async (shiftId: string, text: string): Promise<NarrativeNotes> =>
    toNarrativeNotes(await api.updateNursingShiftNotes(shiftId, { text })),
  listTriageEntries: async (visitId: string): Promise<TriageEntry[]> =>
    (await api.listClinicalTriageEntries(visitId)).map(toTriageEntry),
  createTriageEntry: async (visitId: string, entry: TriageEntryInput): Promise<TriageEntry> =>
    toTriageEntry(await api.createClinicalTriageEntry(visitId, entry)),
};

function toNarrativeNotes(entry: ClinicalNotesResponse | NursingNotesResponse): NarrativeNotes {
  return {
    text: entry.text,
    last_author: entry.last_author_name ?? undefined,
    last_edited_at: entry.last_edited_at ?? undefined,
  };
}

type ClinicalTriageEntry = Awaited<ReturnType<typeof api.listClinicalTriageEntries>>[number];

function toTriageEntry(entry: ClinicalTriageEntry): TriageEntry {
  return {
    id: entry.id,
    er_visit_id: entry.er_visit_id,
    author_user_id: entry.author_user_id,
    authored_at: entry.authored_at,
    ts: new Date(entry.authored_at).getTime(),
    author: entry.author_name,
    esi_level: entry.esi_level,
    chief_complaint: entry.chief_complaint,
    observation: entry.observation,
  };
}
