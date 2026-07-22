import type { MedicationTiming } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  foodTimingLabel,
  frequencyToDefaultSlots,
  instructionsDisplayText,
  parseInstructions,
  serializeTiming,
  timeSlotHour,
  timeSlotLabel,
  timingToHumanReadable,
} from "./medication-timing-utils";

/**
 * These turn a prescription's stored instructions into what a nurse reads
 * before administering, and a frequency code into the slots a dose is
 * expected in. Both fall back silently rather than erroring, so the
 * fallbacks are pinned explicitly below.
 */

describe("parseInstructions", () => {
  it("returns null for absent instructions", () => {
    expect(parseInstructions(null)).toBeNull();
    expect(parseInstructions(undefined)).toBeNull();
    expect(parseInstructions("")).toBeNull();
  });

  it("returns structured timing for versioned JSON", () => {
    const raw = serializeTiming({ food_timing: "before_food", time_slots: ["morning"] });
    expect(parseInstructions(raw)).toEqual({
      _v: 1,
      food_timing: "before_food",
      time_slots: ["morning"],
    });
  });

  it("treats non-JSON as free text, which is the common legacy case", () => {
    expect(parseInstructions("Take with a full glass of water")).toEqual({
      text: "Take with a full glass of water",
    });
  });

  /**
   * QUIRK: the structured branch requires `_v === 1` exactly. JSON that is
   * shaped like timing but missing or carrying a different version falls
   * through to the free-text branch — so the nurse is shown the raw JSON
   * string rather than a rendered instruction or an error.
   */
  it("QUIRK: timing JSON without _v:1 is shown as raw JSON text", () => {
    const noVersion = '{"food_timing":"before_food","time_slots":["morning"]}';
    expect(parseInstructions(noVersion)).toEqual({ text: noVersion });
    expect(instructionsDisplayText(noVersion)).toBe(noVersion);

    const futureVersion = '{"_v":2,"food_timing":"before_food"}';
    expect(parseInstructions(futureVersion)).toEqual({ text: futureVersion });
  });

  it("bare JSON scalars are free text, not structured timing", () => {
    // "null" and "123" parse as valid JSON but are not timing objects.
    expect(parseInstructions("null")).toEqual({ text: "null" });
    expect(parseInstructions("123")).toEqual({ text: "123" });
  });

  it("round-trips through serializeTiming", () => {
    const timing = { food_timing: "after_food", custom_instruction: "with milk" } as const;
    expect(parseInstructions(serializeTiming(timing))).toEqual({ _v: 1, ...timing });
  });
});

describe("frequencyToDefaultSlots", () => {
  it("maps the standard frequency codes", () => {
    expect(frequencyToDefaultSlots("OD")).toEqual(["morning"]);
    expect(frequencyToDefaultSlots("BD")).toEqual(["morning", "evening"]);
    expect(frequencyToDefaultSlots("TDS")).toEqual(["morning", "afternoon", "evening"]);
    expect(frequencyToDefaultSlots("QID")).toEqual(["morning", "afternoon", "evening", "bedtime"]);
    expect(frequencyToDefaultSlots("HS")).toEqual(["bedtime"]);
  });

  it("is case-insensitive", () => {
    expect(frequencyToDefaultSlots("bd")).toEqual(["morning", "evening"]);
    expect(frequencyToDefaultSlots("Tds")).toHaveLength(3);
  });

  it("gives as-needed codes no scheduled slots, which is correct", () => {
    // STAT, SOS and PRN are administered on demand, not on a grid.
    expect(frequencyToDefaultSlots("STAT")).toEqual([]);
    expect(frequencyToDefaultSlots("SOS")).toEqual([]);
    expect(frequencyToDefaultSlots("PRN")).toEqual([]);
  });

  /**
   * QUIRK worth knowing: an unrecognised code returns the same empty array as
   * PRN, so a mistyped or simply unsupported frequency produces a drug with no
   * scheduled doses and is indistinguishable from a deliberate as-needed one.
   * Q6H and QDS are real prescribing codes that are not in the map.
   */
  it("QUIRK: an unknown frequency yields no slots, exactly like PRN", () => {
    for (const freq of ["Q6H", "QDS", "BDS", "typo", ""]) {
      expect(frequencyToDefaultSlots(freq)).toEqual([]);
    }
    expect(frequencyToDefaultSlots("Q6H")).toEqual(frequencyToDefaultSlots("PRN"));
  });
});

describe("labels", () => {
  it("food timing has a long and a short form", () => {
    expect(foodTimingLabel("before_food")).toBe("Before food (30 min)");
    expect(foodTimingLabel("before_food", true)).toBe("Before food");
    expect(foodTimingLabel("empty_stomach")).toBe("Empty stomach");
  });

  it("time slots carry a label and a nominal hour", () => {
    expect(timeSlotLabel("morning")).toBe("Morning");
    expect(timeSlotHour("morning")).toBe("8 AM");
    expect(timeSlotHour("bedtime")).toBe("10 PM");
  });

  it("an unrecognised code falls back to the code itself, not to a blank", () => {
    expect(foodTimingLabel("unknown_code" as never)).toBe("unknown_code");
    expect(timeSlotLabel("night" as never)).toBe("night");
    // timeSlotHour is the exception: it blanks rather than echoing the code.
    expect(timeSlotHour("night" as never)).toBe("");
  });
});

describe("timingToHumanReadable", () => {
  const timing = (over: Partial<MedicationTiming>): MedicationTiming => ({ _v: 1, ...over });

  it("joins slots, food timing and custom instruction in that order", () => {
    expect(
      timingToHumanReadable(
        timing({
          time_slots: ["morning", "evening"],
          food_timing: "after_food",
          custom_instruction: "avoid dairy",
        }),
      ),
    ).toBe("Morning & Evening, after food, avoid dairy");
  });

  it("omits food timing when it is 'any', since that says nothing", () => {
    expect(timingToHumanReadable(timing({ time_slots: ["morning"], food_timing: "any" }))).toBe(
      "Morning",
    );
  });

  it("falls back to a readable phrase when nothing is specified", () => {
    expect(timingToHumanReadable(timing({}))).toBe("No specific timing");
    expect(timingToHumanReadable(timing({ time_slots: [] }))).toBe("No specific timing");
  });

  it("renders a custom instruction alone", () => {
    expect(timingToHumanReadable(timing({ custom_instruction: "as directed" }))).toBe(
      "as directed",
    );
  });

  /**
   * `specific_times` is part of MedicationTiming but is not rendered here, so
   * an exact clock time recorded on the prescription does not reach this
   * string.
   */
  it("does not render specific_times", () => {
    expect(timingToHumanReadable(timing({ specific_times: ["06:00", "18:00"] }))).toBe(
      "No specific timing",
    );
  });
});

describe("instructionsDisplayText", () => {
  it("renders structured timing and passes free text through", () => {
    const raw = serializeTiming({ time_slots: ["bedtime"], food_timing: "with_food" });
    expect(instructionsDisplayText(raw)).toBe("Bedtime, with food");
    expect(instructionsDisplayText("Take slowly")).toBe("Take slowly");
  });

  it("returns null when there are no instructions", () => {
    expect(instructionsDisplayText(null)).toBeNull();
    expect(instructionsDisplayText("")).toBeNull();
  });
});
