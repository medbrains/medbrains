import { describe, expect, it } from "vitest";
import { isPrnFrequency } from "./prn";

describe("isPrnFrequency", () => {
  it("recognises as-needed orders the server will ask a reason for", () => {
    expect(isPrnFrequency("PRN")).toBe(true);
    expect(isPrnFrequency("sos")).toBe(true);
    expect(isPrnFrequency("PRN q6h")).toBe(true);
    expect(isPrnFrequency("As needed for pain")).toBe(true);
  });

  it("leaves scheduled orders alone", () => {
    expect(isPrnFrequency("BD")).toBe(false);
    expect(isPrnFrequency("once")).toBe(false);
    expect(isPrnFrequency(null)).toBe(false);
  });
});
