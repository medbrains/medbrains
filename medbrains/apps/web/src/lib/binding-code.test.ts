import type { DeviceBindingCode } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { bindingStatus, issueBindingSchema } from "./binding-code";

const NOW = new Date("2026-10-19T10:00:00Z");
const code = (over: Partial<DeviceBindingCode>): DeviceBindingCode => ({
  id: "c1",
  label: "Ward 3",
  max_uses: 2,
  use_count: 0,
  expires_at: "2026-10-20T10:00:00Z",
  revoked_at: null,
  revoke_reason: null,
  issued_by_name: "Admin",
  created_at: "2026-10-19T09:00:00Z",
  ...over,
});

describe("bindingStatus", () => {
  it("is active until used up, expired or revoked", () => {
    expect(bindingStatus(code({}), NOW)).toBe("active");
    expect(bindingStatus(code({ use_count: 2 }), NOW)).toBe("used_up");
    expect(bindingStatus(code({ expires_at: "2026-10-19T10:00:00Z" }), NOW)).toBe("expired");
  });

  it("says revoked even for a code that also ran out", () => {
    const both = code({ use_count: 2, expires_at: "2026-10-01T00:00:00Z", revoked_at: "x" });
    expect(bindingStatus(both, NOW)).toBe("revoked");
  });
});

describe("issueBindingSchema", () => {
  it("takes the server's limits and nothing past them", () => {
    expect(
      issueBindingSchema.safeParse({ label: " Ward ", expires_in_hours: "24", max_uses: "1" })
        .success,
    ).toBe(true);
    expect(
      issueBindingSchema.safeParse({ label: "", expires_in_hours: 24, max_uses: 1 }).success,
    ).toBe(false);
    expect(
      issueBindingSchema.safeParse({ label: "x", expires_in_hours: 721, max_uses: 1 }).success,
    ).toBe(false);
    expect(
      issueBindingSchema.safeParse({ label: "x", expires_in_hours: 1, max_uses: 501 }).success,
    ).toBe(false);
    expect(
      issueBindingSchema.safeParse({ label: "x", expires_in_hours: 1, max_uses: 0 }).success,
    ).toBe(false);
  });
});
