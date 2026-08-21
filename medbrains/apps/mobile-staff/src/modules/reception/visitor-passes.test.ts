import type { VisitorPass } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { activePasses, overduePasses } from "./visitor-passes.js";

const NOW = Date.parse("2026-08-21T12:00:00.000Z");

function pass(overrides: Partial<VisitorPass> = {}): VisitorPass {
  return {
    created_at: "2026-08-21T09:00:00.000Z",
    id: "p1",
    pass_number: "VP-001",
    registration_id: "r1",
    status: "active",
    tenant_id: "t1",
    updated_at: "2026-08-21T09:00:00.000Z",
    valid_from: "2026-08-21T09:00:00.000Z",
    valid_until: "2026-08-21T13:00:00.000Z",
    ...overrides,
  } as VisitorPass;
}

describe("which passes are valid right now", () => {
  it("counts one that has not run out", () => {
    expect(activePasses([pass()], NOW)).toHaveLength(1);
  });

  it("does not count one that has run out, even though its status still says active", () => {
    // The status column does not expire on its own; nothing sweeps it. If this
    // stops holding, the desk shows an expired pass as live and the visitor
    // walks in on it.
    expect(activePasses([pass({ valid_until: "2026-08-21T11:00:00.000Z" })], NOW)).toHaveLength(0);
  });

  it("does not count a revoked pass", () => {
    expect(activePasses([pass({ status: "revoked" })], NOW)).toHaveLength(0);
  });
});

describe("which passes are past their end time", () => {
  it("finds the visitor who is probably still inside", () => {
    // Its own state on purpose: the pass ran out and nobody revoked it, which
    // means somebody is in a ward that the desk has stopped counting. Lumping
    // this in with "expired and gone" is how they stay there.
    const overdue = overduePasses([pass({ valid_until: "2026-08-21T11:00:00.000Z" })], NOW);
    expect(overdue).toHaveLength(1);
  });

  it("does not flag one that was properly revoked", () => {
    // Revoking is the desk having dealt with it. Flagging it again would send
    // somebody to look for a visitor who was already seen out.
    const revoked = pass({ status: "revoked", valid_until: "2026-08-21T11:00:00.000Z" });
    expect(overduePasses([revoked], NOW)).toHaveLength(0);
  });

  it("does not flag one that is still within its hours", () => {
    expect(overduePasses([pass()], NOW)).toHaveLength(0);
  });

  it("splits a mixed list with nothing counted twice", () => {
    const live = pass({ id: "live" });
    const late = pass({ id: "late", valid_until: "2026-08-21T10:00:00.000Z" });
    const gone = pass({ id: "gone", status: "revoked" });
    expect(activePasses([live, late, gone], NOW).map((p) => p.id)).toEqual(["live"]);
    expect(overduePasses([live, late, gone], NOW).map((p) => p.id)).toEqual(["late"]);
  });
});
