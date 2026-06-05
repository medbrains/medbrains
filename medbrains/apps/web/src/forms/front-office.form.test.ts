// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISPLAY_CONFIG_FORM_VALUES,
  frontOfficeDisplayAllowsPatientNames,
  toUpsertDisplayConfigRequest,
} from "./front-office.form";

describe("front-office display config privacy conversion", () => {
  it("forces waiting-area and counter displays to token-only patient-name visibility", () => {
    for (const displayType of ["waiting_area", "counter"]) {
      const request = toUpsertDisplayConfigRequest({
        ...DEFAULT_DISPLAY_CONFIG_FORM_VALUES,
        display_type: displayType,
        show_patient_name: true,
      });

      expect(frontOfficeDisplayAllowsPatientNames(displayType)).toBe(false);
      expect(request.show_patient_name).toBe(false);
    }
  });

  it("keeps doctor-room displays eligible for controlled patient-name visibility", () => {
    const request = toUpsertDisplayConfigRequest({
      ...DEFAULT_DISPLAY_CONFIG_FORM_VALUES,
      display_type: "doctor_room",
      show_patient_name: true,
    });

    expect(frontOfficeDisplayAllowsPatientNames("doctor_room")).toBe(true);
    expect(request.show_patient_name).toBe(true);
  });
});
