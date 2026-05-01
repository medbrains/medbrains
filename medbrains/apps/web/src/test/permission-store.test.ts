import { describe, it, expect, beforeEach } from "vitest";
import { usePermissionStore } from "@medbrains/stores";

/**
 * The permission store powers `useHasPermission`, `useRequirePermission`,
 * and the override drawer. Bugs here ripple through every UI gate.
 */
describe("permission-store", () => {
  beforeEach(() => {
    usePermissionStore.getState().clearPermissions();
  });

  describe("hasPermission", () => {
    it("returns false when nothing is loaded", () => {
      expect(usePermissionStore.getState().hasPermission("patients.list")).toBe(false);
    });

    it("returns true when the code is in the user's permissions", () => {
      usePermissionStore.getState().setPermissions("doctor", [
        "patients.list",
        "opd.queue.list",
      ]);
      expect(usePermissionStore.getState().hasPermission("patients.list")).toBe(true);
      expect(usePermissionStore.getState().hasPermission("opd.queue.list")).toBe(true);
    });

    it("returns false when the code is not granted", () => {
      usePermissionStore.getState().setPermissions("doctor", ["patients.list"]);
      expect(usePermissionStore.getState().hasPermission("billing.invoices.create")).toBe(false);
    });

    it("super_admin bypasses every check (returns true even with empty perms)", () => {
      usePermissionStore.getState().setPermissions("super_admin", []);
      expect(usePermissionStore.getState().hasPermission("anything.at.all")).toBe(true);
      expect(usePermissionStore.getState().hasPermission("billing.invoices.delete")).toBe(true);
    });

    it("hospital_admin also bypasses", () => {
      usePermissionStore.getState().setPermissions("hospital_admin", []);
      expect(usePermissionStore.getState().hasPermission("integration.delete")).toBe(true);
    });

    it("non-bypass roles do NOT bypass", () => {
      usePermissionStore.getState().setPermissions("audit_officer", ["audit.list"]);
      expect(usePermissionStore.getState().hasPermission("admin.users.create")).toBe(false);
    });
  });

  describe("hasAllPermissions", () => {
    it("returns true only when every code is held", () => {
      usePermissionStore.getState().setPermissions("billing_clerk", [
        "billing.invoices.list",
        "billing.invoices.create",
      ]);
      const s = usePermissionStore.getState();
      expect(
        s.hasAllPermissions(["billing.invoices.list", "billing.invoices.create"]),
      ).toBe(true);
      expect(
        s.hasAllPermissions(["billing.invoices.list", "billing.payments.create"]),
      ).toBe(false);
    });

    it("bypass role returns true even for empty grant", () => {
      usePermissionStore.getState().setPermissions("super_admin", []);
      expect(usePermissionStore.getState().hasAllPermissions(["x", "y", "z"])).toBe(true);
    });
  });

  describe("hasAnyPermission", () => {
    it("returns true when at least one code matches", () => {
      usePermissionStore.getState().setPermissions("doctor", ["patients.list"]);
      const s = usePermissionStore.getState();
      expect(s.hasAnyPermission(["billing.invoices.list", "patients.list"])).toBe(true);
    });

    it("returns false when none match", () => {
      usePermissionStore.getState().setPermissions("doctor", ["patients.list"]);
      expect(
        usePermissionStore.getState().hasAnyPermission(["a.b.c", "x.y.z"]),
      ).toBe(false);
    });

    it("bypass role short-circuits to true on empty input", () => {
      usePermissionStore.getState().setPermissions("hospital_admin", []);
      expect(usePermissionStore.getState().hasAnyPermission([])).toBe(true);
    });
  });

  describe("getFieldAccess", () => {
    it("defaults to 'edit' when no override is set", () => {
      usePermissionStore.getState().setPermissions("doctor", []);
      expect(usePermissionStore.getState().getFieldAccess("patients.aadhaar_number")).toBe("edit");
    });

    it("returns the override level when set", () => {
      usePermissionStore.getState().setPermissions(
        "lab_technician",
        ["lab.orders.list"],
        { "patients.aadhaar_number": "hidden" },
      );
      expect(
        usePermissionStore.getState().getFieldAccess("patients.aadhaar_number"),
      ).toBe("hidden");
    });

    it("bypass role always gets 'edit' regardless of override", () => {
      usePermissionStore.getState().setPermissions(
        "super_admin",
        [],
        { "patients.aadhaar_number": "hidden" },
      );
      expect(
        usePermissionStore.getState().getFieldAccess("patients.aadhaar_number"),
      ).toBe("edit");
    });
  });

  describe("clearPermissions", () => {
    it("resets the store to an empty state", () => {
      usePermissionStore.getState().setPermissions("doctor", ["patients.list"]);
      usePermissionStore.getState().clearPermissions();
      expect(usePermissionStore.getState().hasPermission("patients.list")).toBe(false);
      expect(usePermissionStore.getState().userRole).toBe(null);
    });
  });
});
