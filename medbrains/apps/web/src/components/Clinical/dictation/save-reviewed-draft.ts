import type {
  MedicineDecision,
  Note,
  ReviewSummary,
  SectionDecision,
  SessionView,
} from "@medbrains/types";
import { aiDraftToHtml } from "@/components/Clinical/case-sheet/AiDraftInsert";
import { clinicalNotesService } from "@/services/clinicalNotes.service";
import { dictationService } from "@/services/dictation.service";

export interface ReviewedDraft {
  encounterId: string;
  session: SessionView;
  sections: SectionDecision[];
  medicines: MedicineDecision[];
  /** The visit's notes as the case sheet has them. */
  notes: Note[];
}

/** The doctor's own unsigned consultation note on this visit, if one is open. */
function myDraftConsultation(notes: Note[]): Note | undefined {
  return notes.find(
    (n) => n.is_mine && n.note_type_code === "consultation" && n.status === "draft",
  );
}

/**
 * Put the accepted sections into the doctor's consultation note through the
 * normal draft save (marked AI-assisted, audited there), then record every
 * decision. Accepted text is added after what the note already says; nothing
 * is signed here — the doctor signs on the case sheet as always.
 */
export async function saveReviewedDraft(input: ReviewedDraft): Promise<ReviewSummary> {
  const kept = input.sections.filter((s) => s.decision === "accepted" && s.text?.trim());
  let noteId: string | null = null;
  if (kept.length > 0) {
    const note =
      myDraftConsultation(input.notes) ??
      (await clinicalNotesService.createNote(input.encounterId, {
        note_type_code: "consultation",
      }));
    await clinicalNotesService.saveNoteDraft(
      note.id,
      kept.map((s) => {
        const existing = note.sections.find((n) => n.code === s.code)?.text ?? "";
        return {
          code: s.code,
          text: `${existing}${aiDraftToHtml(s.text ?? "")}`,
          ai_accepted: true,
        };
      }),
    );
    noteId = note.id;
  }
  return dictationService.reviewDictation(input.session.id, {
    note_id: noteId,
    sections: input.sections,
    medicines: input.medicines,
  });
}
