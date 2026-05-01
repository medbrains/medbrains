import { describe, it, expect } from "vitest";
import { useResourcePerm, type ResourceWithPerms } from "./useResourcePerm";

describe("useResourcePerm", () => {
  it("returns deny-all when row is null", () => {
    expect(useResourcePerm(null)).toEqual({
      canView: false,
      canEdit: false,
      canDelete: false,
      canShare: false,
      canApprove: false,
    });
  });

  it("returns deny-all when row is undefined", () => {
    expect(useResourcePerm(undefined)).toEqual({
      canView: false,
      canEdit: false,
      canDelete: false,
      canShare: false,
      canApprove: false,
    });
  });

  it("fails closed when _perms is missing (backend not opted-in yet)", () => {
    const row: ResourceWithPerms = { id: "abc" };
    expect(useResourcePerm(row).canView).toBe(false);
    expect(useResourcePerm(row).canEdit).toBe(false);
  });

  it("maps each backend flag to a typed boolean", () => {
    const row: ResourceWithPerms = {
      id: "abc",
      _perms: {
        view: true,
        edit: true,
        delete: false,
        share: true,
        approve: false,
      },
    };
    expect(useResourcePerm(row)).toEqual({
      canView: true,
      canEdit: true,
      canDelete: false,
      canShare: true,
      canApprove: false,
    });
  });

  it("treats missing flags inside _perms as false (fail-closed)", () => {
    const row: ResourceWithPerms = {
      id: "abc",
      _perms: { view: true }, // only view set
    };
    const r = useResourcePerm(row);
    expect(r.canView).toBe(true);
    expect(r.canEdit).toBe(false);
    expect(r.canDelete).toBe(false);
    expect(r.canShare).toBe(false);
    expect(r.canApprove).toBe(false);
  });

  it("bypass-style _perms (all true) maps to all-true result", () => {
    const row: ResourceWithPerms = {
      id: "abc",
      _perms: {
        view: true,
        edit: true,
        delete: true,
        share: true,
        approve: true,
      },
    };
    const r = useResourcePerm(row);
    expect(Object.values(r).every((v) => v === true)).toBe(true);
  });
});
