// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  IPD_ACTION_RAIL_ACTIONS,
  type IpdActionRailContext,
  ipdActionRailAction,
  ipdActionRailSectionsForTab,
  ipdWorkspaceTabForOrderBasket,
  resolveIpdActionRailActions,
} from "./ipd-workspace";

const activeContext: IpdActionRailContext = {
  admissionHasAssignedBed: true,
  admissionIsActive: true,
  canCreateTransfer: true,
  canDischarge: true,
  canManageDeathRecords: true,
  canOrder: true,
};

describe("IPD workspace action rail focus", () => {
  it("focuses order actions for medication and investigation tabs", () => {
    expect(ipdActionRailSectionsForTab("prescriptions")).toEqual(["orders", "handoffs"]);
    expect(ipdActionRailSectionsForTab("investigations")).toEqual(["orders", "handoffs"]);
  });

  it("focuses finance actions for billing and insurance tabs", () => {
    expect(ipdActionRailSectionsForTab("billing-tab")).toEqual(["finance", "handoffs"]);
    expect(ipdActionRailSectionsForTab("insurance-pa")).toEqual(["finance", "handoffs"]);
  });

  it("focuses discharge actions for discharge workflow tabs", () => {
    expect(ipdActionRailSectionsForTab("discharge-summary")).toEqual([
      "discharge",
      "admission",
      "handoffs",
    ]);
  });

  it("keeps handoffs visible for unknown or overview tabs", () => {
    expect(ipdActionRailSectionsForTab("overview")).toEqual(["handoffs", "admission"]);
    expect(ipdActionRailSectionsForTab("unknown")).toEqual(["handoffs", "admission"]);
  });

  it("routes local order basket actions to the matching workspace tabs", () => {
    expect(ipdWorkspaceTabForOrderBasket("drug")).toBe("prescriptions");
    expect(ipdWorkspaceTabForOrderBasket("lab")).toBe("investigations");
    expect(ipdWorkspaceTabForOrderBasket("radiology")).toBe("investigations");
  });

  it("describes action activation events and permission contracts", () => {
    expect(IPD_ACTION_RAIL_ACTIONS.map((action) => action.id)).toEqual([
      "order_medicines",
      "order_lab",
      "order_imaging",
      "refer_out",
      "dama_lama",
      "mark_death",
    ]);
    for (const action of IPD_ACTION_RAIL_ACTIONS) {
      expect(action.activatesAfter.length).toBeGreaterThan(0);
      expect(action.requiredPermissions.length).toBeGreaterThan(0);
    }
  });

  it("requires an active admission and assigned bed before inpatient orders", () => {
    const withoutBed = resolveIpdActionRailActions({
      ...activeContext,
      admissionHasAssignedBed: false,
    });
    const labOrder = ipdActionRailAction(withoutBed, "order_lab");
    expect(labOrder.enabled).toBe(false);
    expect(labOrder.disabledReasonText).toBe("Assign a bed before inpatient orders");

    const active = resolveIpdActionRailActions(activeContext);
    expect(ipdActionRailAction(active, "order_lab").enabled).toBe(true);
  });

  it("keeps admission actions explainably disabled after discharge or permission loss", () => {
    const discharged = resolveIpdActionRailActions({
      ...activeContext,
      admissionIsActive: false,
    });
    expect(ipdActionRailAction(discharged, "refer_out").disabledReasonText).toBe(
      "Refer or transfer the patient out needs an active admission",
    );

    const denied = resolveIpdActionRailActions({
      ...activeContext,
      canDischarge: false,
    });
    expect(ipdActionRailAction(denied, "dama_lama").enabled).toBe(false);
    expect(ipdActionRailAction(denied, "dama_lama").disabledReasonText).toBe(
      "Requires ipd.discharge.create",
    );
  });
});
