// @vitest-environment node

import { tvDisplayTypeValues } from "@medbrains/schemas";
import { TOKEN_BOARD_SURFACE_LIST, TOKEN_BOARD_SURFACES } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  defaultTvDisplayFormValues,
  tvDisplayAllowsPatientNames,
  tvDisplayFormToCreateRequest,
  tvDisplayFormToUpdateRequest,
} from "./tv-displays.form";

describe("tv display form privacy conversion", () => {
  it("accepts every shared token-board TV display type as token-only", () => {
    const allowedDisplayTypes = new Set<string>(tvDisplayTypeValues);

    for (const surface of TOKEN_BOARD_SURFACE_LIST) {
      expect(allowedDisplayTypes.has(surface.targets.tvDisplayType)).toBe(true);
      expect(tvDisplayAllowsPatientNames(surface.targets.tvDisplayType)).toBe(false);
    }
  });

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
