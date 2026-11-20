import { abdmApi } from "@medbrains/api/modules/abdm";
import type { RaiseAbdmConsentRequest } from "@medbrains/types";

/** ABDM records shared as a Health Information Provider, and received as a User. */
export const abdmRecordsService = {
  patientRecords: (patientId: string) => abdmApi.getAbdmPatientRecords(patientId),
  link: (careContextId: string) => abdmApi.linkAbdmCareContext(careContextId),
  sendSmsLink: (patientId: string) => abdmApi.sendAbdmSmsLink(patientId),
  sharingSummary: (month?: string) => abdmApi.getAbdmSharingSummary(month),
  dashboard: (month?: string) => abdmApi.getAbdmDashboard(month),
  raiseConsentRequest: (patientId: string, data: RaiseAbdmConsentRequest) =>
    abdmApi.raiseAbdmConsentRequest(patientId, data),
  checkConsentStatus: (id: string) => abdmApi.checkAbdmConsentRequestStatus(id),
  receivedRecords: (patientId: string) => abdmApi.getAbdmReceivedRecords(patientId),
  receivedRecord: (id: string) => abdmApi.getAbdmReceivedRecord(id),
};
