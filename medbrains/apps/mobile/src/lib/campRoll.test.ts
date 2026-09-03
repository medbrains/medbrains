import { describe, expect, it } from "vitest";
import { digitsOf, duplicateOnRoll, indexRegisteredPhones, subscriberNumber } from "./campRoll";

describe("spotting someone already on the camp roll", () => {
  const roll = [
    { person_name: "Kannan", phone: "9500053434" },
    { person_name: "Meena", phone: "+91 98404 12345" },
    { person_name: "No phone", phone: null },
  ];

  it("matches however the volunteer typed the number", () => {
    const index = indexRegisteredPhones(roll);
    // Same person, four keyboards.
    for (const typed of ["9840412345", "+919840412345", "98404-12345", "98404 12345"]) {
      expect(duplicateOnRoll(index, typed), typed).toBe("Meena");
    }
  });

  it("does not warn on a half-typed number", () => {
    // Warning at four digits would fire on almost everyone, and a warning
    // that is usually wrong is a warning volunteers learn to tap past.
    const index = indexRegisteredPhones(roll);
    expect(duplicateOnRoll(index, "9500")).toBeUndefined();
  });

  it("ignores entries with no phone at all", () => {
    expect(indexRegisteredPhones([{ person_name: "No phone", phone: null }]).size).toBe(0);
  });

  it("names whoever was registered first when a handset is shared", () => {
    // A family on one phone is normal. The warning should name the record the
    // volunteer would actually be duplicating.
    const index = indexRegisteredPhones([
      { person_name: "Father", phone: "9500053434" },
      { person_name: "Son", phone: "9500053434" },
    ]);
    expect(duplicateOnRoll(index, "9500053434")).toBe("Father");
  });

  it("reduces any Indian form to the subscriber number", () => {
    // Bare, 0-prefixed and +91 are the same person, and a volunteer will use
    // all three across one afternoon.
    expect(subscriberNumber("9840412345")).toBe("9840412345");
    expect(subscriberNumber("09840412345")).toBe("9840412345");
    expect(subscriberNumber("+91 (98404) 12345")).toBe("9840412345");
    expect(digitsOf("+91 98404 12345")).toBe("919840412345");
  });
});
