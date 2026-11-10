import { describe, expect, it } from "vitest";
import { fhirGuide } from "./fhir-capability";

describe("fhirGuide", () => {
  it("names the NRCeS IG and release the server declares", () => {
    expect(
      fhirGuide({
        implementationGuide: ["https://nrces.in/ndhm/fhir/r4/ImplementationGuide/ndhm.in|6.5.0"],
      }),
    ).toBe("ndhm.in 6.5.0");
  });

  it("reports no guide rather than inventing one", () => {
    expect(fhirGuide({ resourceType: "CapabilityStatement" })).toBeNull();
    expect(fhirGuide({ implementationGuide: [""] })).toBeNull();
    expect(fhirGuide(null)).toBeNull();
  });
});
