import { describe, expect, it } from "vitest";
import { asOfNote, cellText } from "./widget-data";

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

describe("asOfNote", () => {
  it("says nothing on a live dashboard", () => {
    expect(asOfNote({ value: 3 }, null)).toBeUndefined();
  });

  it("names the day a tile was read for, and owns up to a live one", () => {
    expect(asOfNote({ value: 84, as_of: "2026-01-15" }, "2026-01-15")).toMatch(/^On .*2026$/);
    expect(asOfNote({ value: 113 }, "2026-01-15")).toBe("Live — not dated");
  });
});
