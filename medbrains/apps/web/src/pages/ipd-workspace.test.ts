// @vitest-environment node

import { describe, expect, it } from "vitest";
import { ipdActionRailSectionsForTab, ipdWorkspaceTabForOrderBasket } from "./ipd-workspace";

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
});
