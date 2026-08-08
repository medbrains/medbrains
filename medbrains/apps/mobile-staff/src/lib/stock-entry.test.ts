import { describe, expect, it } from "vitest";
import { checkQuantity } from "./stock-entry.js";

describe("checkQuantity", () => {
  it("accepts a whole number", () => {
    expect(checkQuantity("12")).toEqual({ quantity: 12, error: null });
  });

  it("says nothing about an empty field", () => {
    // Somebody who has not typed yet has not made a mistake.
    expect(checkQuantity("  ")).toEqual({ quantity: null, error: null });
  });

  it("refuses zero and negatives", () => {
    expect(checkQuantity("0").quantity).toBeNull();
    expect(checkQuantity("-3").quantity).toBeNull();
  });

  it("refuses a decimal rather than truncating it", () => {
    // parseInt("1.5") is 1. Silently recording one unit when someone typed 1.5
    // puts the shelf and the system out of step with no trace.
    expect(checkQuantity("1.5")).toEqual({
      quantity: null,
      error: "Enter a whole number of units, more than zero.",
    });
  });

  it("refuses text that parseInt would happily half-read", () => {
    // parseInt("12abc") is 12 — a scanner misfire would become a real movement.
    expect(checkQuantity("12abc").quantity).toBeNull();
  });

  it("refuses a number too large to be an exact integer", () => {
    expect(checkQuantity("9007199254740993").quantity).toBeNull();
  });
});
