// @vitest-environment node

import { describe, expect, it } from "vitest";
import { patientDetailTabForOrderBasket } from "./patient-detail-workspace";

describe("patient-detail workspace routing", () => {
  it("routes local order basket actions to the matching patient tabs", () => {
    expect(patientDetailTabForOrderBasket("drug")).toBe("prescriptions");
    expect(patientDetailTabForOrderBasket("lab")).toBe("lab");
    expect(patientDetailTabForOrderBasket("radiology")).toBe("imaging");
  });
});
