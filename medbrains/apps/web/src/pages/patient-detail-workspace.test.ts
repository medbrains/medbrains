// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  isPatientDetailTabValue,
  patientDetailOrderBasketRoute,
  patientDetailOrderBasketTabFromSearchParams,
  patientDetailTabForOrderBasket,
  patientDetailWorkspaceTabRoute,
} from "./patient-detail-workspace";

describe("patient-detail workspace routing", () => {
  it("routes local order basket actions to the matching patient tabs", () => {
    expect(patientDetailTabForOrderBasket("drug")).toBe("prescriptions");
    expect(patientDetailTabForOrderBasket("lab")).toBe("lab");
    expect(patientDetailTabForOrderBasket("radiology")).toBe("imaging");
  });

  it("keeps patient order basket activation route-addressable", () => {
    expect(patientDetailOrderBasketRoute("patient-1", "drug")).toBe(
      "/patients/patient-1?order=drug#prescriptions",
    );
    expect(patientDetailOrderBasketRoute("patient-1", "lab")).toBe(
      "/patients/patient-1?order=lab#lab",
    );
    expect(patientDetailOrderBasketRoute("patient-1", "radiology")).toBe(
      "/patients/patient-1?order=radiology#imaging",
    );
    expect(patientDetailWorkspaceTabRoute("patient-1", "billing")).toBe(
      "/patients/patient-1#billing",
    );
  });

  it("parses only supported order basket tabs from patient routes", () => {
    expect(patientDetailOrderBasketTabFromSearchParams(new URLSearchParams("order=drug"))).toBe(
      "drug",
    );
    expect(
      patientDetailOrderBasketTabFromSearchParams(new URLSearchParams("order=radiology")),
    ).toBe("radiology");
    expect(patientDetailOrderBasketTabFromSearchParams(new URLSearchParams("order=notes"))).toBe(
      null,
    );
    expect(patientDetailOrderBasketTabFromSearchParams(new URLSearchParams("tab=lab"))).toBe(null);
  });

  it("guards supported patient workspace tab hashes", () => {
    expect(isPatientDetailTabValue("overview")).toBe(true);
    expect(isPatientDetailTabValue("billing")).toBe(true);
    expect(isPatientDetailTabValue("unknown")).toBe(false);
    expect(isPatientDetailTabValue(null)).toBe(false);
  });
});
