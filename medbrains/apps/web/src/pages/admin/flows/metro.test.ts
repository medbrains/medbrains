import type { FlowStation } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  bendAt,
  changedKeys,
  describeRouteChange,
  labelWidth,
  layoutMetro,
  METRO,
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

describe("metro geometry", () => {
  const placed = layoutMetro(stations);
  const at = new Map(placed.map((p) => [p.key, p]));

  it("draws no line of zero length, and every line runs left to right", () => {
    const all = [
      ...metroLines(stations, off, null),
      ...metroLines(stations, on, off),
      ...metroLines(stations, { ...on, final_signoff: "medical_superintendent" }, on),
    ];
    for (const l of all) {
      const a = at.get(l.from);
      const b = at.get(l.to);
      expect(b && a && b.x - a.x).toBeGreaterThan(METRO.marker);
    }
  });

  it("keeps branch stations off the main line and in columns of their own", () => {
    const mainXs = new Set(placed.filter((p) => p.lane === 0).map((p) => p.x));
    for (const p of placed.filter((q) => q.lane > 0)) {
      expect(p.y).toBeGreaterThanOrEqual(METRO.laneHeight);
      expect(mainXs.has(p.x)).toBe(false);
    }
  });

  it("turns lane-changing lines in the clear space between labels", () => {
    for (const l of metroLines(stations, on, off)) {
      const a = at.get(l.from);
      const b = at.get(l.to);
      if (!a || !b || a.lane === b.lane) continue;
      const x = a.x + (b.x - a.x) * bendAt(a, b);
      for (const p of placed) {
        expect(Math.abs(x - p.x)).toBeGreaterThanOrEqual(p.width / 2);
      }
    }
  });

  it("spaces columns so even long names never collide", () => {
    const long = [
      st("a", { name: "Superintendent sign-off and final countersignature" }),
      st("b", { name: "Insurance patient?" }),
      st("c", { name: "Pharmacy returns reconciliation" }),
      st("d", { name: "X" }),
    ];
    const p = layoutMetro(long);
    for (let i = 1; i < p.length; i++) {
      const [l, r] = [p[i - 1], p[i]] as [(typeof p)[0], (typeof p)[0]];
      expect(r.x - r.width / 2).toBeGreaterThanOrEqual(l.x + l.width / 2 + METRO.gap);
    }
  });

  it("wraps a name to two lines but never splits its longest word", () => {
    expect(labelWidth("Superintendent sign-off")).toBeGreaterThanOrEqual(
      "Superintendent".length * METRO.charPx,
    );
    expect(labelWidth("X")).toBe(METRO.minWidth);
    expect(labelWidth("a ".repeat(200))).toBe(METRO.maxWidth);
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
