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
