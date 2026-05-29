import { create } from "zustand";
import type { ClinicalEventTrace } from "./clinical-events";

const MAX_RECENT_EVENTS = 80;

interface ClinicalEventStore {
  recentEvents: ClinicalEventTrace[];
  recordEvent: (event: ClinicalEventTrace) => void;
  clearEvents: () => void;
}

export const useClinicalEventStore = create<ClinicalEventStore>((set) => ({
  recentEvents: [],
  recordEvent: (event) =>
    set((state) => ({
      recentEvents: [event, ...state.recentEvents].slice(0, MAX_RECENT_EVENTS),
    })),
  clearEvents: () => set({ recentEvents: [] }),
}));
