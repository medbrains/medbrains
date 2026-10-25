import type { AiWidget, ChatChunk, ChatSource, ChatToolCall, TokenUsage } from "./types";

/** What the stream remembers between AG-UI events of one run. */
export interface AguiState {
  /** Tool calls opened and not yet ended: name and argument text so far. */
  tools: Map<string, { name: string; args: string }>;
  /** The conversation (AG-UI thread) the server put this run in. */
  threadId?: string;
}

export const newAguiState = (): AguiState => ({ tools: new Map() });

const WIDGET_KINDS = new Set(["kpis", "table", "chart", "list"]);

/** Only a widget from the closed catalogue renders; anything else is dropped. */
function isWidget(raw: unknown): raw is AiWidget {
  return (
    !!raw &&
    typeof raw === "object" &&
    WIDGET_KINDS.has(String((raw as { kind?: unknown }).kind)) &&
    typeof (raw as { title?: unknown }).title === "string"
  );
}

/** The run's token counts, if the result carries a well-formed set. */
function usageOf(raw: unknown): TokenUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const u = raw as Record<string, unknown>;
  const n = (k: string) => (typeof u[k] === "number" ? (u[k] as number) : undefined);
  const [input, output] = [n("input"), n("output")];
  if (input === undefined || output === undefined) return undefined;
  return { input, output, cacheRead: n("cacheRead") ?? 0, cacheWrite: n("cacheWrite") ?? 0 };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Our `medbrains.*` CUSTOM events (guard, reset, widget, source). */
function custom(name: unknown, value: unknown): ChatChunk | null {
  switch (name) {
    case "medbrains.guard": {
      const notices = (value as { notices?: unknown })?.notices;
      return Array.isArray(notices)
        ? { type: "guard", notices: notices.filter((n): n is string => typeof n === "string") }
        : null;
    }
    case "medbrains.reset":
      return { type: "reset" };
    case "medbrains.widget":
      return isWidget(value) ? { type: "widget", widget: value } : null;
    case "medbrains.source":
      return value && typeof value === "object"
        ? { type: "source", source: value as ChatSource }
        : null;
    default:
      return null;
  }
}

/** One AG-UI event (docs.ag-ui.com/concepts/events) as a chat chunk, or null. */
export function fromAgui(e: Record<string, unknown>, state: AguiState): ChatChunk | null {
  const id = typeof e.toolCallId === "string" ? e.toolCallId : "";
  switch (e.type) {
    case "RUN_STARTED":
      if (typeof e.threadId === "string") state.threadId = e.threadId;
      return null;
    case "TEXT_MESSAGE_CONTENT":
      return typeof e.delta === "string" && e.delta ? { type: "text", delta: e.delta } : null;
    case "TOOL_CALL_START":
      state.tools.set(id, { name: String(e.toolCallName ?? ""), args: "" });
      return null;
    case "TOOL_CALL_ARGS": {
      const open = state.tools.get(id);
      if (open && typeof e.delta === "string") open.args += e.delta;
      return null;
    }
    case "TOOL_CALL_END": {
      const open = state.tools.get(id);
      state.tools.delete(id);
      if (!open) return null;
      const args = parseJson(open.args || "{}");
      const toolCall: ChatToolCall = {
        id,
        name: open.name,
        args: (args && typeof args === "object" ? args : {}) as Record<string, unknown>,
        status: "running",
      };
      return { type: "tool", toolCall };
    }
    case "TOOL_CALL_RESULT":
      return id ? { type: "tool_result", id, result: parseJson(String(e.content ?? "")) } : null;
    case "CUSTOM":
      return custom(e.name, e.value);
    case "RUN_ERROR":
      return { type: "error", error: String(e.message ?? "Assistant error") };
    case "RUN_FINISHED": {
      if (typeof e.threadId === "string") state.threadId = e.threadId;
      const result = e.result as { usage?: unknown } | undefined;
      return { type: "done", usage: usageOf(result?.usage) };
    }
    default:
      return null;
  }
}
