// The transport seam: how the AI chat UI talks to a backend. v1 ships a
// MockTransport; v2 swaps in an SSE transport against POST /api/ai/chat with
// no change to the components or the useAiChat hook.

export type ChatRole = "user" | "assistant" | "system" | "tool";

export type ChatMessageStatus = "streaming" | "complete" | "error";

/** A tool invocation surfaced in the thread (extension point for clinical actions). */
export interface ChatToolCall {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
  status: "pending" | "running" | "done" | "error";
}

/** A grounding citation (clinical-critical: cite KB / guideline). */
export interface ChatSource {
  id: string;
  title: string;
  url?: string;
  snippet?: string;
}

/**
 * A renderable piece of an assistant turn. The UI renders a message as an
 * ordered list of parts, each dispatched to a registered renderer — so the
 * assistant is never limited to a single markdown blob. `custom` is the
 * extension point: a surface registers a `kind` (e.g. "patient-card",
 * "lab-result", "order-confirm") without touching the core renderer.
 */
export type ChatPart =
  | { type: "markdown"; text: string }
  | { type: "code"; language?: string; code: string }
  | { type: "reasoning"; text: string }
  | { type: "tool"; toolCall: ChatToolCall }
  | { type: "sources"; sources: ChatSource[] }
  | { type: "image"; url: string; alt?: string }
  | { type: "custom"; kind: string; data: unknown };

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** Streamed markdown body (the primary part). */
  content: string;
  createdAt: string;
  status?: ChatMessageStatus;
  /** Optional structured parts appended by richer transports (v2). */
  parts?: ChatPart[];
  /** Convenience fields — folded into parts by the unified renderer. */
  reasoning?: string;
  toolCalls?: ChatToolCall[];
  sources?: ChatSource[];
}

/** Ordered parts for a message: explicit `parts` win, else derived from content + convenience fields. */
export function messageParts(message: ChatMessage): ChatPart[] {
  if (message.parts && message.parts.length > 0) return message.parts;
  const parts: ChatPart[] = [];
  if (message.reasoning) parts.push({ type: "reasoning", text: message.reasoning });
  if (message.content) parts.push({ type: "markdown", text: message.content });
  for (const toolCall of message.toolCalls ?? []) parts.push({ type: "tool", toolCall });
  if (message.sources && message.sources.length > 0) {
    parts.push({ type: "sources", sources: message.sources });
  }
  return parts;
}

/** Clinical / page context injected by a surface (patient, encounter, module…). */
export type ChatContext = Record<string, unknown>;

export interface SendOptions {
  signal?: AbortSignal;
  context?: ChatContext;
}

/** One streamed piece of an assistant turn. */
export type ChatChunk =
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }
  | { type: "tool"; toolCall: ChatToolCall }
  | { type: "tool_result"; id: string; result: unknown }
  | { type: "source"; source: ChatSource }
  | { type: "done" }
  | { type: "error"; error: string };

/**
 * A transport streams an assistant turn for the given message history.
 * Implementations MUST honour `opts.signal` for cancellation.
 */
export interface ChatTransport {
  send(messages: ChatMessage[], opts: SendOptions): AsyncIterable<ChatChunk>;
}
