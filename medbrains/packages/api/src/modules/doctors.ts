/** The `/doctors` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  DoctorProfile,
  MyDayResponse,
  PendingSignoffEntry,
  PortalRefillRequest,
  UpdateMyDoctorProfileRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const doctorsApi = {
  getMyDoctorProfile: () => request<DoctorProfile>("/doctors/me/profile"),
  updateMyDoctorProfile: (data: UpdateMyDoctorProfileRequest) =>
    request<DoctorProfile>("/doctors/me/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getMyDay: () => request<MyDayResponse>("/doctors/me/dashboard"),
  getMyPendingSignoffs: () => request<PendingSignoffEntry[]>("/doctors/me/pending-signoffs"),
  /** The prescriber approves (it goes to the pharmacy) or declines a patient's refill request. */
  decideRefillRequest: (requestId: string, data: { approve: boolean; note?: string }) =>
    request<PortalRefillRequest>(`/doctors/me/refill-requests/${requestId}/decide`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
