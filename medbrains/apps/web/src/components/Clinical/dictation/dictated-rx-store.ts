import type { ModelMedicine } from "@medbrains/types";
import { create } from "zustand";

/** The server drafts at most this many medicines; the pad never holds more. */
const MAX_LINES = 20;

interface DictatedRxState {
  /** Medicines the doctor accepted from a dictation, waiting on the prescription pad. */
  byEncounter: Record<string, ModelMedicine[]>;
  /** Hand one accepted medicine to this visit's prescription writer. */
  offer: (encounterId: string, medicine: ModelMedicine) => void;
  /** The writer has loaded them; they are no longer waiting. */
  clear: (encounterId: string) => void;
}

/**
 * Dictated medicines travel from the dictation review to the prescription
 * writer here, never to the server: they become a prescription only when the
 * doctor saves it on the Prescriptions tab, through every safety check there.
 */
export const useDictatedRxStore = create<DictatedRxState>((set) => ({
  byEncounter: {},
  offer: (encounterId, medicine) =>
    set((state) => {
      const lines = state.byEncounter[encounterId] ?? [];
      if (lines.length >= MAX_LINES || lines.some((m) => m.name === medicine.name)) return state;
      return { byEncounter: { ...state.byEncounter, [encounterId]: [...lines, medicine] } };
    }),
  clear: (encounterId) =>
    set((state) => {
      const { [encounterId]: _gone, ...rest } = state.byEncounter;
      return { byEncounter: rest };
    }),
}));
