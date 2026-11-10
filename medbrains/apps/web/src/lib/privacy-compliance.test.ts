import type { CompliancePolicy } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { canDecidePolicy, daysUntil, policySlots, policyUnfinished } from "./privacy-compliance";

const policy = (over: Partial<CompliancePolicy>): CompliancePolicy =>
  ({
    kind: "privacy_notice",
    language: "en",
    status: "draft",
    drafted_by: "maker",
    ...over,
  }) as CompliancePolicy;

describe("privacy compliance", () => {
  it("lists every policy and language with its published version and open draft", () => {
    const slots = policySlots([
      policy({ id: "p1", status: "published" }),
      policy({ id: "p2", status: "in_review" }),
      policy({ id: "p0", status: "superseded" }),
    ]);
    const en = slots.find((s) => s.kind === "privacy_notice" && s.language === "en");
    expect(en?.published?.id).toBe("p1");
    expect(en?.open?.id).toBe("p2");
    expect(slots.filter((s) => s.kind === "privacy_notice")).toHaveLength(3);
    expect(slots.find((s) => s.kind === "retention_schedule")?.published).toBeNull();
  });

  it("never lets the drafter approve their own policy", () => {
    expect(canDecidePolicy(policy({ status: "in_review" }), "maker")).toBe(false);
    expect(canDecidePolicy(policy({ status: "in_review" }), "checker")).toBe(true);
    expect(canDecidePolicy(policy({ status: "draft" }), "checker")).toBe(false);
  });

  it("counts days to a deadline, negative once past", () => {
    const now = Date.parse("2026-10-26T00:00:00Z");
    expect(daysUntil("2026-11-05", now)).toBe(10);
    expect(daysUntil("2026-10-20", now)).toBeLessThan(0);
  });

  it("will not approve a template still awaiting counsel or a value", () => {
    expect(
      policyUnfinished("> **Template — review with counsel before approval.**"),
    ).not.toBeNull();
    expect(policyUnfinished("DPO: [dpo — not set yet]")).not.toBeNull();
    expect(policyUnfinished("Reviewed and complete.")).toBeNull();
  });
});
