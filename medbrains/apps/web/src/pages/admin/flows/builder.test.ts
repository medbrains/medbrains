import type { FlowBlock, FlowCheck, FlowDraft, FlowStation } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  checkLines,
  insertBlock,
  moveBy,
  moveTo,
  proposeState,
  removeBlockedReason,
  removeStation,
  setBranch,
} from "./builder";
import { audience, clauseToRows, describeClause, rowsToClause } from "./condition";
import { dropIndex, layoutMetro } from "./metro";

function st(key: string, extra: Partial<FlowStation> = {}): FlowStation {
  return {
    key,
    name: key,
    stage: "S",
    kind: { type: "signal", signal: key },
    lane: null,
    switch_when: null,
    fact_when: null,
    sla_minutes: null,
    locked: false,
    holder: "H",
    required_by: null,
    path: "",
    ...extra,
  };
}

const physio: FlowBlock = {
  kind: "task",
  code: "ipd.physio_clearance",
  name: "Physiotherapy clearance",
  does: "Waits until physiotherapy clears the patient.",
  holder: "Physiotherapy",
  role: "doctor",
  permission: "ipd.discharge.physio_clearance",
  inputs: [],
  stage: "Before billing",
  sla_minutes: 60,
};

const track = [
  st("summary", { locked: true, required_by: "NABH" }),
  st("pharmacy"),
  st("billing"),
  st("finalize", { kind: { type: "action", action: "ipd.discharge.finalize" } }),
];

describe("placing a catalogue block", () => {
  it("lands where the + was pressed and the layout makes room for it", () => {
    const next = insertBlock(track, 2, physio);
    expect(next.map((s) => s.key)).toEqual([
      "summary",
      "pharmacy",
      "physio_clearance",
      "billing",
      "finalize",
    ]);
    expect(next[2]?.kind).toEqual({ type: "task", task: "ipd.physio_clearance" });
    const placed = layoutMetro(next);
    expect(placed.map((p) => p.column)).toEqual([0, 1, 2, 3, 4]);
    // Columns only ever move right, so a new station never sits on another.
    for (let i = 1; i < placed.length; i += 1) {
      expect((placed[i]?.x ?? 0)).toBeGreaterThan((placed[i - 1]?.x ?? 0));
    }
  });

  it("goes on its own lane once it is a branch, and never reuses a key", () => {
    const once = insertBlock(track, 2, physio);
    const branched = setBranch(once, "physio_clearance", "Orthopaedics", { department: "ORTHO" });
    const placed = layoutMetro(branched);
    expect(placed.find((p) => p.key === "physio_clearance")?.lane).toBe(1);
    expect(placed.find((p) => p.key === "billing")?.lane).toBe(0);
    expect(insertBlock(once, 0, physio)[0]?.key).toBe("physio_clearance_2");
    // Clearing the condition puts it back on the main line.
    expect(setBranch(branched, "physio_clearance", "Orthopaedics", null)[2]?.lane).toBeNull();
  });
});

describe("moving and removing", () => {
  it("reorders by drag position or one step at a time", () => {
    expect(moveTo(track, "billing", 0).map((s) => s.key)[0]).toBe("billing");
    expect(moveBy(track, "pharmacy", 1).map((s) => s.key)).toEqual([
      "summary",
      "billing",
      "pharmacy",
      "finalize",
    ]);
    expect(moveBy(track, "summary", -1)).toEqual(track);
    // Dragged past "pharmacy", billing becomes the second station.
    const placed = layoutMetro(track);
    const between = ((placed[0]?.x ?? 0) + (placed[1]?.x ?? 0)) / 2;
    const index = dropIndex(placed, "billing", between);
    expect(moveTo(track, "billing", index).map((s) => s.key)).toEqual([
      "summary",
      "billing",
      "pharmacy",
      "finalize",
    ]);
  });

  it("never removes a locked safety signal and says why", () => {
    expect(removeStation(track, "summary")).toEqual(track);
    expect(removeBlockedReason(track[0] as FlowStation)).toContain("NABH");
    expect(removeStation(track, "pharmacy").map((s) => s.key)).not.toContain("pharmacy");
  });
});

describe("the condition form", () => {
  it("round-trips rows through a clause, with AND and OR", () => {
    const all = rowsToClause(
      [
        { fact: "age_years", op: "gte", value: 18 },
        { fact: "age_years", op: "lt", value: 65 },
        { fact: "department", op: "eq", value: "ORTHO" },
      ],
      "all",
    );
    expect(all).toEqual({ age_years: { gte: 18, lt: 65 }, department: "ORTHO" });
    const any = rowsToClause(
      [
        { fact: "is_mlc", op: "eq", value: true },
        { fact: "department", op: "in", value: ["ORTHO", "NEURO"] },
      ],
      "any",
    );
    expect(any).toEqual({ $any: [{ is_mlc: true }, { department: { in: ["ORTHO", "NEURO"] } }] });
    expect(clauseToRows(any).joiner).toBe("any");
    expect(rowsToClause(clauseToRows(all).rows, "all")).toEqual(all);
    expect(rowsToClause([], "all")).toBeNull();
  });

  it("reads as a sentence", () => {
    const vocab = { departments: [{ code: "ORTHO", name: "Orthopaedics" }] };
    expect(audience({ department: "ORTHO" }, vocab)).toBe(
      "patients whose department is Orthopaedics",
    );
    expect(audience({ is_insurance: true })).toBe("insurance patients");
    expect(describeClause(null)).toBe("always");
  });
});

const check = (rule: FlowCheck["rule"], pass: boolean, stations: string[] = []): FlowCheck => ({
  rule,
  pass,
  sentence: rule,
  problems: pass ? [] : [`${rule} broke`],
  stations,
});

describe("the checks panel", () => {
  it("puts safety first, says pass or fail in words, and names what to highlight", () => {
    const lines = checkLines([
      check("dry_run", false),
      check("staffed", true),
      check("invariants", false, ["finalize"]),
    ]);
    expect(lines.map((l) => l.rule)).toEqual(["invariants", "staffed", "dry_run"]);
    expect(lines[0]).toMatchObject({ verdict: "Fails", stations: ["finalize"] });
    expect(lines[1]?.verdict).toBe("Passes");
  });

  it("enables Propose only for a saved, dry-run draft that passes everything", () => {
    const draft = { revision: 3, dry_run_revision: 3, stale: false } as FlowDraft;
    const passing = [check("invariants", true), check("dry_run", true)];
    expect(proposeState({ draft, checks: passing, unsaved: false }).ok).toBe(true);
    expect(proposeState({ draft, checks: passing, unsaved: true }).ok).toBe(false);
    expect(
      proposeState({ draft: { ...draft, dry_run_revision: 2 }, checks: passing, unsaved: false })
        .reason,
    ).toContain("test drive");
    expect(
      proposeState({ draft: { ...draft, stale: true }, checks: passing, unsaved: false }).ok,
    ).toBe(false);
    expect(
      proposeState({ draft, checks: [check("invariants", false)], unsaved: false }).reason,
    ).toBe("1 check fails.");
    expect(proposeState({ draft: null, checks: passing, unsaved: false }).ok).toBe(false);
  });
});
