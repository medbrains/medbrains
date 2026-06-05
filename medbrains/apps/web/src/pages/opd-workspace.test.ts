// @vitest-environment node

import { describe, expect, it } from "vitest";
import { opdEncounterTabForOrderBasket } from "./opd-workspace";

describe("OPD encounter workspace routing", () => {
  it("routes local order basket actions to the matching encounter tabs", () => {
    expect(opdEncounterTabForOrderBasket("drug")).toBe("prescriptions");
    expect(opdEncounterTabForOrderBasket("lab")).toBe("investigations");
    expect(opdEncounterTabForOrderBasket("radiology")).toBe("investigations");
  });
});
