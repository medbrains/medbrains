/** The `/registration` API area: the hospital OPD number policy and the next number. */
import type { OpdNumberPolicy, OpdNumberView } from "@medbrains/types";
import { request } from "../client.js";

export const registrationApi = {
  getOpdNumber: () => request<OpdNumberView>("/registration/opd-number"),
  updateOpdNumberPolicy: (data: OpdNumberPolicy) =>
    request<OpdNumberView>("/registration/opd-number/policy", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
