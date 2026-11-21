import { useModuleStore, usePermissionStore } from "@medbrains/stores";
import { BRICK_MANIFESTS } from "@medbrains/types";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PANEL_COMPONENTS, type PanelSlot } from "./registry";
import { usePanels } from "./use-panels";

const declared = Object.values(BRICK_MANIFESTS).flatMap((b) => b.panels);

describe("brick panels", () => {
  afterEach(() =>
    act(() => {
      useModuleStore.getState().clearModules();
      usePermissionStore.getState().clearPermissions();
    }),
  );

  it("registers exactly the panels the manifest declares, each under its slot", () => {
    const registered = Object.entries(PANEL_COMPONENTS).flatMap(([slot, panels]) =>
      Object.keys(panels).map((id) => `${slot} ${id}`),
    );
    expect(registered.sort()).toEqual(declared.map((p) => `${p.slot} ${p.id}`).sort());
  });

  it("shows a panel only while its brick is on and its permission is held", () => {
    const slot: PanelSlot = "patient.tabs";
    act(() => usePermissionStore.getState().setPermissions("nurse", ["lab.orders.list"]));
    const { result, rerender } = renderHook(() => usePanels(slot).map((p) => p.id));
    expect(result.current).toEqual(["lab.patient_orders"]);
    act(() => useModuleStore.getState().setDisabledModules(["lab"]));
    rerender();
    expect(result.current).toEqual([]);
  });
});
