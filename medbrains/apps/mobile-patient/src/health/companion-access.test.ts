/**
 * The decision under test is "hidden unless somebody said yes", and every case
 * here fails if that is reversed rather than merely if the code is reshaped.
 *
 * The unknown cases matter most. A companion that appeared while its
 * entitlement was still loading would flash into view for a tenant that never
 * licensed it, and a feature nobody agreed to sell is worse than one that is
 * briefly missing.
 */

import { describe, expect, it } from "vitest";
import { HIDDEN, isOpen, resolveCompanionAccess } from "./companion-access.js";

describe("resolveCompanionAccess", () => {
  it("is hidden when nothing is known — the default, not an error state", () => {
    expect(resolveCompanionAccess({})).toEqual(HIDDEN);
  });

  it("stays hidden while entitlements are still loading", () => {
    expect(
      resolveCompanionAccess({
        licensedByHospital: undefined,
        bandPaired: undefined,
        purchased: undefined,
      }),
    ).toEqual(HIDDEN);
  });

  it("stays hidden when every door is explicitly closed", () => {
    expect(
      resolveCompanionAccess({ licensedByHospital: false, bandPaired: false, purchased: false }),
    ).toEqual(HIDDEN);
  });

  it("opens when the hospital licensed it", () => {
    expect(resolveCompanionAccess({ licensedByHospital: true })).toEqual({
      state: "open",
      via: "hospital",
    });
  });

  it("opens for a band even with no hospital — the self-serve owner", () => {
    expect(resolveCompanionAccess({ licensedByHospital: false, bandPaired: true })).toEqual({
      state: "open",
      via: "band",
    });
  });

  it("opens on purchase with no hospital and no band", () => {
    expect(resolveCompanionAccess({ purchased: true })).toEqual({
      state: "open",
      via: "purchase",
    });
  });

  it("reports the hospital first when several doors are open, because support asks why", () => {
    expect(
      resolveCompanionAccess({ licensedByHospital: true, bandPaired: true, purchased: true }).state,
    ).toBe("open");
    expect(resolveCompanionAccess({ licensedByHospital: true, bandPaired: true })).toEqual({
      state: "open",
      via: "hospital",
    });
  });

  it("isOpen agrees with the state", () => {
    expect(isOpen(HIDDEN)).toBe(false);
    expect(isOpen(resolveCompanionAccess({ bandPaired: true }))).toBe(true);
  });
});
