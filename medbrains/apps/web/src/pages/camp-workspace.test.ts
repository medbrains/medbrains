// @vitest-environment node

import { inferClinicalJourneyEventNames, patientJourneyActionRoute } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  activeCampRegistrationIdForJourney,
  campJourneyContext,
  campWorkDefaultTab,
  campWorkTabFromString,
} from "./camp-workspace";

describe("camp workspace tab routing", () => {
  it("normalizes valid work tab values and rejects unknown hashes", () => {
    expect(campWorkTabFromString("registrations")).toBe("registrations");
    expect(campWorkTabFromString("screenings")).toBe("screenings");
    expect(campWorkTabFromString("followups")).toBe("followups");
    expect(campWorkTabFromString("analytics")).toBe("analytics");
    expect(campWorkTabFromString("unknown")).toBeNull();
  });

  it("defaults registration clinical routes to screening", () => {
    expect(campWorkDefaultTab("registrations", "registration-1")).toBe("screenings");
    expect(campWorkDefaultTab("analytics")).toBe("analytics");
    expect(campWorkDefaultTab("unknown")).toBe("registrations");
  });

  it("selects patient camp registration context for journey handoffs", () => {
    expect(
      activeCampRegistrationIdForJourney(
        [
          { id: "no-show", status: "no_show" },
          { id: "registered", status: "registered" },
        ],
        null,
      ),
    ).toBe("registered");
    expect(
      activeCampRegistrationIdForJourney(
        [{ id: "registered", status: "registered" }],
        "focused-registration",
      ),
    ).toBe("focused-registration");
    expect(activeCampRegistrationIdForJourney([{ id: "no-show", status: "no_show" }])).toBeNull();
  });

  it("preserves active camp and registration context for patient handoffs", () => {
    const context = campJourneyContext({
      patientId: "patient-1",
      activeCampId: "camp-1",
      activeCampRegistrationId: "registration-1",
      completedEvents: ["camp.screening.completed"],
    });

    expect(context).toMatchObject({
      patientId: "patient-1",
      activeCampId: "camp-1",
      activeCampRegistrationId: "registration-1",
      completedEvents: ["camp.screening.completed"],
    });
    expect(inferClinicalJourneyEventNames(context)).toEqual([
      "camp.screening.completed",
      "patient.created",
      "camp.started",
      "camp.registration.created",
    ]);
    expect(patientJourneyActionRoute("camp.open_context", context)).toBe(
      "/camp/camp-1/work/registrations/registration-1/clinical-route?patient_id=patient-1#screenings",
    );
  });
});
