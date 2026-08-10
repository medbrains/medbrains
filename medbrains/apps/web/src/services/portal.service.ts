/**
 * Patient portal calls.
 *
 * Kept in its own service because every read takes the patient's token
 * explicitly. Folding these in beside the staff services would invite somebody
 * to call one without a token and have it silently use the staff session.
 */

import { api } from "@medbrains/api";

export const portalService = {
  requestPortalOtp: (data: Parameters<typeof api.requestPortalOtp>[0]) =>
    api.requestPortalOtp(data),
  verifyPortalOtp: (data: Parameters<typeof api.verifyPortalOtp>[0]) => api.verifyPortalOtp(data),
  getPortalBills: (token: string) => api.getPortalBills(token),
  getPortalLabReports: (token: string) => api.getPortalLabReports(token),
  getPortalPrescriptions: (token: string) => api.getPortalPrescriptions(token),
  getPortalAppointments: (token: string) => api.getPortalAppointments(token),
};
