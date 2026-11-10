import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChatChunk, ChatMessage, ChatTransport, SendOptions } from "./transport/types";
import { effectiveContext, useAiChat } from "./useAiChat";

/** Records what each turn was sent with; answers "ok". */
function recordingTransport() {
  const turns: { history: ChatMessage[]; opts: SendOptions }[] = [];
  const transport: ChatTransport = {
    setConversationId: vi.fn(),
    async *send(history, opts): AsyncIterable<ChatChunk> {
      turns.push({ history, opts });
      yield { type: "text", delta: "ok" };
      yield { type: "done" };
    },
  };
  return { transport, turns };
}

describe("one assistant thread is about one patient", () => {
  it("starts a new thread when asked from another patient's chart", async () => {
    const { transport, turns } = recordingTransport();
    const { result, rerender } = renderHook(
      ({ patient }) => useAiChat({ transport, context: { patient_id: patient } }),
      {
        initialProps: { patient: "patient-a" },
      },
    );
    await act(() => result.current.send("Summarise the labs"));
    rerender({ patient: "patient-b" });
    await act(() => result.current.send("And now?"));

    expect(transport.setConversationId).toHaveBeenCalledWith(undefined);
    const second = turns[1];
    expect(second?.opts.context).toEqual({ patient_id: "patient-b" });
    // Patient A's turns are not sent as history for patient B.
    expect(second?.history.map((m) => m.content)).toEqual(["And now?"]);
    expect(result.current.messages.every((m) => m.patientId === "patient-b")).toBe(true);
  });

  it("keeps the thread for more questions about the same patient", async () => {
    const { transport, turns } = recordingTransport();
    const { result } = renderHook(() =>
      useAiChat({ transport, context: { patient_id: "patient-a" } }),
    );
    await act(() => result.current.send("First"));
    await act(() => result.current.send("Second"));
    expect(transport.setConversationId).not.toHaveBeenCalled();
    expect(turns[1]?.history.filter((m) => m.role === "user")).toHaveLength(2);
  });

  it("lets the patient on screen win over one picked earlier in the thread", () => {
    expect(
      effectiveContext(undefined, { patient_id: "on-screen" }, { patient_id: "picked" }),
    ).toEqual({ patient_id: "on-screen" });
    expect(effectiveContext(undefined, { module: "lab" }, { patient_id: "picked" })).toEqual({
      patient_id: "picked",
    });
  });
});
