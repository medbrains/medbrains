import type { FlowStation } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  changedKeys,
  describeRouteChange,
  layoutMetro,
  metroLines,
  routeKeys,
  stationsForSwitch,
} from "./metro";

function st(key: string, extra: Partial<FlowStation> = {}): FlowStation {
  return {
    key,
    name: key.toUpperCase(),
    stage: "S",
    kind: { type: "signal", signal: key },
    lane: null,
    switch_when: null,
    fact_when: null,
    sla_minutes: null,
    locked: false,
    holder: "H",
    required_by: null,
    path: `Hospital › F › S › ${key}`,
    ...extra,
  };
}

// The discharge track's shape: a switch, an insurance branch, a superintendent branch.
const stations = [
  st("summary", { locked: true }),
  st("pharmacy"),
  st("insurance_check", { kind: { type: "switch", fact: "is_insurance" } }),
  st("tpa", {
    lane: "Insurance",
    switch_when: { tpa_before_billing: true },
    fact_when: { is_insurance: true },
  }),
  st("billing"),
  st("ms", { lane: "Superintendent", switch_when: { final_signoff: "medical_superintendent" } }),
  st("finalize", { kind: { type: "action", action: "x" } }),
];
const off = { tpa_before_billing: false, final_signoff: "treating_doctor" };
const on = { tpa_before_billing: true, final_signoff: "treating_doctor" };

describe("routeKeys", () => {
  it("skips branches whose switch is off and takes them when on", () => {
    expect(routeKeys(stations, off)).toEqual([
      "summary",
      "pharmacy",
      "insurance_check",
      "billing",
      "finalize",
    ]);
    expect(routeKeys(stations, on)).toContain("tpa");
    expect(routeKeys(stations, on).indexOf("tpa")).toBeLessThan(
      routeKeys(stations, on).indexOf("billing"),
    );
  });
  it("never drops a locked signal", () => {
    for (const s of [off, on, { ...on, final_signoff: "medical_superintendent" }]) {
      expect(routeKeys(stations, s)[0]).toBe("summary");
    }
  });
});

describe("layoutMetro", () => {
  it("puts the main line in lane 0 and each branch in its own lane, column by order", () => {
    const placed = layoutMetro(stations);
    expect(placed.map((p) => p.column)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(placed.find((p) => p.key === "tpa")?.lane).toBe(1);
    expect(placed.find((p) => p.key === "ms")?.lane).toBe(2);
    expect(placed.filter((p) => p.lane === 0)).toHaveLength(5);
  });
});

describe("metroLines", () => {
  it("draws the route not taken dotted from and back to the main line", () => {
    const lines = metroLines(stations, off, null);
    expect(lines).toContainEqual({ from: "insurance_check", to: "billing", kind: "active" });
    expect(lines).toContainEqual({ from: "insurance_check", to: "tpa", kind: "idle" });
    expect(lines).toContainEqual({ from: "tpa", to: "billing", kind: "idle" });
  });
  it("ghosts the old route only where it differs", () => {
    const lines = metroLines(stations, on, off);
    expect(lines).toContainEqual({ from: "insurance_check", to: "tpa", kind: "active" });
    expect(lines).toContainEqual({ from: "insurance_check", to: "billing", kind: "ghost" });
    expect(lines.filter((l) => l.kind === "ghost")).toHaveLength(1);
  });
});

describe("switch → route", () => {
  it("says what changed in words", () => {
    expect(describeRouteChange(stations, off, on)).toEqual([
      "Route now stops at TPA for insurance patients",
    ]);
    expect(describeRouteChange(stations, on, off)).toEqual([
      "Route now skips TPA for insurance patients",
    ]);
  });
  it("finds the stations a switch decides and the switches that changed", () => {
    expect(stationsForSwitch(stations, "tpa_before_billing")).toEqual(["tpa"]);
    expect(changedKeys(off, on)).toEqual(["tpa_before_billing"]);
  });
});
