import { describe, expect, it } from "vitest";
import { byClinicTime, isStillToCome, nextPatient, remainingCount } from "./clinic-day.js";

const at = (id: string, start_time: string | null, status = "scheduled") => ({
  id,
  start_time,
  status,
});

describe("byClinicTime", () => {
  it("orders by clock time", () => {
    const ordered = byClinicTime([at("c", "14:00"), at("a", "09:00"), at("b", "11:30")]);
    expect(ordered.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("puts an appointment with no time last, not first", () => {
    // A missing time is usually a walk-in slotted in. Sorting it first would
    // tell the doctor their next patient is one nobody scheduled.
    const ordered = byClinicTime([at("walkin", null), at("nine", "09:00")]);
    expect(ordered.map((x) => x.id)).toEqual(["nine", "walkin"]);
  });

  it("does not mutate the caller's array", () => {
    const input = [at("late", "16:00"), at("early", "08:00")];
    byClinicTime(input);
    expect(input.map((x) => x.id)).toEqual(["late", "early"]);
  });
});

describe("isStillToCome", () => {
  it("excludes cancelled, no-show and completed", () => {
    expect(isStillToCome(at("a", "09:00", "cancelled"))).toBe(false);
    expect(isStillToCome(at("a", "09:00", "no_show"))).toBe(false);
    expect(isStillToCome(at("a", "09:00", "completed"))).toBe(false);
  });

  it("includes anything else", () => {
    expect(isStillToCome(at("a", "09:00", "scheduled"))).toBe(true);
    expect(isStillToCome(at("a", "09:00", "checked_in"))).toBe(true);
  });
});

describe("nextPatient", () => {
  it("skips past a completed earlier slot", () => {
    const next = nextPatient([
      at("done", "09:00", "completed"),
      at("now", "09:30"),
      at("later", "10:00"),
    ]);
    expect(next?.id).toBe("now");
  });

  it("skips a cancellation rather than calling it next", () => {
    const next = nextPatient([at("gone", "09:00", "cancelled"), at("real", "09:15")]);
    expect(next?.id).toBe("real");
  });

  it("is null when the clinic is finished", () => {
    // So the screen can say the clinic is done rather than point at someone
    // who has already left.
    expect(nextPatient([at("a", "09:00", "completed")])).toBeNull();
  });
});

describe("remainingCount", () => {
  it("counts only what is still to be seen", () => {
    expect(
      remainingCount([
        at("a", "09:00", "completed"),
        at("b", "09:30"),
        at("c", "10:00", "cancelled"),
        at("d", "10:30"),
      ]),
    ).toBe(2);
  });
});
