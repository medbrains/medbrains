import { api } from "@medbrains/api";
import type { ChatChunk, ChatMessage, ChatTransport, SendOptions } from "./types";

/** Pull the JSON payload out of one `data: {...}` SSE frame. */
function parseFrame(frame: string): Record<string, unknown> | null {
  const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
  if (!dataLine) return null;
  try {
    return JSON.parse(dataLine.slice(5).trim());
  } catch {
    return null;
  }
}

/**
 * Streams the assistant reply from `POST /api/ai/chat` over SSE — the real
 * backend transport (swap in for MockTransport). Stateful: it remembers the
 * server conversation id so multi-turn threads continue the same conversation.
 */
export class SseTransport implements ChatTransport {
  private conversationId?: string;

  async *send(messages: ChatMessage[], opts: SendOptions): AsyncIterable<ChatChunk> {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;

    let response: Response;
    try {
      response = await api.chatStream(
        {
          message: lastUser.content,
          conversation_id: this.conversationId,
          context: opts.context,
        },
        opts.signal,
      );
    } catch (error) {
      if (opts.signal?.aborted) return;
      yield { type: "error", error: error instanceof Error ? error.message : "Network error" };
      return;
    }

    if (!response.ok || !response.body) {
      yield { type: "error", error: `Assistant unavailable (${response.status})` };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line.
        for (;;) {
          const sep = buffer.indexOf("\n\n");
          if (sep === -1) break;
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const chunk = this.mapFrame(frame);
          if (chunk) yield chunk;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /** Map a backend frame to a ChatChunk, capturing the conversation id. */
  private mapFrame(frame: string): ChatChunk | null {
    const payload = parseFrame(frame);
    if (!payload) return null;
    switch (payload.type) {
      case "text":
        return typeof payload.text === "string" ? { type: "text", delta: payload.text } : null;
      case "done":
        if (typeof payload.conversationId === "string") {
          this.conversationId = payload.conversationId;
        }
        return { type: "done" };
      case "error":
        return { type: "error", error: String(payload.message ?? "Assistant error") };
      default:
        return null;
    }
  }
}
