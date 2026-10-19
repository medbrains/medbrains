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
  /** Roles that write this type; empty: anyone who writes notes. */
  author_roles: string[];
  /** The visits it is written on: opd, ipd, emergency. */
  encounter_kinds: string[];
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
  /** The consultant who countersigns it, when its author has one. */
  cosigner_name: string | null;
  cosign_status: "pending" | "countersigned" | "returned" | null;
  cosigned_at: string | null;
  /** Why it was returned to its author. */
  cosign_comment: string | null;
  /** The caller is the consultant asked to countersign it, and has not yet. */
  is_my_cosign: boolean;
  /** Its content is withheld from the caller (consultation access restricted). */
  withheld: boolean;
}

export interface CreateNoteRequest {
  note_type_code: string;
  service_at?: string;
  amends_note_id?: string;
  sections?: NoteSectionPatch[];
}

/** One of the caller's drafts, with what is needed to open its case sheet. */
export interface UnsignedNote {
  id: string;
  encounter_id: string;
  encounter_type: "opd" | "ipd" | "emergency" | "home_health";
  admission_id: string | null;
  er_visit_id: string | null;
  patient_id: string;
  patient_name: string;
  uhid: string;
  note_type_name: string;
  /** A revision of a signed note, rather than a note never signed. */
  is_revision: boolean;
  service_at: string;
  saved_at: string;
}

/** A note waiting on the caller's countersignature. */
export interface PendingCountersign {
  id: string;
  encounter_id: string;
  encounter_type: "opd" | "ipd" | "emergency" | "home_health";
  admission_id: string | null;
  er_visit_id: string | null;
  patient_name: string;
  uhid: string;
  note_type_name: string;
  author_name: string;
  signed_at: string | null;
}

/** The visit a chart-review note was written on. */
export interface ChartVisit {
  encounter_id: string;
  encounter_type: "opd" | "ipd" | "emergency" | "home_health";
  encounter_date: string | null;
  admission_id: string | null;
  er_visit_id: string | null;
}

/** A filter choice drawn from what is on the patient's record. */
export interface ChartFacet {
  kind: "note_type" | "author" | "department";
  value: string;
  label: string;
}

/** A page of the patient's notes across visits, addenda after their note. */
export interface ChartPage {
  notes: Note[];
  visits: ChartVisit[];
  facets: ChartFacet[];
  has_more: boolean;
}

export interface ChartQuery {
  note_type?: string;
  author_id?: string;
  department_id?: string;
  status?: "signed" | "draft" | "entered_in_error";
  from?: string;
  to?: string;
  before_at?: string;
  before_id?: string;
}
