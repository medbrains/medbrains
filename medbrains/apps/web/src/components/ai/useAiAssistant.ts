import { useAiAssistantStore } from "./assistant-store";
import type { ChatContext } from "./transport/types";

/**
 * The interfacing API for the app-wide assistant. Any surface can open, close,
 * or `ask()` the crab assistant — e.g. an "Explain this result" button, a
 * command-palette entry, or the navbar toggle.
 *
 *   const assistant = useAiAssistant();
 *   assistant.ask("Summarize this patient's labs", { patient_id });
 */
export function useAiAssistant() {
  const open = useAiAssistantStore((state) => state.open);
  const close = useAiAssistantStore((state) => state.close);
  const toggle = useAiAssistantStore((state) => state.toggle);
  const isOpen = useAiAssistantStore((state) => state.isOpen);

  return {
    isOpen,
    open,
    close,
    toggle,
    /** Open the assistant and queue a question, optionally with context. */
    ask: (query: string, context?: ChatContext) => open({ query, context }),
  };
}
