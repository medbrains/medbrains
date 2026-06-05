// @vitest-environment node

import { TOKEN_BOARD_SURFACES } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  defaultTvDisplayFormValues,
  tvDisplayAllowsPatientNames,
  tvDisplayFormToCreateRequest,
  tvDisplayFormToUpdateRequest,
} from "./tv-displays.form";

describe("tv display form privacy conversion", () => {
  it("forces public token-board display types to token-only patient-name visibility", () => {
    const request = tvDisplayFormToCreateRequest({
      ...defaultTvDisplayFormValues,
      display_type: TOKEN_BOARD_SURFACES.opd.targets.tvDisplayType,
      show_patient_name: true,
    });

    expect(tvDisplayAllowsPatientNames(TOKEN_BOARD_SURFACES.opd.targets.tvDisplayType)).toBe(false);
    expect(request.show_patient_name).toBe(false);
  });

  it("keeps controlled non-token displays eligible for patient-name visibility", () => {
    const request = tvDisplayFormToUpdateRequest({
      ...defaultTvDisplayFormValues,
      display_type: "dashboard",
      show_patient_name: true,
    });

    expect(tvDisplayAllowsPatientNames("dashboard")).toBe(true);
    expect(request.show_patient_name).toBe(true);
  });
});
