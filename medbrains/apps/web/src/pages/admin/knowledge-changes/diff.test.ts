import type { KnowledgeChangeItem, KnowledgeImpactReport } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { diffItem, groupImpact, impactChips } from "./diff";

const rule = {
  drug_a_name: "Warfarin",
  drug_b_name: "Aspirin",
  severity: "major",
  description: "Bleeding risk",
  mechanism: null,
  management: null,
  is_active: true,
};

function item(partial: Partial<KnowledgeChangeItem>): KnowledgeChangeItem {
  return {
    id: "i1",
    target_kind: "drug_interactions",
    target_key: "r1",
    op: "update",
    before: rule,
    after: rule,
    seq: 1,
    ...partial,
  };
}

describe("the diff marks exactly the cells that change", () => {
  it("marks a severity downgrade and nothing else", () => {
    const rows = diffItem("drug_interactions", item({ after: { ...rule, severity: "minor" } }));
    const changed = rows.filter((r) => r.changed);
    expect(changed).toEqual([
      { key: "severity", label: "Severity", before: "major", after: "minor", changed: true },
    ]);
  });

  it("shows a removal as the rule switched off", () => {
    const rows = diffItem("drug_interactions", item({ op: "delete", after: null }));
    expect(rows.filter((r) => r.changed).map((r) => [r.key, r.before, r.after])).toEqual([
      ["is_active", "Yes", "No"],
    ]);
  });

  it("shows an addition with nothing before", () => {
    const rows = diffItem("drug_interactions", item({ op: "create", before: null }));
    expect(rows.find((r) => r.key === "drug_a_name")).toMatchObject({
      before: "—",
      after: "Warfarin",
      changed: true,
    });
  });
});

const report: KnowledgeImpactReport = {
  computed_at: "2026-10-31T10:00:00Z",
  entries: [
    { severity: "info", relation: "x", summary: "s", count: 2, examples: [], truncated: false },
    { severity: "safety", relation: "a", summary: "s", count: 14, examples: [], truncated: false },
    { severity: "safety", relation: "b", summary: "s", count: 3, examples: [], truncated: true },
  ],
};

describe("impact is grouped safety first and never hides a floor", () => {
  it("orders groups by severity and drops empty ones", () => {
    expect(groupImpact(report).map((g) => [g.severity, g.entries.length])).toEqual([
      ["safety", 2],
      ["info", 1],
    ]);
  });

  it("totals each severity and marks a truncated count", () => {
    expect(impactChips(report)).toEqual([
      { severity: "safety", text: "17+" },
      { severity: "info", text: "2" },
    ]);
  });

  it("has no chips before a preview, rather than claiming no impact", () => {
    expect(impactChips(null)).toEqual([]);
  });
});
