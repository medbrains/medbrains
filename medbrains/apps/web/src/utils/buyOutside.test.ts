import { describe, expect, it } from "vitest";
import { isBoughtOutside, isSoldHere } from "./buyOutside";

const line = (catalog: string | null, buyOutside: boolean, dispensed = 0) => ({
  catalog_item_id: catalog,
  buy_outside: buyOutside,
  quantity_dispensed: dispensed,
});

describe("buy outside lines", () => {
  it("sells only a catalogue line not marked buy outside", () => {
    expect(isSoldHere(line("c1", false))).toBe(true);
    expect(isSoldHere(line(null, true))).toBe(false);
    expect(isSoldHere(line(null, false))).toBe(false);
  });

  it("badges the marker, or an old typed line never handed out", () => {
    expect(isBoughtOutside(line(null, true))).toBe(true);
    expect(isBoughtOutside(line(null, false, 0))).toBe(true);
    // A typed line dispensed before the rule is history, not bought outside.
    expect(isBoughtOutside(line(null, false, 2))).toBe(false);
    expect(isBoughtOutside(line("c1", false))).toBe(false);
  });
});
