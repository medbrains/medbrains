import type { api } from "@medbrains/api";
import type {
  AiWidget,
  ChatMessage,
  ChatRole,
  ChatSource,
  ChatToolCall,
  TokenUsage,
} from "./types";

/** One stored message as the API returns it. */
type StoredMessage = Awaited<ReturnType<typeof api.getAiConversationMessages>>[number];

/** A widget kept only as what to fetch again (it may have listed patients). */
export interface StoredReplay {
  /** Its position among the answer's kept widgets (the endpoint's index). */
  index: number;
  kind: string;
  title: string;
}

const array = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * A stored message as the chat shows it: the same fields a live answer
 * builds while streaming, so a reopened conversation renders the same.
 */
export function fromStored(m: StoredMessage): ChatMessage {
  const parts = (m.parts ?? {}) as Record<string, unknown>;
  const widgets: AiWidget[] = [];
  const replays: StoredReplay[] = [];
  array(parts.widgets).forEach((entry, index) => {
    const e = entry as Record<string, unknown>;
    if (e.widget) widgets.push(e.widget as AiWidget);
    else if (e.refetch)
      replays.push({ index, kind: String(e.kind ?? ""), title: String(e.title ?? "") });
  });
  const message: ChatMessage = {
    id: m.id,
    role: m.role as ChatRole,
    content: m.content,
    createdAt: m.created_at,
    status: "complete",
  };
  const calls = array(parts.toolCalls) as ChatToolCall[];
  const sources = array(parts.sources) as ChatSource[];
  const notices = array(parts.guardNotices).filter((n): n is string => typeof n === "string");
  if (calls.length) message.toolCalls = calls;
  if (widgets.length) message.widgets = widgets;
  if (replays.length) message.replays = replays;
  if (sources.length) message.sources = sources;
  if (notices.length) message.guardNotices = notices;
  if (parts.usage) message.usage = parts.usage as TokenUsage;
  if (typeof parts.elapsedMs === "number") message.elapsedMs = parts.elapsedMs;
  return message;
}
