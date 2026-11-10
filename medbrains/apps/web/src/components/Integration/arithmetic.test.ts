import { describe, expect, it } from "vitest";
import { evaluateArithmetic } from "./arithmetic";

describe("transform arithmetic", () => {
  it("follows precedence and parentheses", () => {
    expect(evaluateArithmetic("2 + 3 * 4")).toBe(14);
    expect(evaluateArithmetic("(2 + 3) * 4")).toBe(20);
    expect(evaluateArithmetic("10 - 4 - 3")).toBe(3);
    expect(evaluateArithmetic("1.5 * -2")).toBe(-3);
  });

  it("refuses anything that is not plain arithmetic, so the caller keeps the text", () => {
    expect(evaluateArithmetic("alert(1)")).toBeNull();
    expect(evaluateArithmetic("2 +")).toBeNull();
    expect(evaluateArithmetic("(2 + 3")).toBeNull();
    expect(evaluateArithmetic("2 3")).toBeNull();
    expect(evaluateArithmetic("NaN + 1")).toBeNull();
  });

  it("matches the old evaluator on edge forms", () => {
    expect(evaluateArithmetic(".5 + 5.")).toBe(5.5);
    expect(evaluateArithmetic("2 * +3")).toBe(6);
    expect(evaluateArithmetic("1 / 0")).toBe(Number.POSITIVE_INFINITY);
    expect(evaluateArithmetic("1.2.3")).toBeNull();
  });

  it("keeps long or deeply nested input as text instead of overflowing the stack", () => {
    expect(evaluateArithmetic(`${"(".repeat(5000)}1${")".repeat(5000)}`)).toBeNull();
    expect(evaluateArithmetic(`${"-".repeat(5000)}1`)).toBeNull();
  });
});
