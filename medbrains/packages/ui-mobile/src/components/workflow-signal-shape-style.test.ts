import { describe, expect, it } from "vitest";
import { COLORS, INTENT_FG } from "../tokens.js";
import { workflowSignalColors, workflowSignalShapeStyle } from "./workflow-signal-shape-style.js";

describe("workflow signal mobile shape style", () => {
  it("maps workflow tones to Carbon intent colors", () => {
    // Assert the semantic mapping against the token source, not brittle literals.
    expect(workflowSignalColors("risk").text).toBe(INTENT_FG.alert);
    expect(workflowSignalColors("active").border).toBe(COLORS.brand);
    expect(workflowSignalColors("ready").text).toBe(INTENT_FG.success);
    expect(workflowSignalColors("complete").text).toBe(INTENT_FG.success);
    expect(workflowSignalColors("blocked").text).toBe(INTENT_FG.warn);
    expect(workflowSignalColors("neutral").text).toBe(COLORS.muted);
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
