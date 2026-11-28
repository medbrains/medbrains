/** The `/doctor` API area. Moved from `client.ts`; one module per first path segment. */
import { request } from "../client.js";

export const doctorApi = {
  getStoreSubstitutionRequest: (id: string) =>
    request<import("@medbrains/types").DoctorSubstitutionRequest>(
      `/doctor/store-substitutions/${id}`,
    ),
  decideStoreSubstitution: (
    id: string,
    data: import("@medbrains/types").DoctorSubstitutionDecision,
  ) =>
    request<import("@medbrains/types").DoctorSubstitutionRequest>(
      `/doctor/store-substitutions/${id}/decide`,
      { method: "POST", body: JSON.stringify(data) },
    ),
};
