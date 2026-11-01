import { describe, expect, it } from "vitest";
import { auditChainStatus, rlsStatus } from "./status";

const NOW = Date.parse("2026-11-01T12:00:00Z");
const verdict = (completed_at: string, valid = true) => ({
  completed_at,
  valid,
  rows_checked: 1200,
  broken_at: valid ? null : "b0b0b0b0-0000-0000-0000-000000000001",
});

describe("audit chain status", () => {
  it("never reads a missing verdict as healthy", () => {
    expect(auditChainStatus(null, NOW).tone).toBe("warning");
  });
  it("calls a broken chain broken and names where", () => {
    const status = auditChainStatus(verdict("2026-11-01T02:00:00Z", false), NOW);
    expect(status.tone).toBe("danger");
    expect(status.detail).toContain("b0b0b0b0");
  });
  it("flags a verdict the nightly job has not refreshed in two days", () => {
    expect(auditChainStatus(verdict("2026-10-29T02:00:00Z"), NOW).label).toBe("Out of date");
  });
  it("shows a fresh valid verdict as verified", () => {
    expect(auditChainStatus(verdict("2026-11-01T02:00:00Z"), NOW).tone).toBe("success");
  });
});

describe("row level security status", () => {
  it("is danger when the request role bypasses RLS", () => {
    expect(rlsStatus({ role: "medbrains", enforced: false }).tone).toBe("danger");
    expect(rlsStatus({ role: "medbrains_app", enforced: true }).tone).toBe("success");
  });
});
