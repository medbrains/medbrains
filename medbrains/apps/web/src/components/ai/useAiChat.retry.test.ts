import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChatChunk, ChatTransport } from "./transport/types";
import { useAiChat } from "./useAiChat";

describe("a retried answer replaces the attempt the guard rejected", () => {
  it("drops the text shown before a reset and keeps only the retry", async () => {
    const transport: ChatTransport = {
      setConversationId: vi.fn(),
      async *send(): AsyncIterable<ChatChunk> {
        yield { type: "text", delta: "Hb is low. " };
        yield { type: "reset" };
        yield { type: "text", delta: "Hb 8.2 g/dL is recorded, flagged low." };
        yield { type: "done", usage: { input: 10, output: 5, cacheRead: 1200, cacheWrite: 0 } };
      },
    };
    const { result } = renderHook(() => useAiChat({ transport }));
    await act(() => result.current.send("What is recorded?"));
    const answer = result.current.messages.at(-1);
    expect(answer?.content).toBe("Hb 8.2 g/dL is recorded, flagged low.");
    expect(answer?.usage?.cacheRead).toBe(1200);
  });
});
