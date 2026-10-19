// @vitest-environment node

import { describe, expect, it } from "vitest";
import { toTtiRequest, ttiSummary } from "./tti-model";

describe("toTtiRequest", () => {
  it("sends only the markers entered, with the shared method and kit lot", () => {
    expect(
      toTtiRequest({ hiv: "non_reactive", hcv: "", malaria: "reactive", kit_lot: " L-7 " }),
    ).toEqual({
      results: [
        { marker: "hiv", result: "non_reactive", method: undefined, kit_lot: "L-7" },
        { marker: "malaria", result: "reactive", method: undefined, kit_lot: "L-7" },
      ],
    });
  });
});

describe("ttiSummary", () => {
  const base = { donation_id: "d", results: [], transfused_units: 0 };
  it("never reads an incomplete panel as cleared", () => {
    expect(ttiSummary({ ...base, status: "incomplete", outstanding: ["hcv"] })).toContain(
      "Not yet non-reactive: HCV",
    );
  });
  it("asks for a lookback when a reactive donation was already transfused", () => {
    const text = ttiSummary({
      ...base,
      status: "reactive",
      outstanding: ["hiv"],
      transfused_units: 2,
    });
    expect(text).toContain("Reactive for HIV 1/2");
    expect(text).toContain("start a lookback");
  });
});
