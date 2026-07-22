// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";
import { usePermissionStore } from "./permission-store";

/**
 * This store is the client half of access control: every `useHasPermission`
 * gate and every page guard reads it. The backend enforces independently — a
 * wrong answer here does not by itself grant access to data — but it decides
 * what a user is shown and offered, so the fail-open defaults below are worth
 * stating out loud rather than discovering later.
 */

const store = () => usePermissionStore.getState();

beforeEach(() => {
  store().clearPermissions();
});

describe("permission store — ordinary roles", () => {
  beforeEach(() => {
    store().setPermissions("nurse", ["opd.vitals.create", "opd.vitals.list"]);
  });

  it("grants exactly what was granted", () => {
    expect(store().hasPermission("opd.vitals.create")).toBe(true);
    expect(store().hasPermission("pharmacy.dispensing.create")).toBe(false);
  });

  it("hasAllPermissions requires every code, hasAnyPermission requires one", () => {
    expect(store().hasAllPermissions(["opd.vitals.create", "opd.vitals.list"])).toBe(true);
    expect(store().hasAllPermissions(["opd.vitals.create", "billing.invoices.create"])).toBe(false);
    expect(store().hasAnyPermission(["billing.invoices.create", "opd.vitals.list"])).toBe(true);
    expect(store().hasAnyPermission(["billing.invoices.create"])).toBe(false);
  });

  it("permission codes are matched exactly, not by prefix", () => {
    expect(store().hasPermission("opd.vitals")).toBe(false);
    expect(store().hasPermission("opd.vitals.create.extra")).toBe(false);
    expect(store().hasPermission("OPD.VITALS.CREATE")).toBe(false);
  });
});

describe("permission store — bypass roles", () => {
  it("super_admin and hospital_admin satisfy every check", () => {
    for (const role of ["super_admin", "hospital_admin"]) {
      store().setPermissions(role, []);
      expect(store().hasPermission("anything.at.all")).toBe(true);
      expect(store().hasAllPermissions(["a", "b", "c"])).toBe(true);
      expect(store().hasAnyPermission(["a"])).toBe(true);
      expect(store().getFieldAccess("any.field")).toBe("edit");
    }
  });

  it("bypass wins even with an empty permission list", () => {
    store().setPermissions("super_admin", []);
    expect(store().hasPermission("admin.users.delete")).toBe(true);
  });

  it("bypass overrides an explicitly restricted field", () => {
    store().setPermissions("hospital_admin", [], { "billing.amount": "hidden" });
    expect(store().getFieldAccess("billing.amount")).toBe("edit");
  });

  /**
   * The role name is compared against a literal Set, so anything that is not
   * an exact match is treated as an ordinary role. That is the safe direction
   * — a casing or naming drift denies rather than grants.
   */
  it("role matching is exact, so near-misses do not gain bypass", () => {
    for (const role of ["SUPER_ADMIN", "Super_Admin", "superadmin", "super_admin ", "admin"]) {
      store().setPermissions(role, []);
      expect(store().hasPermission("admin.users.delete")).toBe(false);
    }
  });
});

describe("permission store — empty inputs", () => {
  beforeEach(() => {
    store().setPermissions("nurse", ["opd.vitals.create"]);
  });

  /**
   * QUIRK: these inherit JS every/some semantics, so an empty list allows
   * under hasAllPermissions and denies under hasAnyPermission. A gate built
   * from a filtered array that happened to come out empty therefore flips
   * meaning depending on which helper it used.
   *
   * Identical asymmetry to `all: []` / `any: []` in evaluateCondition
   * (dynamic-form.test.ts) — same shape, different module.
   */
  it("QUIRK: an empty code list allows for All and denies for Any", () => {
    expect(store().hasAllPermissions([])).toBe(true);
    expect(store().hasAnyPermission([])).toBe(false);
  });
});

describe("permission store — field access", () => {
  it("returns the configured level for a known field", () => {
    store().setPermissions("nurse", [], {
      "billing.amount": "hidden",
      "patient.notes": "view",
      "patient.name": "edit",
    });
    expect(store().getFieldAccess("billing.amount")).toBe("hidden");
    expect(store().getFieldAccess("patient.notes")).toBe("view");
    expect(store().getFieldAccess("patient.name")).toBe("edit");
  });

  /**
   * QUIRK worth knowing: an unlisted field defaults to "edit", so field access
   * is opt-in restriction rather than opt-in permission. If the server omits a
   * field from the map — or sends an empty map — the UI offers it as editable.
   */
  it("QUIRK: an unlisted field defaults to editable, not restricted", () => {
    store().setPermissions("nurse", [], { "billing.amount": "hidden" });
    expect(store().getFieldAccess("some.field.never.configured")).toBe("edit");

    store().setPermissions("nurse", []);
    expect(store().getFieldAccess("billing.amount")).toBe("edit");
  });
});

describe("permission store — lifecycle", () => {
  it("clearPermissions revokes everything, including bypass", () => {
    store().setPermissions("super_admin", ["a"], { f: "hidden" }, 7);
    expect(store().hasPermission("a")).toBe(true);

    store().clearPermissions();
    expect(store().userRole).toBeNull();
    expect(store().hasPermission("a")).toBe(false);
    expect(store().hasAnyPermission(["a"])).toBe(false);
    expect(store().permVersion).toBe(0);
  });

  it("a logged-out store denies, since no role means no bypass", () => {
    expect(store().userRole).toBeNull();
    expect(store().hasPermission("anything")).toBe(false);
    expect(store().getFieldAccess("any.field")).toBe("edit");
  });

  it("setPermissions replaces rather than merges", () => {
    store().setPermissions("nurse", ["a", "b"]);
    store().setPermissions("nurse", ["c"]);
    expect(store().hasPermission("a")).toBe(false);
    expect(store().hasPermission("c")).toBe(true);
  });

  it("permVersion is stored and defaults to 0 when omitted", () => {
    store().setPermissions("nurse", [], undefined, 42);
    expect(store().permVersion).toBe(42);
    store().setPermissions("nurse", []);
    expect(store().permVersion).toBe(0);
  });

  it("duplicate codes collapse, since permissions are held as a Set", () => {
    store().setPermissions("nurse", ["a", "a", "a"]);
    expect(store().userPermissions.size).toBe(1);
    expect(store().hasPermission("a")).toBe(true);
  });
});
