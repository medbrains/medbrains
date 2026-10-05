// The case sheet: every clinician's dated, signed notes on a visit.
// Mirrors crates/medbrains-clinical-notes (RFCs/RFC-MODULE-clinical-notes.md).

export interface NoteSection {
  code: string;
  title: string;
  text: string;
  /** A structured section's record (history, review of systems, examination). */
  data?: unknown;
}

/** A change to one section of a draft: what is sent replaces, the rest stays. */
export interface NoteSectionPatch {
  code: string;
  text?: string;
  data?: unknown;
}

export type ClinicalNoteCategory = "physician" | "nursing" | "allied";

export interface NoteType {
  id: string;
  code: string;
  name: string;
  loinc_code: string | null;
  category: ClinicalNoteCategory;
  sections: NoteSection[];
}

export type ClinicalNoteStatus = "draft" | "signed" | "entered_in_error";

export interface Note {
  id: string;
  encounter_id: string;
  patient_id: string;
  note_type_code: string;
  note_type_name: string;
  author_id: string;
  author_name: string;
  author_role: string;
  author_registration: string | null;
  department_name: string | null;
  status: ClinicalNoteStatus;
  /** When the care happened. */
  service_at: string;
  signed_at: string | null;
  /** After this only an addendum changes the note. */
  locked_at: string | null;
  late_entry_reason: string | null;
  current_version: number;
  /** Set on an addendum: the note it adds to. */
  amends_note_id: string | null;
  /** Carried over from a store that had no signing. */
  migrated_from: string | null;
  entered_in_error_at: string | null;
  entered_in_error_reason: string | null;
  sections: NoteSection[];
  saved_at: string;
  created_at: string;
  is_mine: boolean;
  revisable: boolean;
}

export interface CreateNoteRequest {
  note_type_code: string;
  service_at?: string;
  amends_note_id?: string;
  sections?: NoteSectionPatch[];
}
