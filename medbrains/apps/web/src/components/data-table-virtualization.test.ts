// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  resolveDataTableVirtualWindow,
  resolveMeasuredRowHeight,
} from "./data-table-virtualization";

const rows = Array.from({ length: 120 }, (_, index) => `row-${index + 1}`);

describe("resolveDataTableVirtualWindow", () => {
  it("returns all rows when virtualization is disabled", () => {
    const window = resolveDataTableVirtualWindow({
      data: rows,
      enabled: false,
      overscan: 2,
      rowHeight: 40,
      scrollTop: 0,
      viewportHeight: 200,
    });

    expect(window.rows).toHaveLength(120);
    expect(window.startIndex).toBe(0);
    expect(window.endIndex).toBe(120);
    expect(window.renderedCount).toBe(120);
    expect(window.totalHeight).toBe(120 * 40);
    expect(window.topSpacerHeight).toBe(0);
    expect(window.bottomSpacerHeight).toBe(0);
  });

  it("returns only the visible window plus overscan for large lists", () => {
    const window = resolveDataTableVirtualWindow({
      data: rows,
      enabled: true,
      overscan: 2,
      rowHeight: 40,
      scrollTop: 0,
      viewportHeight: 200,
    });

    expect(window.rows).toEqual(rows.slice(0, 9));
    expect(window.startIndex).toBe(0);
    expect(window.endIndex).toBe(9);
    expect(window.renderedCount).toBe(9);
    expect(window.totalHeight).toBe(120 * 40);
    expect(window.topSpacerHeight).toBe(0);
    expect(window.bottomSpacerHeight).toBe(111 * 40);
  });

  it("keeps the window inside the data bounds near the end", () => {
    const window = resolveDataTableVirtualWindow({
      data: rows,
      enabled: true,
      overscan: 2,
      rowHeight: 40,
      scrollTop: 4_800,
      viewportHeight: 200,
    });

    expect(window.rows).toEqual(rows.slice(111));
    expect(window.startIndex).toBe(111);
    expect(window.endIndex).toBe(120);
    expect(window.renderedCount).toBe(9);
    expect(window.topSpacerHeight).toBe(111 * 40);
    expect(window.bottomSpacerHeight).toBe(0);
  });

  it("clamps invalid row height and overscan values", () => {
    const window = resolveDataTableVirtualWindow({
      data: rows,
      enabled: true,
      overscan: -2,
      rowHeight: 0,
      scrollTop: 5,
      viewportHeight: 5,
    });

    expect(window.rows).toEqual(rows.slice(5, 10));
    expect(window.startIndex).toBe(5);
    expect(window.endIndex).toBe(10);
    expect(window.totalHeight).toBe(120);
    expect(window.topSpacerHeight).toBe(5);
    expect(window.bottomSpacerHeight).toBe(110);
  });

  it("uses a fallback viewport before the table has measured", () => {
    const window = resolveDataTableVirtualWindow({
      data: rows,
      enabled: true,
      overscan: 1,
      rowHeight: 50,
      scrollTop: 0,
      viewportHeight: 0,
    });

    expect(window.rows).toEqual(rows.slice(0, 12));
    expect(window.renderedCount).toBe(12);
    expect(window.totalHeight).toBe(120 * 50);
  });
});

describe("resolveMeasuredRowHeight", () => {
  // The quality incident rows wrap to 83px against a 40px estimate. Windowed on
  // 40px, scrolling incident 20 into view scrolled it out of the window.
  it("widens to the rows actually on screen when they wrap", () => {
    expect(resolveMeasuredRowHeight(40, [83, 83, 83])).toBe(83);
    const window = resolveDataTableVirtualWindow({
      data: rows,
      enabled: true,
      overscan: 2,
      rowHeight: resolveMeasuredRowHeight(40, [83, 83, 83]),
      scrollTop: 20 * 83,
      viewportHeight: 440,
    });
    expect(window.rows).toContain("row-21");
  });

  it("never shrinks, so measuring a different window cannot oscillate", () => {
    expect(resolveMeasuredRowHeight(83, [40, 40])).toBe(83);
  });

  it("ignores rows not laid out yet", () => {
    expect(resolveMeasuredRowHeight(40, [0, 0])).toBe(40);
  });
});
