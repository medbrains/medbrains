/** The `/registration` API area: the hospital OPD number policy and the next number. */
import type {
  OpdNumberPolicy,
  OpdNumberView,
  PatientSearchBy,
  PatientSearchSettings,
} from "@medbrains/types";
import { request } from "../client.js";

export const registrationApi = {
  getOpdNumber: () => request<OpdNumberView>("/registration/opd-number"),
  updateOpdNumberPolicy: (data: OpdNumberPolicy) =>
    request<OpdNumberView>("/registration/opd-number/policy", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getSearchSettings: () => request<PatientSearchSettings>("/registration/search-settings"),
  updateSearchSettings: (data: { default_by: PatientSearchBy }) =>
    request<PatientSearchSettings>("/registration/search-settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
