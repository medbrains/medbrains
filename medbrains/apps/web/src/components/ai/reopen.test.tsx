import { api } from "@medbrains/api";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { Message } from "./Message";
import { fromAgui, newAguiState } from "./transport/agui";
import { fromStored } from "./transport/stored";
import type { ChatChunk, ChatTransport } from "./transport/types";
import { useAiChat } from "./useAiChat";

const chart = {
  kind: "kpis",
  title: "Revenue (12 months)",
  tiles: [{ label: "Billed", value: "46476791.72", money: true }],
};

/** One live run, as the server streams it (AG-UI). */
const LIVE = [
  { type: "RUN_STARTED", threadId: "c1", runId: "r1" },
  { type: "TOOL_CALL_START", toolCallId: "t1", toolCallName: "aggregate", parentMessageId: "m" },
  { type: "TOOL_CALL_ARGS", toolCallId: "t1", delta: "{}" },
  { type: "TOOL_CALL_END", toolCallId: "t1" },
  { type: "TOOL_CALL_RESULT", messageId: "m", toolCallId: "t1", content: "{}" },
  { type: "CUSTOM", name: "medbrains.widget", value: chart },
  { type: "TEXT_MESSAGE_CONTENT", messageId: "m", delta: "Billed ₹4,64,76,791.72 in 12 months." },
  { type: "CUSTOM", name: "medbrains.guard", value: { notices: ["Removed: a guess."] } },
  {
    type: "RUN_FINISHED",
    threadId: "c1",
    runId: "r1",
    result: { usage: { input: 9, output: 3, cacheRead: 1200, cacheWrite: 0 } },
  },
];

/** The same answer as the server keeps it (`ai_messages.parts`). */
const STORED = {
  id: "m1",
  role: "assistant",
  content: "Billed ₹4,64,76,791.72 in 12 months.",
  created_at: "2026-10-25T09:00:00Z",
  parts: {
    toolCalls: [{ id: "t1", name: "aggregate", status: "done", args: {}, result: {} }],
    widgets: [{ widget: chart }, { refetch: { source: "/api/x" }, kind: "table", title: "Bills" }],
    sources: [],
    guardNotices: ["Removed: a guess."],
    retried: false,
    usage: { input: 9, output: 3, cacheRead: 1200, cacheWrite: 0 },
    model: "claude-haiku-5-5",
  },
};

describe("a reopened answer shows what the live one showed", () => {
  it("renders the same steps, chart, text and notice", async () => {
    vi.spyOn(api, "aiReplayWidget").mockRejectedValue(new Error("403"));
    const state = newAguiState();
    const transport: ChatTransport = {
      setConversationId: vi.fn(),
      async *send(): AsyncIterable<ChatChunk> {
        for (const e of LIVE) {
          const c = fromAgui(e, state);
          if (c) yield c;
        }
      },
    };
    const { result } = renderHook(() => useAiChat({ transport }));
    await act(() => result.current.send("from overall data past 12 months"));
    const live = result.current.messages.at(-1);
    expect(live).toBeDefined();
    if (!live) return;
    const liveView = render(<Message message={{ ...live, elapsedMs: undefined }} />);
    const liveText = liveView.container.textContent;
    liveView.unmount();

    render(<Message message={fromStored(STORED)} />);
    // The reopened answer adds only the not-kept table's honest notice.
    expect(await screen.findByText(/no longer available/)).toBeInTheDocument();
    const reopened = document.body.textContent ?? "";
    for (const piece of [
      "Looked up 1 step",
      "Revenue (12 months)",
      "₹4,64,76,791.72",
      "Removed: a guess.",
    ]) {
      expect(liveText).toContain(piece);
      expect(reopened).toContain(piece);
    }
  });
});
