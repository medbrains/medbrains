import { describe, expect, it } from "vitest";
import {
  MOBILE_CAMP_REGISTRATION_TEXT,
  MOBILE_NAVIGATION_TEXT,
  mobilePatientJourneyText,
} from "../components/patientJourneyText";

/**
 * Every key the camp registration screen names must resolve to real copy.
 *
 * `mobilePatientJourneyText` returns the key itself when it has no entry, so
 * a missing message is not an error — it is a screen that reads
 * "patientJourney.mobile.campRegistration.actions.register" to a volunteer
 * standing in front of a patient. Silent, and invisible in a typecheck.
 */

function keysOf(node: unknown, path: string[] = []): string[] {
  if (typeof node === "string") return [node];
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([k, v]) => keysOf(v, [...path, k]));
  }
  return [];
}

describe("camp registration copy", () => {
  const keys = [
    ...keysOf(MOBILE_CAMP_REGISTRATION_TEXT),
    MOBILE_NAVIGATION_TEXT.staff.campRegistration,
  ];

  it("names a non-trivial number of strings", () => {
    expect(keys.length).toBeGreaterThan(15);
  });

  it.each(keys)("resolves %s", (key) => {
    expect(
      mobilePatientJourneyText(key),
      "unresolved keys render to the volunteer verbatim",
    ).not.toBe(key);
  });

  it("fills the placeholders it promises", () => {
    expect(
      mobilePatientJourneyText(MOBILE_CAMP_REGISTRATION_TEXT.states.registered, {
        name: "Kannan",
      }),
    ).toContain("Kannan");
    expect(
      mobilePatientJourneyText(MOBILE_CAMP_REGISTRATION_TEXT.states.pending, { count: 3 }),
    ).toContain("3");
  });
});
