import type { FlowForecast, FlowHistoryPoint, FlowZoneLive } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  bandFor,
  crowdBand,
  floorSummary,
  layoutGrid,
  staffBand,
  timeline,
  waitBand,
  zonesAt,
  zoneViews,
} from "./flow-state";

function zone(over: Partial<FlowZoneLive> = {}): FlowZoneLive {
  return {
    location_id: "z1",
    name: "Billing",
    code: "BILL",
    grid_row: null,
    grid_col: null,
    capacity: 60,
    comfort_limit: 40,
    attendant_factor: 1.8,
    goal_wait_minutes: 15,
    minute: "2026-10-20T06:00:00Z",
    people_est: 10,
    patients: 5,
    waiting: 5,
    checked_in: 0,
    visitors: 0,
    staff: 2,
    wait_minutes: 6,
    served_30m: 4,
    open_counters: 1,
    counters: [],
    unknown_sources: [],
    ...over,
  };
}

describe("crowd band", () => {
  it("rises with the crowd against the comfort limit and tops out over capacity", () => {
    expect(crowdBand(zone({ people_est: 10 }))).toBe(0);
    expect(crowdBand(zone({ people_est: 25 }))).toBe(1);
    expect(crowdBand(zone({ people_est: 40 }))).toBe(2);
    expect(crowdBand(zone({ people_est: 45 }))).toBe(3);
    expect(crowdBand(zone({ people_est: 61 }))).toBe(4);
  });

  it("is unknown, not quiet, when the count is unknown", () => {
    expect(crowdBand(zone({ people_est: null }))).toBeNull();
  });
});

describe("overlays", () => {
  it("shade the same zone differently by what they measure", () => {
    const z = zone({ people_est: 50, staff: 0, wait_minutes: 30 });
    const none = new Set<string>();
    expect(bandFor("crowd", z, none)).toBe(3);
    expect(bandFor("wait", z, none)).toBe(4);
    expect(bandFor("staff", z, none)).toBe(4);
  });

  it("call a queue nobody is calling a bottleneck, and so is open advice", () => {
    expect(bandFor("bottleneck", zone({ served_30m: 0 }), new Set())).toBe(4);
    expect(bandFor("bottleneck", zone(), new Set(["z1"]))).toBe(4);
    expect(bandFor("bottleneck", zone({ waiting: 0 }), new Set())).toBe(0);
  });

  it("read the wait against the zone's own goal", () => {
    expect(waitBand(zone({ wait_minutes: 14 }))).toBe(2);
    expect(waitBand(zone({ wait_minutes: 14, goal_wait_minutes: 10 }))).toBe(3);
    expect(staffBand(zone({ people_est: 0, staff: 0 }))).toBe(0);
  });
});

describe("grid layout", () => {
  it("keeps placed zones and fills the rest in reading order around them", () => {
    const grid = layoutGrid([
      zone({ location_id: "a", grid_row: 1, grid_col: 1 }),
      zone({ location_id: "b" }),
      zone({ location_id: "c" }),
      zone({ location_id: "d" }),
    ]);
    expect(grid.get("a")).toEqual({ row: 1, col: 1 });
    expect(grid.get("b")).toEqual({ row: 1, col: 2 });
    expect(grid.get("d")).toEqual({ row: 2, col: 1 });
  });
});

describe("map state", () => {
  it("writes the band as a word and the summary names the zones over their limit", () => {
    const views = zoneViews(
      [zone({ people_est: 70 }), zone({ location_id: "z2", name: "Lab", people_est: null })],
      "crowd",
      [],
    );
    expect(views[0]?.bandLabel).toBe("Over limit");
    expect(views[1]?.bandLabel).toBe("Unknown");
    expect(views[1]?.metric).toBe("Unknown");
    expect(floorSummary("Floor G", views)).toBe("Floor G: 1 zone over limit: Billing; 1 unknown.");
  });

  it("puts today's past, then now, then the forecast on one timeline", () => {
    const history: FlowHistoryPoint[] = [
      {
        location_id: "z1",
        at: "2026-10-20T04:00:00Z",
        people_est: 12,
        waiting: 3,
        wait_minutes: 9,
      },
    ];
    const forecast: FlowForecast = {
      start: "2026-10-20T06:00:00Z",
      step_minutes: 15,
      hours: 1,
      basis: "Estimate",
      points: [
        { location_id: "z1", at: "2026-10-20T06:00:00Z", people_est: 10 },
        { location_id: "z1", at: "2026-10-20T06:15:00Z", people_est: 30 },
      ],
    };
    const steps = timeline(history, forecast);
    expect(steps.map((s) => s.moment.kind)).toEqual(["history", "live", "forecast"]);
    const ahead = zonesAt([zone()], steps[2]?.moment ?? { kind: "live" }, history, forecast);
    expect(ahead[0]?.people_est).toBe(30);
    // A forecast does not predict waits: unknown, never 0.
    expect(ahead[0]?.wait_minutes).toBeNull();
    const past = zonesAt([zone()], steps[0]?.moment ?? { kind: "live" }, history, forecast);
    expect(past[0]?.people_est).toBe(12);
  });
});
