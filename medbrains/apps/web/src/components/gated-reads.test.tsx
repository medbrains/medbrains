import { useModuleStore, usePermissionStore } from "@medbrains/stores";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMasterDataReadGates } from "@/pages/admin/settings/master-data-read-gates";
import { useLabReadGates } from "@/pages/opd/lab-read-gates";
import { render, waitFor } from "@/test/test-utils";
import { useClinicalSetting } from "./Clinical/useClinicalSetting";
import { EmergencyCodeActivity } from "./LiveActivityIsland/EmergencyCodeActivity";

const getTenantSettings = vi.fn().mockResolvedValue([]);
const listCodeActivations = vi.fn().mockResolvedValue([]);
vi.mock("@/services/clinicalSupport.service", () => ({
  clinicalSupportService: { getTenantSettings: () => getTenantSettings() },
}));
vi.mock("@medbrains/api/modules/emergency", () => ({
  emergencyApi: { listCodeActivations: () => listCodeActivations() },
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  useModuleStore.getState().clearModules();
  usePermissionStore.getState().clearPermissions();
});

describe("hospital clinical settings (vitals, review of systems)", () => {
  it("are not read by a clinician without admin.settings.read", async () => {
    usePermissionStore.getState().setPermissions("doctor", ["opd.vitals.create"]);
    const { result } = renderHook(() => useClinicalSetting("vital_parameters"), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(getTenantSettings).not.toHaveBeenCalled();
    expect(result.current).toBeUndefined();
  });

  it("are read by a role that holds admin.settings.read", async () => {
    usePermissionStore.getState().setPermissions("custom", ["admin.settings.read"]);
    renderHook(() => useClinicalSetting("ros_systems"), { wrapper });
    await waitFor(() => expect(getTenantSettings).toHaveBeenCalledTimes(1));
  });
});

describe("the emergency-code island", () => {
  it("does not poll while the Emergency brick is off, even for an admin", async () => {
    usePermissionStore.getState().setPermissions("super_admin", []);
    useModuleStore.getState().setDisabledModules(["emergency"]);
    render(<EmergencyCodeActivity />);
    await new Promise((r) => setTimeout(r, 20));
    expect(listCodeActivations).not.toHaveBeenCalled();
  });

  it("polls while the brick is on and the role may list codes", async () => {
    usePermissionStore.getState().setPermissions("nurse", ["emergency.codes.list"]);
    render(<EmergencyCodeActivity />);
    await waitFor(() => expect(listCodeActivations).toHaveBeenCalled());
  });
});

describe("OPD lab reads", () => {
  it("are off while Lab is switched off, whatever the role holds", () => {
    usePermissionStore.getState().setPermissions("doctor", ["lab.orders.list"]);
    useModuleStore.getState().setDisabledModules(["lab"]);
    const { result } = renderHook(() => useLabReadGates());
    expect(result.current).toEqual({ canListLabOrders: false, canReadLabCatalog: false });
  });

  it("follow each endpoint's permission while Lab is on", () => {
    usePermissionStore.getState().setPermissions("doctor", ["lab.orders.create"]);
    const { result } = renderHook(() => useLabReadGates());
    expect(result.current).toEqual({ canListLabOrders: false, canReadLabCatalog: true });
  });
});

describe("the Master data panel's brick-owned reads", () => {
  it("are all off for an admin while those bricks are switched off", () => {
    usePermissionStore.getState().setPermissions("hospital_admin", []);
    useModuleStore
      .getState()
      .setDisabledModules(["lab", "ipd", "ot", "billing", "inventory", "diet", "pharmacy"]);
    const flags = renderHook(() => useMasterDataReadGates()).result.current;
    for (const [name, value] of Object.entries(flags)) {
      if (name.startsWith("can") && name !== "canViewConsentTemplates") {
        expect([name, value]).toEqual([name, false]);
      }
    }
    expect(flags.canViewConsentTemplates).toBe(true);
  });

  it("ask for exactly the code the endpoint checks", () => {
    usePermissionStore
      .getState()
      .setPermissions("custom", ["lab.reports.view", "ipd.discharge_summary.create"]);
    const flags = renderHook(() => useMasterDataReadGates()).result.current;
    // GET /lab/report-templates needs lab.dispatch.list; discharge templates need ipd.admissions.list.
    expect(flags.canViewLabReportTemplates).toBe(false);
    expect(flags.canViewDischargeTemplates).toBe(false);
  });
});
