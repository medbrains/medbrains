import { create } from "zustand";

/** A live clinical alert surfaced in the island (from the whisper SSE). */
export interface LiveWhisper {
  id: string;
  title: string;
  message: string;
  patientId?: string;
  /** e.g. 'code_blue' | 'lab_critical' — drives escalation styling. */
  kind?: string;
}

interface LiveActivityState {
  whisper: LiveWhisper | null;
  pushWhisper: (w: LiveWhisper) => void;
  dismiss: () => void;
}

/**
 * The "what needs me right now" layer behind the Live Activity Island. The whisper
 * SSE pushes critical alerts here; the island reads them and morphs/escalates.
 */
export const useLiveActivityStore = create<LiveActivityState>((set) => ({
  whisper: null,
  pushWhisper: (whisper) => set({ whisper }),
  dismiss: () => set({ whisper: null }),
}));
