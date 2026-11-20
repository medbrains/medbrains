import { campApi } from "@medbrains/api/modules/camp";
import { marketingApi } from "@medbrains/api/modules/marketing";
import { patientsApi } from "@medbrains/api/modules/patients";
import { printDataApi } from "@medbrains/api/modules/print-data";
import { setupApi } from "@medbrains/api/modules/setup";

export type CreatePatientInput = Parameters<typeof patientsApi.createPatient>[0];
export type ListPatientsInput = Parameters<typeof patientsApi.listPatients>[0];
export type ListCampsInput = Parameters<typeof campApi.listCamps>[0];

export const patientsService = {
  getPatientCardPrintData: (...args: Parameters<typeof printDataApi.getPatientCardPrintData>) =>
    printDataApi.getPatientCardPrintData(...args),
  listPatients: (params: ListPatientsInput) => patientsApi.listPatients(params),
  getPatient: (...args: Parameters<typeof patientsApi.getPatient>) =>
    patientsApi.getPatient(...args),
  getPatientContext: (...args: Parameters<typeof patientsApi.getPatientContext>) =>
    patientsApi.getPatientContext(...args),
  createPatient: (data: CreatePatientInput) => patientsApi.createPatient(data),
  transliterateName: (text: string, to: string) => patientsApi.transliterateName(text, to),
  updatePatient: (...args: Parameters<typeof patientsApi.updatePatient>) =>
    patientsApi.updatePatient(...args),
  matchPatients: (...args: Parameters<typeof patientsApi.matchPatients>) =>
    patientsApi.matchPatients(...args),
  completePatientRegistration: (id: string) => patientsApi.completePatientRegistration(id),
  listDepartments: () => setupApi.listDepartments(),
  listDoctors: () => setupApi.listDoctors(),
  listCamps: (params?: ListCampsInput) => campApi.listCamps(params),
  lookupMarketingCampaigns: () => marketingApi.lookupMarketingCampaigns(),
  getPatientAcquisition: (patientId: string) => patientsApi.getPatientAcquisition(patientId),
  correctPatientAcquisition: (...args: Parameters<typeof patientsApi.correctPatientAcquisition>) =>
    patientsApi.correctPatientAcquisition(...args),
  listFacilities: () => setupApi.listFacilities(),
};
