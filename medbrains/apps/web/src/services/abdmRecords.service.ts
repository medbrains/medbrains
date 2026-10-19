import { api } from "@medbrains/api";

/** ABDM records shared as a Health Information Provider. */
export const abdmRecordsService = {
  patientRecords: (patientId: string) => api.getAbdmPatientRecords(patientId),
  link: (careContextId: string) => api.linkAbdmCareContext(careContextId),
  sharingSummary: (month?: string) => api.getAbdmSharingSummary(month),
};
