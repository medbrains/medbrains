/** The `/patient-packages` API area. Moved from `client.ts`; one module per first path segment. */
import type { ConsumeRequest, SubscribeRequest, SubscriptionWithBalance } from "@medbrains/types";
import { request } from "../client.js";

export const patientPackagesApi = {
  // Patient Packages
  subscribeToPackage: (data: SubscribeRequest) =>
    request<{ id: string; status: string }>("/patient-packages/subscribe", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listPatientPackages: (patientId: string) =>
    request<SubscriptionWithBalance[]>(
      `/patient-packages/patient/${encodeURIComponent(patientId)}`,
    ),
  consumePackage: (subscriptionId: string, data: ConsumeRequest) =>
    request<{ consumption_id: string; remaining_after: number }>(
      `/patient-packages/${encodeURIComponent(subscriptionId)}/consume`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  refundPackage: (subscriptionId: string) =>
    request<{ refunded: boolean }>(
      `/patient-packages/${encodeURIComponent(subscriptionId)}/refund`,
      { method: "POST" },
    ),
};
