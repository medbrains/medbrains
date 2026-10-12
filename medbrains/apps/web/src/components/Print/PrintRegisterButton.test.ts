import { describe, expect, it } from "vitest";
import { periodValue } from "./PrintRegisterButton";

// The server parses these strings itself (`period_bounds`, the NDPS month, the
// visitor register's day) and answers 400 to anything else, so each granularity
// must send exactly its own shape.
describe("periodValue", () => {
  const picked = "2026-08-17";

  it("sends the day, month, year or quarter the register is kept by", () => {
    expect(periodValue("date", picked, "")).toBe("2026-08-17");
    expect(periodValue("month", picked, "")).toBe("2026-08");
    expect(periodValue("year", picked, "")).toBe("2026");
    expect(periodValue("quarter", picked, "Q3")).toBe("2026-Q3");
  });
});
