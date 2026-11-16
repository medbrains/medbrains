import { useModuleStore, usePermissionStore } from "@medbrains/stores";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useOpdVisitGates } from "./useOpdVisitGates";

describe("useOpdVisitGates", () => {
  afterEach(() => {
    useModuleStore.getState().clearModules();
    usePermissionStore.getState().clearPermissions();
  });

  it("lets a user who may create and update visits queue and open one while the EMR is on", () => {
    usePermissionStore
      .getState()
      .setPermissions("receptionist", ["opd.visit.create", "opd.visit.update"]);
    const { result } = renderHook(() => useOpdVisitGates());
    expect(result.current).toEqual({ canCreateOpdVisit: true, canWorkOpdVisit: true });
  });

  it("never creates an OPD visit while the hospital has the EMR off, even for an admin", () => {
    usePermissionStore.getState().setPermissions("super_admin", []);
    useModuleStore.getState().setDisabledModules(["opd"]);
    const { result } = renderHook(() => useOpdVisitGates());
    expect(result.current).toEqual({ canCreateOpdVisit: false, canWorkOpdVisit: false });
  });

  it("queues without opening the visit when the user may not update it", () => {
    usePermissionStore.getState().setPermissions("receptionist", ["opd.visit.create"]);
    const { result } = renderHook(() => useOpdVisitGates());
    expect(result.current).toEqual({ canCreateOpdVisit: true, canWorkOpdVisit: false });
  });
});
