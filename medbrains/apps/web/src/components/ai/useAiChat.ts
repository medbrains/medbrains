import { useCallback, useRef, useState } from "react";
import type { ChatContext, ChatMessage, ChatTransport } from "./transport/types";

export type ChatStatus = "idle" | "streaming" | "error";

export interface UseAiChatOptions {
  transport: ChatTransport;
  /** Clinical/page context injected into every send (patient, encounter…). */
  context?: ChatContext;
  /** Seed messages (e.g. a system greeting). */
  initialMessages?: ChatMessage[];
}

export interface UseAiChat {
  messages: ChatMessage[];
  status: ChatStatus;
  send: (text: string, opts?: { context?: ChatContext }) => Promise<void>;
  stop: () => void;
  reset: () => void;
  regenerate: () => Promise<void>;
  /** Replace the thread with loaded messages (e.g. resuming a saved conversation). */
  hydrate: (messages: ChatMessage[]) => void;
}

function newId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

/** The patient a context is about, if any. */
export function patientOf(context: ChatContext | undefined): string | undefined {
  const id = context?.patient_id;
  return typeof id === "string" && id ? id : undefined;
}

/**
 * The context a turn runs with. This turn's context wins; then the patient on
 * screen — a patient picked earlier in the thread must never answer a question
 * asked from another patient's chart; then the thread's sticky pick.
 */
export function effectiveContext(
  turn: ChatContext | undefined,
  page: ChatContext | undefined,
  sticky: ChatContext | undefined,
): ChatContext | undefined {
  if (turn) return turn;
  if (patientOf(page)) return page;
  return sticky ?? page;
}

/**
 * Headless AI-chat controller. UI-agnostic: every surface (drawer, popover,
 * page, inline) composes the same hook + primitives. Transport is swappable
 * (mock now, SSE later) so no component changes when the backend lands.
 */
export function useAiChat({
  transport,
  context,
  initialMessages = [],
}: UseAiChatOptions): UseAiChat {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const abortRef = useRef<AbortController | null>(null);
  // A context supplied mid-thread (e.g. picking a patient) sticks for the rest
  // of the conversation, so the assistant doesn't ask to pick again each turn.
  const sessionContextRef = useRef<ChatContext | undefined>(undefined);
  // One thread is about one patient (the server refuses to mix them).
  const threadPatientRef = useRef<string | undefined>(undefined);

  const runTurn = useCallback(
    async (history: ChatMessage[], contextOverride?: ChatContext) => {
      const assistant: ChatMessage = {
        id: newId(),
        role: "assistant",
        content: "",
        createdAt: now(),
        status: "streaming",
        patientId: patientOf(contextOverride ?? context),
      };
      setMessages([...history, assistant]);
      setStatus("streaming");
      const started = performance.now();

      const controller = new AbortController();
      abortRef.current = controller;

      const patch = (fn: (m: ChatMessage) => ChatMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === assistant.id ? fn(m) : m)));

      try {
        for await (const chunk of transport.send(history, {
          signal: controller.signal,
          context: contextOverride ?? context,
        })) {
          if (chunk.type === "text") {
            patch((m) => ({ ...m, content: m.content + chunk.delta }));
          } else if (chunk.type === "reasoning") {
            patch((m) => ({ ...m, reasoning: (m.reasoning ?? "") + chunk.delta }));
          } else if (chunk.type === "tool") {
            // Upsert by id so the running chip becomes the resolved one.
            patch((m) => {
              const existing = m.toolCalls ?? [];
              const idx = existing.findIndex((t) => t.id === chunk.toolCall.id);
              const toolCalls =
                idx >= 0
                  ? existing.map((t, i) => (i === idx ? { ...t, ...chunk.toolCall } : t))
                  : [...existing, chunk.toolCall];
              return { ...m, toolCalls };
            });
          } else if (chunk.type === "tool_result") {
            patch((m) => ({
              ...m,
              toolCalls: (m.toolCalls ?? []).map((t) =>
                t.id === chunk.id ? { ...t, result: chunk.result, status: "done" } : t,
              ),
            }));
          } else if (chunk.type === "guard") {
            patch((m) => ({ ...m, guardNotices: chunk.notices }));
          } else if (chunk.type === "source") {
            patch((m) => ({ ...m, sources: [...(m.sources ?? []), chunk.source] }));
          } else if (chunk.type === "error") {
            patch((m) => ({ ...m, status: "error", error: chunk.error }));
            setStatus("error");
            return;
          } else if (chunk.type === "widget") {
            patch((m) => ({ ...m, widgets: [...(m.widgets ?? []), chunk.widget] }));
          } else if (chunk.type === "reset") {
            patch((m) => ({ ...m, content: "" }));
          } else if (chunk.type === "done") {
            const elapsedMs = Math.round(performance.now() - started);
            patch((m) => ({ ...m, status: "complete", usage: chunk.usage, elapsedMs }));
          }
        }
        setStatus("idle");
      } catch {
        patch((m) => ({ ...m, status: "error" }));
        setStatus("error");
      } finally {
        abortRef.current = null;
      }
    },
    [transport, context],
  );

  const send = useCallback(
    async (text: string, opts?: { context?: ChatContext }) => {
      const trimmed = text.trim();
      if (!trimmed || status === "streaming") return;
      if (opts?.context) sessionContextRef.current = opts.context;
      const effective = effectiveContext(opts?.context, context, sessionContextRef.current);
      const patient = patientOf(effective);
      // Asked about a different patient than this thread: start a new thread,
      // so one patient's history never grounds an answer about another.
      const switching =
        !!patient && !!threadPatientRef.current && patient !== threadPatientRef.current;
      if (switching) {
        transport.setConversationId?.(undefined);
        sessionContextRef.current = opts?.context;
      }
      if (patient) threadPatientRef.current = patient;
      const user: ChatMessage = {
        id: newId(),
        role: "user",
        content: trimmed,
        createdAt: now(),
        status: "complete",
        patientId: patient,
      };
      await runTurn([...(switching ? [] : messages), user], effective);
    },
    [messages, status, runTurn, context, transport],
  );

  const regenerate = useCallback(async () => {
    if (status === "streaming") return;
    // Drop the trailing assistant turn(s) and replay from the last user message.
    let end = messages.length;
    while (end > 0 && messages[end - 1]?.role !== "user") end -= 1;
    if (end === 0) return;
    await runTurn(messages.slice(0, end));
  }, [messages, status, runTurn]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    sessionContextRef.current = undefined;
    threadPatientRef.current = undefined;
    setMessages(initialMessages);
    setStatus("idle");
  }, [initialMessages]);

  const hydrate = useCallback((loaded: ChatMessage[]) => {
    abortRef.current?.abort();
    threadPatientRef.current = undefined;
    setMessages(loaded);
    setStatus("idle");
  }, []);

  return { messages, status, send, stop, reset, regenerate, hydrate };
}
