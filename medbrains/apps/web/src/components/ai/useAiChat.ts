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
  send: (text: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
  regenerate: () => Promise<void>;
}

function newId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
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

  const runTurn = useCallback(
    async (history: ChatMessage[]) => {
      const assistant: ChatMessage = {
        id: newId(),
        role: "assistant",
        content: "",
        createdAt: now(),
        status: "streaming",
      };
      setMessages([...history, assistant]);
      setStatus("streaming");

      const controller = new AbortController();
      abortRef.current = controller;

      const patch = (fn: (m: ChatMessage) => ChatMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === assistant.id ? fn(m) : m)));

      try {
        for await (const chunk of transport.send(history, { signal: controller.signal, context })) {
          if (chunk.type === "text") {
            patch((m) => ({ ...m, content: m.content + chunk.delta }));
          } else if (chunk.type === "reasoning") {
            patch((m) => ({ ...m, reasoning: (m.reasoning ?? "") + chunk.delta }));
          } else if (chunk.type === "tool") {
            patch((m) => ({ ...m, toolCalls: [...(m.toolCalls ?? []), chunk.toolCall] }));
          } else if (chunk.type === "source") {
            patch((m) => ({ ...m, sources: [...(m.sources ?? []), chunk.source] }));
          } else if (chunk.type === "error") {
            patch((m) => ({ ...m, status: "error" }));
            setStatus("error");
            return;
          } else if (chunk.type === "done") {
            patch((m) => ({ ...m, status: "complete" }));
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
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === "streaming") return;
      const user: ChatMessage = {
        id: newId(),
        role: "user",
        content: trimmed,
        createdAt: now(),
        status: "complete",
      };
      await runTurn([...messages, user]);
    },
    [messages, status, runTurn],
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
    setMessages(initialMessages);
    setStatus("idle");
  }, [initialMessages]);

  return { messages, status, send, stop, reset, regenerate };
}
