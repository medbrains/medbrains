import { api } from "@medbrains/api";
import type { RaiseAbdmConsentRequest } from "@medbrains/types";

/** ABDM records shared as a Health Information Provider, and received as a User. */
export const abdmRecordsService = {
  patientRecords: (patientId: string) => api.getAbdmPatientRecords(patientId),
  link: (careContextId: string) => api.linkAbdmCareContext(careContextId),
  sharingSummary: (month?: string) => api.getAbdmSharingSummary(month),
  raiseConsentRequest: (patientId: string, data: RaiseAbdmConsentRequest) =>
    api.raiseAbdmConsentRequest(patientId, data),
  receivedRecords: (patientId: string) => api.getAbdmReceivedRecords(patientId),
  receivedRecord: (id: string) => api.getAbdmReceivedRecord(id),
};
