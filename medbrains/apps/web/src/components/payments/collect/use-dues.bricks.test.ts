import { useModuleStore, usePermissionStore } from "@medbrains/stores";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useCanCollect } from "./use-dues";

describe("useCanCollect", () => {
  afterEach(() => {
    useModuleStore.getState().clearModules();
    usePermissionStore.getState().clearPermissions();
  });

  it("lets a cashier collect while Billing is on", () => {
    usePermissionStore.getState().setPermissions("cashier", ["billing.collect.opd"]);
    expect(renderHook(() => useCanCollect("opd")).result.current).toBe(true);
  });

  it("collects nothing while the hospital has Billing off, even for an admin", () => {
    usePermissionStore.getState().setPermissions("super_admin", []);
    useModuleStore.getState().setDisabledModules(["billing"]);
    expect(renderHook(() => useCanCollect()).result.current).toBe(false);
  });
});
