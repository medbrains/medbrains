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
});
