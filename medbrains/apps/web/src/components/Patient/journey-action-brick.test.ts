import { describe, expect, it } from "vitest";
import { journeyActionBrick } from "./journey-action-brick";

describe("journeyActionBrick", () => {
  it("names the brick each journey action belongs to", () => {
    expect(journeyActionBrick("billing.collect_payment")).toBe("billing");
    expect(journeyActionBrick("billing.open_ledger")).toBe("billing");
    expect(journeyActionBrick("emergency.open_mlc")).toBe("emergency");
    expect(journeyActionBrick("camp.open_context")).toBe("camp");
    expect(journeyActionBrick("orders.lab")).toBe("lab");
    expect(journeyActionBrick("orders.radiology")).toBe("radiology");
    expect(journeyActionBrick("imaging.open_study")).toBe("radiology");
    expect(journeyActionBrick("orders.medication")).toBe("opd");
    expect(journeyActionBrick("ipd.admit")).toBe("ipd");
  });

  it("keeps patient, consent and MRD actions on every install", () => {
    expect(journeyActionBrick("patient.edit")).toBeNull();
    expect(journeyActionBrick("consent.verify")).toBeNull();
    expect(journeyActionBrick("mrd.open_case_sheet")).toBeNull();
  });
});
