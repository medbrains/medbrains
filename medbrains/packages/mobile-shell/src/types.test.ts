import { describe, expect, it } from "vitest";
import {
  filterAccessibleModules,
  userHasModuleAccess,
  type Module,
  type TenantIdentity,
} from "./types.js";

const FakeIcon = (() => null) as unknown as Module["icon"];
const FakeNav = (() => null) as unknown as Module["navigator"];

const m = (id: string, perms: string[]): Module => ({
  id,
  displayName: id,
  icon: FakeIcon,
  requiredPermissions: perms,
  navigator: FakeNav,
});

const identity = (
  role: string | null,
  permissions: string[],
): TenantIdentity => ({
  tenantId: "t",
  userId: "u",
  jwt: "stub",
  role,
  permissions,
  departmentIds: [],
});

describe("userHasModuleAccess", () => {
  it("denies when identity is null", () => {
    expect(userHasModuleAccess(m("doctor", ["opd.view"]), null)).toBe(false);
  });

  it("allows modules with no required permissions", () => {
    expect(userHasModuleAccess(m("home", []), identity("nurse", []))).toBe(true);
  });

  it("super_admin and hospital_admin bypass permission check", () => {
    const mod = m("doctor", ["opd.view", "opd.write"]);
    expect(userHasModuleAccess(mod, identity("super_admin", []))).toBe(true);
    expect(userHasModuleAccess(mod, identity("hospital_admin", []))).toBe(true);
  });

  it("checks every required permission", () => {
    const mod = m("doctor", ["opd.view", "opd.write"]);
    expect(userHasModuleAccess(mod, identity("doctor", ["opd.view"]))).toBe(false);
    expect(
      userHasModuleAccess(mod, identity("doctor", ["opd.view", "opd.write"])),
    ).toBe(true);
  });
});

describe("filterAccessibleModules", () => {
  it("retains only modules user can access", () => {
    const all = [m("a", []), m("b", ["x.view"]), m("c", ["y.view"])];
    const filtered = filterAccessibleModules(all, identity("staff", ["x.view"]));
    expect(filtered.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("returns empty when identity is null", () => {
    expect(filterAccessibleModules([m("a", [])], null)).toEqual([]);
  });
});
