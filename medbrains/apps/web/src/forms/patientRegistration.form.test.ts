import type { Camp } from "@medbrains/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  campReferenceLabel,
  campVenueLabel,
  estimateDobFromAge,
  optionLabel,
  trimOrUndefined,
} from "./patientRegistration.form";

const NOW = new Date(2026, 6, 22, 12, 0, 0); // 22 July 2026, local

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Patients frequently register with a stated age and no known date of birth,
 * so this fabricates one. The stored value then behaves like a real DOB
 * everywhere downstream, which makes "is the estimate consistent with the age
 * the patient gave" the property that matters.
 */
describe("estimateDobFromAge", () => {
  it("returns 1 January of the birth year", () => {
    const dob = estimateDobFromAge(30);
    expect(dob.getFullYear()).toBe(1996);
    expect(dob.getMonth()).toBe(0);
    expect(dob.getDate()).toBe(1);
  });

  /**
   * The invariant, not just the shape: reading the estimate back with the
   * completed-years rule the registration form uses must return the age that
   * was typed. 1 January works because it is always inside the window a
   * stated age allows, whatever the time of year.
   */
  it("round-trips — reading the estimate back gives the stated age", () => {
    const completedYears = (dob: Date, on: Date) => {
      let years = on.getFullYear() - dob.getFullYear();
      const birthdayThisYear = new Date(on.getFullYear(), dob.getMonth(), dob.getDate());
      if (birthdayThisYear > on) years -= 1;
      return years;
    };

    for (const age of [0, 1, 5, 18, 30, 65, 99]) {
      expect(completedYears(estimateDobFromAge(age), NOW)).toBe(age);
    }
  });

  it("handles a newborn as the current year", () => {
    expect(estimateDobFromAge(0).getFullYear()).toBe(2026);
  });

  /**
   * Worth knowing rather than fixing: the estimate is a fabricated precise
   * date. An infant registered as "0 years" on 22 July gets 1 January, so
   * anything reading the stored DOB will treat them as roughly six months
   * old. For age-in-years that is right by construction; for infants, where
   * dosing follows months, the stated age was never that precise to begin
   * with.
   */
  it("is only as precise as the age it was given", () => {
    const dob = estimateDobFromAge(0);
    const monthsApparent =
      (NOW.getFullYear() - dob.getFullYear()) * 12 + NOW.getMonth() - dob.getMonth();
    expect(monthsApparent).toBe(6);
  });
});

describe("trimOrUndefined", () => {
  it("keeps trimmed text and drops anything blank", () => {
    expect(trimOrUndefined("  Ravi  ")).toBe("Ravi");
    expect(trimOrUndefined("")).toBeUndefined();
    expect(trimOrUndefined("   ")).toBeUndefined();
    expect(trimOrUndefined(undefined)).toBeUndefined();
  });

  it("keeps a string that is only meaningful after trimming", () => {
    expect(trimOrUndefined(" 0 ")).toBe("0");
  });
});

describe("optionLabel", () => {
  const options = [
    { value: "mr", label: "Mr." },
    { value: "smt", label: "Smt." },
  ];

  it("resolves a known value and returns undefined otherwise", () => {
    expect(optionLabel(options, "smt")).toBe("Smt.");
    expect(optionLabel(options, "unknown")).toBeUndefined();
    expect(optionLabel(options, undefined)).toBeUndefined();
    expect(optionLabel([], "mr")).toBeUndefined();
  });

  it("matches exactly, not case-insensitively", () => {
    expect(optionLabel(options, "MR")).toBeUndefined();
  });
});

describe("camp labels", () => {
  const camp = (over: Partial<Camp>): Camp =>
    ({
      camp_code: "CMP-1",
      name: "Eye Camp",
      scheduled_date: "2026-08-01T00:00:00Z",
      ...over,
    }) as Camp;

  it("joins the venue parts that are present", () => {
    expect(
      campVenueLabel(camp({ venue_name: "Town Hall", venue_city: "Salem", venue_state: "TN" })),
    ).toBe("Town Hall, Salem, TN");
  });

  it("skips missing venue parts rather than leaving empty separators", () => {
    expect(campVenueLabel(camp({ venue_name: "Town Hall", venue_city: undefined }))).toBe(
      "Town Hall",
    );
  });

  it("returns undefined when no venue detail is known at all", () => {
    expect(campVenueLabel(camp({}))).toBeUndefined();
  });

  it("builds a reference from code, name, date and venue", () => {
    expect(campReferenceLabel(camp({ venue_name: "Town Hall" }))).toBe(
      "CMP-1 · Eye Camp · 2026-08-01 · Town Hall",
    );
  });

  it("truncates the date to its day, dropping the time component", () => {
    expect(campReferenceLabel(camp({}))).toBe("CMP-1 · Eye Camp · 2026-08-01");
  });
});
