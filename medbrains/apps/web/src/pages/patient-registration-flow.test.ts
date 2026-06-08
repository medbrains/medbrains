// @vitest-environment node

import { describe, expect, it } from "vitest";
import { patientRegistrationOpdHandoffRoute } from "./patient-registration-flow";

describe("patient registration OPD handoff route", () => {
  it("lands regular registration on the OPD consultation workspace", () => {
    expect(
      patientRegistrationOpdHandoffRoute({
        encounterId: "encounter-1",
        patientId: "patient-1",
      }),
    ).toBe("/opd/encounters/encounter-1#consultation");
  });

  it("preserves camp context before the consultation hash", () => {
    expect(
      patientRegistrationOpdHandoffRoute({
        campId: "camp-1",
        campRegistrationId: "registration-1",
        encounterId: "encounter-1",
        patientId: "patient-1",
      }),
    ).toBe(
      "/opd/encounters/encounter-1?source=camp&campId=camp-1&registrationId=registration-1#consultation",
    );
  });

  it("keeps a camp source route usable when registration creation succeeded but queue linking is partial", () => {
    expect(
      patientRegistrationOpdHandoffRoute({
        campId: "camp-1",
        encounterId: "encounter-1",
        patientId: "patient-1",
      }),
    ).toBe("/opd/encounters/encounter-1?source=camp&campId=camp-1#consultation");
  });
});
