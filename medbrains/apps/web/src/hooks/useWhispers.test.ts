import { afterEach, describe, expect, it } from "vitest";
import { useLiveActivityStore } from "@/components/LiveActivityIsland/live-activity-store";
import { setWhisperHealth, whisperQuestion } from "./useWhispers";

afterEach(() => setWhisperHealth(true));

describe("live critical-alert whispers", () => {
  it("says it couldn't check when the feed cannot answer, and clears when it does", () => {
    setWhisperHealth(false);
    const shown = useLiveActivityStore.getState().activities["whisper-status"];
    expect(shown?.title).toBe("Couldn't check for critical alerts");
    expect(shown?.dismissible).toBe(false);
    setWhisperHealth(true);
    expect(useLiveActivityStore.getState().activities["whisper-status"]).toBeUndefined();
  });

  it("names whose result it is when asking the assistant", () => {
    expect(
      whisperQuestion({
        message: "Potassium = 6.9 [critical_high]",
        patientLabel: "Kavitha S (UH-1)",
      }),
    ).toContain("for Kavitha S (UH-1)");
  });
});
