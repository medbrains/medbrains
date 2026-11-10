// AI notes from dictation (RFCs/modules/RFC-MODULE-ai-dictation.md).
// Mirrors crates/medbrains-dictation.

export type DictationStatus =
  | "processing"
  | "stt_failed"
  | "no_speech"
  | "llm_failed"
  | "drafted"
  | "saved"
  | "rejected"
  | "abandoned";

/** One consultation-note section as the local model suggests it. */
export interface DraftSection {
  code: string;
  title: string;
  text: string;
}

/** A medicine the doctor said to give: a suggestion for the prescription pad. */
export interface ModelMedicine {
  name: string;
  dose: string;
  frequency: string;
  duration: string;
  route: string;
}

export interface Draft {
  sections: DraftSection[];
  medicines: ModelMedicine[];
}

/** One recording and what became of it. */
export interface SessionView {
  id: string;
  encounter_id: string;
  status: DictationStatus;
  failure: string | null;
  /** What a failed step means to the doctor, and what to do. */
  message: string | null;
  stt_adapter: "local" | "cloud" | null;
  transcript: string | null;
  draft: Draft | null;
  duration_ms: number;
  created_at: string;
}

export type DictationDecision = "accepted" | "rejected";

export interface SectionDecision {
  code: string;
  decision: DictationDecision;
  /** What the doctor kept, edits included. */
  text?: string;
}

export interface MedicineDecision {
  index: number;
  decision: DictationDecision;
}

export interface ReviewRequest {
  /** The consultation note the accepted text was saved into; null when all was rejected. */
  note_id: string | null;
  sections: SectionDecision[];
  medicines: MedicineDecision[];
}

export interface ReviewSummary {
  status: DictationStatus;
  accepted: number;
  edited: number;
  rejected: number;
}

/** Where dictation runs; the cloud service is off unless an admin turns it on. */
export interface DictationConfig {
  stt_url: string;
  llm_url: string;
  llm_model: string;
  cloud_enabled: boolean;
  cloud_url: string | null;
  cloud_model: string | null;
  cloud_api_key_secret: string | null;
}
