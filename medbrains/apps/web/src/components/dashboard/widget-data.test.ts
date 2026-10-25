import { describe, expect, it } from "vitest";
import { cellText } from "./widget-data";

describe("cellText", () => {
  it("shows a stored code in words, never the raw enum", () => {
    expect(cellText("in_consultation")).toBe("In consultation");
    expect(cellText("self_pay")).toBe("Self pay");
    expect(cellText("waiting")).toBe("Waiting");
  });

  it("leaves names and identifiers as they are", () => {
    expect(cellText("Dr. Arjun Menon")).toBe("Dr. Arjun Menon");
    expect(cellText("SW-09")).toBe("SW-09");
    expect(cellText(null)).toBe("—");
  });
});
