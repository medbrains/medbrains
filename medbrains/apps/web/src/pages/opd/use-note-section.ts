// A structured section of the caller's own Consultation note — History, ROS
// or Examination — read and written from its own tab
// (RFCs/RFC-MODULE-clinical-notes.md, phase 1b).

import { useDebouncedCallback, useWindowEvent } from "@mantine/hooks";
import { nullOn404 } from "@medbrains/api";
import { useHasPermission, usePermissionStore } from "@medbrains/stores";
import { type Consultation, type Note, P } from "@medbrains/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { clinicalNotesService } from "@/services/clinicalNotes.service";
import { opdService } from "@/services/opd.service";

export type SectionCode = "history" | "ros" | "examination";

/** Where the section's content on screen comes from. */
export type SectionSource =
  | { kind: "my_draft"; note: Note }
  | { kind: "signed"; note: Note }
  /** The visit's record from before notes were signed. */
  | { kind: "legacy" }
  | { kind: "none" };

/** Quiet time after the last edit before the section is saved. */
const SAVE_DELAY_MS = 1000;

const isConsultation = (n: Note) => n.note_type_code === "consultation" && !n.amends_note_id;
const sectionData = (n: Note, code: SectionCode) =>
  n.sections.find((s) => s.code === code)?.data ?? null;

/** The visit's structured record as the consultation row holds it. */
function legacyData(c: Consultation | null | undefined, code: SectionCode): unknown {
  if (!c) return null;
  if (code === "history") {
    return {
      hpi: c.hpi,
      past_medical_history: c.past_medical_history,
      past_surgical_history: c.past_surgical_history,
      family_history: c.family_history,
      social_history: c.social_history,
    };
  }
  if (code === "ros") return c.review_of_systems;
  return { exam: c.physical_examination, general_appearance: c.general_appearance };
}

/**
 * The section as the caller should see it: their own unsigned draft if they
 * have one, else the latest signed note that records it, else the visit's
 * record from before signing. Saving writes into the caller's draft, starting
 * one (pre-filled by the server) when they have none.
 */
export function useNoteSection(
  encounterId: string,
  code: SectionCode,
  onFailure?: (error: Error) => void,
) {
  const queryClient = useQueryClient();
  // History, ROS and examination belong to the doctor's note; a nurse reads them.
  const role = usePermissionStore((s) => s.userRole);
  const canWrite = useHasPermission(P.CLINICAL_NOTES.WRITE) && role !== "nurse";
  const notesKey = ["clinical-notes", encounterId] as const;
  const notes = useQuery({
    queryKey: notesKey,
    queryFn: () => clinicalNotesService.listEncounterNotes(encounterId),
  });
  const legacy = useQuery({
    queryKey: ["consultation", encounterId],
    queryFn: () => opdService.getConsultation(encounterId).catch(nullOn404),
  });

  // What the doctor last entered, ahead of the server: each edit builds on
  // it, so two quick edits cannot each start from the same stale copy.
  const [local, setLocal] = useState<{ value: unknown } | null>(null);

  const all = notes.data ?? [];
  const myDraft = all.find((n) => n.is_mine && n.status === "draft" && isConsultation(n));
  const signed = [...all]
    .reverse()
    .find((n) => n.status === "signed" && isConsultation(n) && sectionData(n, code) !== null);
  let source: SectionSource = { kind: "none" };
  if (myDraft) source = { kind: "my_draft", note: myDraft };
  else if (signed) source = { kind: "signed", note: signed };
  else if (legacy.data) source = { kind: "legacy" };
  const server =
    source.kind === "my_draft" || source.kind === "signed"
      ? sectionData(source.note, code)
      : legacyData(legacy.data, code);
  const data = local ? local.value : server;

  // Saves run one after another, so the first one's new draft is the one the
  // next writes into rather than a second draft.
  const draftId = useRef<string | undefined>(undefined);
  draftId.current ??= myDraft?.id;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const persist = (next: unknown): Promise<void> => {
    const run = queue.current.then(async () => {
      const id = draftId.current;
      const saved = id
        ? await clinicalNotesService.saveNoteDraft(id, [{ code, data: next }])
        : await clinicalNotesService.createNote(encounterId, {
            note_type_code: "consultation",
            sections: [{ code, data: next }],
          });
      draftId.current = saved.id;
      await queryClient.invalidateQueries({ queryKey: notesKey });
    });
    queue.current = run.catch(() => undefined);
    return run;
  };
  // Typing in an examination box is many edits: save after a pause, and on
  // leaving the tab whatever is still waiting.
  const persistLater = useDebouncedCallback((next: unknown) => void persist(next).catch(onError), {
    delay: SAVE_DELAY_MS,
    flushOnUnmount: true,
  });
  const onError = (error: Error) => onFailure?.(error);
  // Closing the browser mid-pause would lose the last words: ask first.
  useWindowEvent("beforeunload", (event) => {
    if (persistLater.isPending()) event.preventDefault();
  });
  const save = (next: unknown, immediately = false): Promise<void> => {
    setLocal({ value: next });
    if (immediately) {
      persistLater.cancel();
      return persist(next);
    }
    persistLater(next);
    return Promise.resolve();
  };

  return {
    isPending: notes.isPending || legacy.isPending,
    isError: notes.isError,
    data,
    source,
    canWrite,
    save,
  };
}
