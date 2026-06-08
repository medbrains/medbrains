// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  isOpdEncounterTabValue,
  opdEncounterOrderBasketRoute,
  opdEncounterTabForOrderBasket,
  opdEncounterWorkspaceTabRoute,
  opdOrderBasketTabFromSearchParams,
} from "./opd-workspace";

describe("OPD encounter workspace routing", () => {
  it("routes local order basket actions to the matching encounter tabs", () => {
    expect(opdEncounterTabForOrderBasket("drug")).toBe("prescriptions");
    expect(opdEncounterTabForOrderBasket("lab")).toBe("investigations");
    expect(opdEncounterTabForOrderBasket("radiology")).toBe("investigations");
  });

  it("keeps OPD order basket activation route-addressable", () => {
    expect(opdEncounterOrderBasketRoute("encounter-1", "drug")).toBe(
      "/opd/encounters/encounter-1?order=drug#prescriptions",
    );
    expect(opdEncounterOrderBasketRoute("encounter-1", "lab")).toBe(
      "/opd/encounters/encounter-1?order=lab#investigations",
    );
    expect(opdEncounterWorkspaceTabRoute("encounter-1", "consultation")).toBe(
      "/opd/encounters/encounter-1#consultation",
    );
  });

  it("parses only supported order basket tabs from OPD routes", () => {
    expect(opdOrderBasketTabFromSearchParams(new URLSearchParams("order=drug"))).toBe("drug");
    expect(opdOrderBasketTabFromSearchParams(new URLSearchParams("order=radiology"))).toBe(
      "radiology",
    );
    expect(opdOrderBasketTabFromSearchParams(new URLSearchParams("order=notes"))).toBeNull();
    expect(opdOrderBasketTabFromSearchParams(new URLSearchParams("tab=lab"))).toBeNull();
  });

  it("guards supported OPD encounter tab hashes", () => {
    expect(isOpdEncounterTabValue("consultation")).toBe(true);
    expect(isOpdEncounterTabValue("pharmacy-dispatch")).toBe(true);
    expect(isOpdEncounterTabValue("unknown")).toBe(false);
    expect(isOpdEncounterTabValue(null)).toBe(false);
  });
});
