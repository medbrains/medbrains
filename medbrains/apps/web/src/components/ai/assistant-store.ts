import { create } from "zustand";
import type { ChatContext } from "./transport/types";

// Global open/ask state for the app-wide assistant. Any component can drive the
// crab assistant through this store (via the useAiAssistant hook) without prop
// drilling — the AiAssistantMount reads it and renders the drawer + FAB.
interface AiAssistantState {
  isOpen: boolean;
  /** A query queued by `ask()` for the panel to send once mounted/open. */
  pendingQuery: string | null;
  /** Clinical/page context to inject into the conversation. */
  context: ChatContext | undefined;
  open: (opts?: { query?: string; context?: ChatContext }) => void;
  close: () => void;
  toggle: () => void;
  /** Ambiently set the page context (e.g. the patient screen currently open). */
  setContext: (context: ChatContext | undefined) => void;
  /** Read + clear the queued query (the panel calls this after sending it). */
  consumeQuery: () => string | null;
}

export const useAiAssistantStore = create<AiAssistantState>((set, get) => ({
  isOpen: false,
  pendingQuery: null,
  context: undefined,
  open: (opts) =>
    set((state) => ({
      isOpen: true,
      pendingQuery: opts?.query ?? state.pendingQuery,
      context: opts?.context ?? state.context,
    })),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setContext: (context) => set({ context }),
  consumeQuery: () => {
    const query = get().pendingQuery;
    if (query !== null) set({ pendingQuery: null });
    return query;
  },
}));
