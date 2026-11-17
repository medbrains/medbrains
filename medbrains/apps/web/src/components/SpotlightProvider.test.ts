import { describe, expect, it } from "vitest";
import { type SpotlightEntry, visibleEntries } from "./SpotlightProvider";

const entry = (id: string, extra: Partial<SpotlightEntry> = {}): SpotlightEntry => ({
  id,
  label: id,
  description: "",
  path: `/${id}`,
  icon: null,
  group: "Navigation",
  ...extra,
});

const holds = (codes: string[]) => (code: string) => codes.includes(code);

describe("visibleEntries", () => {
  const entries = [
    entry("new-opd-visit", { requiredPermission: "opd.visit.create", moduleCode: "opd" }),
    entry("patients", { requiredPermission: "patients.list", moduleCode: "registration" }),
    entry("ask-ai"),
  ];

  it("leaves out an app's entries while the hospital has that app off", () => {
    const ids = visibleEntries(
      entries,
      holds(["opd.visit.create", "patients.list"]),
      new Set(["opd"]),
    ).map((e) => e.id);
    expect(ids).toEqual(["patients", "ask-ai"]);
  });

  it("still leaves out what the person may not open when every app is on", () => {
    const ids = visibleEntries(entries, holds(["patients.list"]), new Set()).map((e) => e.id);
    expect(ids).toEqual(["patients", "ask-ai"]);
  });

  it("accepts any one of an any-of list", () => {
    const anyOf = [
      entry("stock", { requiredPermissions: ["indent.stock.manage", "pharmacy.stock.manage"] }),
    ];
    expect(visibleEntries(anyOf, holds(["pharmacy.stock.manage"]), new Set())).toHaveLength(1);
    expect(visibleEntries(anyOf, holds([]), new Set())).toHaveLength(0);
  });
});
