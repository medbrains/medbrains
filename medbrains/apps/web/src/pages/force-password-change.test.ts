import { describe, expect, it } from "vitest";
import { needsRealAdminEmail } from "./force-password-change";

describe("needsRealAdminEmail", () => {
  it("asks the seeded admin handed to a hospital for a real address", () => {
    expect(needsRealAdminEmail("admin@medbrains.localhost", "super_admin")).toBe(true);
    expect(needsRealAdminEmail(" Admin@MedBrains.localhost ", "hospital_admin")).toBe(true);
  });

  it("does not ask a MedBrains account or anyone with a real address", () => {
    expect(needsRealAdminEmail("admin@medbrains.localhost", "vendor_support")).toBe(false);
    expect(needsRealAdminEmail("chief@hospital.example", "hospital_admin")).toBe(false);
    expect(needsRealAdminEmail(undefined, undefined)).toBe(false);
  });
});
