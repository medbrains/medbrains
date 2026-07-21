// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  integerFromFormValue,
  numberFromFormValue,
  optionalIntegerFromFormValue,
  optionalNumberFromFormValue,
  optionalTextFromFormValue,
} from "./form-primitives";

describe("optionalTextFromFormValue", () => {
  it("keeps trimmed non-empty text", () => {
    expect(optionalTextFromFormValue("hello")).toBe("hello");
    expect(optionalTextFromFormValue("  spaced  ")).toBe("spaced");
  });
  it("maps blank/whitespace to undefined", () => {
    expect(optionalTextFromFormValue("")).toBeUndefined();
    expect(optionalTextFromFormValue("   ")).toBeUndefined();
  });
});

describe("numberFromFormValue", () => {
  it("passes through real numbers — including zero and negatives", () => {
    // Zero must survive: a 0 amount is a valid billing value, not "missing".
    expect(numberFromFormValue(0, 99)).toBe(0);
    expect(numberFromFormValue(-12.5, 99)).toBe(-12.5);
    expect(numberFromFormValue(42, 99)).toBe(42);
  });
  it("parses numeric strings", () => {
    expect(numberFromFormValue("12.5", 0)).toBe(12.5);
    expect(numberFromFormValue("0", 99)).toBe(0);
  });
  it("falls back on non-numeric input", () => {
    expect(numberFromFormValue("abc", 7)).toBe(7);
    expect(numberFromFormValue("12abc", 7)).toBe(7);
  });
  it('EDGE: an empty/whitespace string coerces to 0 (Number("")===0), not the fallback', () => {
    // Documented quirk — the fallback only kicks in for non-numeric input, so a
    // cleared numeric field becomes 0, not the default. Callers relying on the
    // fallback for empty fields should use optionalNumberFromFormValue instead.
    expect(numberFromFormValue("", 7)).toBe(0);
    expect(numberFromFormValue("   ", 7)).toBe(0);
  });
});

describe("integerFromFormValue", () => {
  it("passes through integers and parses integer strings", () => {
    expect(integerFromFormValue(0, 9)).toBe(0);
    expect(integerFromFormValue("12", 9)).toBe(12);
  });
  it("falls back on non-integers and non-numeric input", () => {
    expect(integerFromFormValue("12.5", 9)).toBe(9);
    expect(integerFromFormValue(3.14, 9)).toBe(9);
    expect(integerFromFormValue("abc", 9)).toBe(9);
  });
});

describe("optionalNumberFromFormValue", () => {
  it("preserves zero — must NOT become undefined", () => {
    // Regression guard: dropping a "0" here would silently discard a zero
    // amount/discount on a form submit.
    expect(optionalNumberFromFormValue("0")).toBe(0);
    expect(optionalNumberFromFormValue(0)).toBe(0);
  });
  it("parses numeric strings and numbers", () => {
    expect(optionalNumberFromFormValue("12.5")).toBe(12.5);
    expect(optionalNumberFromFormValue(-3)).toBe(-3);
  });
  it("maps blank/whitespace/non-numeric to undefined", () => {
    expect(optionalNumberFromFormValue("")).toBeUndefined();
    expect(optionalNumberFromFormValue("   ")).toBeUndefined();
    expect(optionalNumberFromFormValue("abc")).toBeUndefined();
  });
});

describe("optionalIntegerFromFormValue", () => {
  it("preserves zero and parses integer strings", () => {
    expect(optionalIntegerFromFormValue("0")).toBe(0);
    expect(optionalIntegerFromFormValue("12")).toBe(12);
  });
  it("maps non-integers, blank and non-numeric to undefined", () => {
    expect(optionalIntegerFromFormValue("12.5")).toBeUndefined();
    expect(optionalIntegerFromFormValue("")).toBeUndefined();
    expect(optionalIntegerFromFormValue("abc")).toBeUndefined();
  });
});
