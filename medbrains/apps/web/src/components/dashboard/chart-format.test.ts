import { describe, expect, it } from "vitest";
import { count, rupees, rupeesAxis, shortDate } from "./chart-format";

describe("chart labels read the Indian way", () => {
  it("abbreviates money on the axis and spells it out in the tooltip", () => {
    expect(rupeesAxis(250_000)).toBe("₹2.5L");
    expect(rupeesAxis(1_000_000)).toBe("₹10L");
    expect(rupeesAxis(46_476_791.72)).toBe("₹4.6Cr");
    expect(rupeesAxis(850)).toBe("₹850");
    expect(rupees(998_718.2)).toBe("₹9,98,718.20");
    expect(count(1_234_567)).toBe("12,34,567");
  });

  it("labels dates as day and month, months as month and year", () => {
    expect(shortDate("2026-09-26")).toBe("26 Sep");
    expect(shortDate("2026-10")).toBe("Oct 2026");
    expect(shortDate("Cardiology")).toBe("Cardiology");
  });
});
