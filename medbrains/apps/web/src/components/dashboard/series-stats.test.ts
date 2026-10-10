import { describe, expect, it } from "vitest";
import { columnValues, seriesStats } from "./series-stats";

describe("seriesStats", () => {
  it("reads the line's latest move and range over known points", () => {
    const s = seriesStats([10, 12, null, 9, 15]);
    expect(s.latest).toBe(15);
    expect(s.previous).toBe(9);
    expect(s.change).toBe(6);
    expect(s.changePct).toBeCloseTo(66.67, 1);
    expect([s.min, s.max, s.total, s.count]).toEqual([9, 15, 46, 4]);
    expect(s.average).toBeCloseTo(11.5);
  });

  it("treats an unknown day as a gap, never a zero", () => {
    const s = seriesStats([null, 4, undefined]);
    expect([s.latest, s.previous, s.change, s.min, s.average]).toEqual([4, null, null, 4, 4]);
  });

  it("has no percentage change from zero", () => {
    expect(seriesStats([0, 5]).changePct).toBeNull();
    expect(seriesStats([]).average).toBeNull();
  });

  it("takes a chart column as numbers", () => {
    expect(columnValues([{ v: 3 }, { v: "4" }, { v: null }, { v: "x" }], "v")).toEqual([
      3,
      4,
      null,
      null,
    ]);
  });
});
