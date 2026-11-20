import { describe, expect, it } from "vitest";
import { toolResultInfo } from "./ToolView";

describe("a drug check that did not run is never shown as blocked or done", () => {
  it("reads checked: false as not checked, with the server's reason", () => {
    const notes = "Not checked: no patient chart is loaded.";
    expect(toolResultInfo({ drug: "Ceftriaxone", checked: false, notes })).toEqual({
      outcome: "unchecked",
      message: notes,
    });
  });

  it("still shows a flagged drug as blocked, and a clear one as done", () => {
    const flagged = { checked: true, safe: false, warnings: ["x"], notes: "Safety warnings: x" };
    expect(toolResultInfo(flagged).outcome).toBe("blocked");
    expect(toolResultInfo({ checked: true, safe: true, warnings: [] }).outcome).toBe("done");
    expect(toolResultInfo({ decision: "blocked", message: "m" })).toEqual({
      outcome: "blocked",
      message: "m",
    });
  });
});

describe("a refused action says which refusal it was", () => {
  it("never shows could-not-check as not allowed, nor either as done", () => {
    const unknown = { refused: "unknown", message: "I couldn't check that right now." };
    expect(toolResultInfo(unknown)).toEqual({ outcome: "unchecked", message: unknown.message });
    const denied = { refused: "not_allowed", message: "You're not allowed to see this." };
    expect(toolResultInfo(denied)).toEqual({ outcome: "denied", message: denied.message });
    const confirm = { refused: "needs_confirmation", message: "This needs your confirmation." };
    expect(toolResultInfo(confirm)).toEqual({ outcome: "confirm", message: confirm.message });
    expect(toolResultInfo({ ok: [] }).outcome).toBe("done");
  });
});
