import { api } from "@medbrains/api";
import { type AguiState, fromAgui, newAguiState } from "./agui";
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
 * The server's own words for a refused turn — e.g. "Couldn't run the AI
 * safely, so nothing was sent to it" (redaction failed closed) or "This
 * conversation is about a different patient" — so the user knows why.
 */
export async function refusalReason(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail) return body.detail;
  } catch {
    // Not JSON: fall through to the status.
  }
  return `Assistant unavailable (${response.status})`;
}

/**
 * Streams the assistant reply from `POST /api/ai/chat` as AG-UI events over
 * SSE — the real backend transport (swap in for MockTransport). Stateful: it
 * remembers the server conversation (AG-UI thread) id so multi-turn threads
 * continue the same conversation.
 */
export class SseTransport implements ChatTransport {
  private conversationId?: string;
  private agui: AguiState = newAguiState();

  /** Continue a saved thread (resume) or start fresh when `undefined`. */
  setConversationId(id?: string): void {
    this.conversationId = id;
  }

  async *send(messages: ChatMessage[], opts: SendOptions): AsyncIterable<ChatChunk> {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    this.agui = newAguiState();

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
      yield { type: "error", error: await refusalReason(response) };
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

  /** Map an AG-UI frame to a ChatChunk, capturing the conversation (thread) id. */
  private mapFrame(frame: string): ChatChunk | null {
    const payload = parseFrame(frame);
    if (!payload) return null;
    const chunk = fromAgui(payload, this.agui);
    if (this.agui.threadId) this.conversationId = this.agui.threadId;
    return chunk;
  }
}
