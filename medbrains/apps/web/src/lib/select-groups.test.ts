import { describe, expect, it } from "vitest";
import { type GroupedSelectData, groupedSelectData } from "./select-groups";

/**
 * Mantine v7's own parser, copied from
 * `@mantine/core/.../get-parsed-combobox-data`. The point of these tests is
 * that our data survives it: passing a v6-shaped `{ value, label, group }`
 * takes the `"group" in item` branch and throws on `item.items.map`, which is
 * the crash a pharmacist saw when they opened the store-indents tab.
 */
function parseLikeMantine(data: unknown[]): unknown[] {
  const parseItem = (item: unknown): unknown => {
    if (typeof item === "string") return { value: item, label: item };
    if (typeof item === "object" && item !== null && "value" in item && !("label" in item)) {
      return item;
    }
    if (typeof item === "object" && item !== null && "group" in item) {
      const group = item as { group: string; items: unknown[] };
      return { group: group.group, items: group.items.map(parseItem) };
    }
    return item;
  };
  return data.map(parseItem);
}

describe("groupedSelectData", () => {
  it("produces data Mantine can parse without throwing", () => {
    const data = groupedSelectData([
      { value: "1", label: "Main store", group: "CENTRAL" },
      { value: "2", label: "Ward store", group: "WARD" },
    ]);
    expect(() => parseLikeMantine(data)).not.toThrow();
  });

  it("is the fix: the flat shape it replaces does throw", () => {
    // Guards the test itself. If Mantine ever accepts the flat shape, this
    // fails and the helper can go.
    expect(() => parseLikeMantine([{ value: "1", label: "Main store", group: "CENTRAL" }])).toThrow(
      /map/,
    );
  });

  it("collects every option under one heading", () => {
    const data = groupedSelectData([
      { value: "1", label: "A", group: "WARD" },
      { value: "2", label: "B", group: "CENTRAL" },
      { value: "3", label: "C", group: "WARD" },
    ]) as Array<{ group: string; items: Array<{ value: string }> }>;
    expect(data).toHaveLength(2);
    expect(data[0]?.group).toBe("WARD");
    expect(data[0]?.items.map((i) => i.value)).toEqual(["1", "3"]);
    expect(data[1]?.items.map((i) => i.value)).toEqual(["2"]);
  });

  it("keeps the caller's order rather than sorting", () => {
    // A store list may already be ordered by proximity; re-sorting it here
    // would quietly override that.
    const data = groupedSelectData([
      { value: "1", label: "A", group: "ZED" },
      { value: "2", label: "B", group: "ALPHA" },
    ]) as Array<{ group: string }>;
    expect(data.map((d) => d.group)).toEqual(["ZED", "ALPHA"]);
  });

  it("leaves an option with no group flat", () => {
    const data = groupedSelectData([
      { value: "1", label: "Ungrouped" },
      { value: "2", label: "Blank", group: "   " },
      { value: "3", label: "Null", group: null },
    ]);
    expect(data).toEqual([
      { value: "1", label: "Ungrouped" },
      { value: "2", label: "Blank" },
      { value: "3", label: "Null" },
    ]);
    expect(() => parseLikeMantine(data)).not.toThrow();
  });

  it("carries disabled through, and omits it when unset", () => {
    const data = groupedSelectData([
      { value: "1", label: "Closed", group: "WARD", disabled: true },
      { value: "2", label: "Open", group: "WARD" },
    ]) as Array<{ items: Array<Record<string, unknown>> }>;
    expect(data[0]?.items[0]).toEqual({ value: "1", label: "Closed", disabled: true });
    expect(data[0]?.items[1]).toEqual({ value: "2", label: "Open" });
  });

  it("returns nothing for nothing", () => {
    const data: GroupedSelectData = groupedSelectData([]);
    expect(data).toEqual([]);
  });
});
