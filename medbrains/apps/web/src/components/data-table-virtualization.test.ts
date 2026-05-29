// @vitest-environment node

import { describe, expect, it } from "vitest";
import { resolveDataTableVirtualWindow } from "./data-table-virtualization";

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
    expect(window.topSpacerHeight).toBe(5);
    expect(window.bottomSpacerHeight).toBe(110);
  });
});
