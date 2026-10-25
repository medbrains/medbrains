import { describe, expect, it } from "vitest";
import { fromAgui, newAguiState } from "./agui";

describe("the chat stream speaks AG-UI", () => {
  it("turns a run's events into chat chunks", () => {
    const s = newAguiState();
    const run = [
      { type: "RUN_STARTED", threadId: "conv-1", runId: "run-1" },
      { type: "TEXT_MESSAGE_START", messageId: "m", role: "assistant" },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "m", delta: "Hb 8.2 g/dL." },
      { type: "TOOL_CALL_START", toolCallId: "t1", toolCallName: "call_api", parentMessageId: "m" },
      { type: "TOOL_CALL_ARGS", toolCallId: "t1", delta: '{"path":"/api/x"}' },
      { type: "TOOL_CALL_END", toolCallId: "t1" },
      { type: "TOOL_CALL_RESULT", messageId: "m", toolCallId: "t1", content: '{"ok":1}' },
      { type: "CUSTOM", name: "medbrains.guard", value: { notices: ["Removed: a diagnosis."] } },
      { type: "TEXT_MESSAGE_END", messageId: "m" },
      {
        type: "RUN_FINISHED",
        threadId: "conv-1",
        runId: "run-1",
        result: { usage: { input: 9, output: 3, cacheRead: 1200, cacheWrite: 0 } },
      },
    ];
    const chunks = run.map((e) => fromAgui(e, s)).filter(Boolean);
    expect(chunks).toEqual([
      { type: "text", delta: "Hb 8.2 g/dL." },
      {
        type: "tool",
        toolCall: { id: "t1", name: "call_api", args: { path: "/api/x" }, status: "running" },
      },
      { type: "tool_result", id: "t1", result: { ok: 1 } },
      { type: "guard", notices: ["Removed: a diagnosis."] },
      { type: "done", usage: { input: 9, output: 3, cacheRead: 1200, cacheWrite: 0 } },
    ]);
    expect(s.threadId).toBe("conv-1");
  });

  it("drops a widget outside the catalogue and ends a failed run as an error", () => {
    const s = newAguiState();
    expect(
      fromAgui(
        { type: "CUSTOM", name: "medbrains.widget", value: { kind: "html", title: "x" } },
        s,
      ),
    ).toBeNull();
    expect(fromAgui({ type: "CUSTOM", name: "medbrains.reset", value: null }, s)).toEqual({
      type: "reset",
    });
    expect(
      fromAgui({ type: "RUN_ERROR", message: "The AI could not finish this answer." }, s),
    ).toEqual({
      type: "error",
      error: "The AI could not finish this answer.",
    });
  });
});
