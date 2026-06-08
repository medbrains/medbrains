import { describe, expect, it } from "vitest";
import { workflowSignalColors, workflowSignalShapeStyle } from "./workflow-signal-shape-style.js";

describe("workflow signal mobile shape style", () => {
  it("maps workflow tones to mobile-safe contrast colors", () => {
    expect(workflowSignalColors("risk").text).toBe("#B91C1C");
    expect(workflowSignalColors("active").border).toBe("#0066CC");
    expect(workflowSignalColors("ready").text).toBe("#047857");
    expect(workflowSignalColors("complete").text).toBe("#047857");
    expect(workflowSignalColors("blocked").text).toBe("#B45309");
    expect(workflowSignalColors("neutral").text).toBe("#5B5B57");
  });

  it("renders stop, handoff, ready, and bed states as distinct marker geometry", () => {
    expect(workflowSignalShapeStyle({ shape: "diamond", tone: "risk" })).toMatchObject({
      borderRadius: 3,
      transform: [{ rotate: "45deg" }],
    });
    expect(workflowSignalShapeStyle({ shape: "token", tone: "active" })).toMatchObject({
      borderRadius: 4,
      width: 13,
    });
    expect(workflowSignalShapeStyle({ shape: "pill", tone: "ready" })).toMatchObject({
      borderRadius: 999,
      width: 27,
    });
    expect(
      workflowSignalShapeStyle({
        pillExtension: 13,
        shape: "bed",
        size: 12,
        tone: "ready",
      }),
    ).toMatchObject({
      borderRadius: 3,
      height: 12,
      width: 31,
    });
  });

  it("keeps high-emphasis safety markers visually stronger", () => {
    expect(
      workflowSignalShapeStyle({
        emphasis: "high",
        shape: "diamond",
        tone: "risk",
      }),
    ).toMatchObject({
      borderWidth: 2,
      height: 16,
      width: 16,
    });
  });
});
