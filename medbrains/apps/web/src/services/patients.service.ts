import { api } from "@medbrains/api";

export type CreatePatientInput = Parameters<typeof api.createPatient>[0];
export type ListPatientsInput = Parameters<typeof api.listPatients>[0];
export type ListCampsInput = Parameters<typeof api.listCamps>[0];

export const patientsService = {
  getPatientCardPrintData: (...args: Parameters<typeof api.getPatientCardPrintData>) =>
    api.getPatientCardPrintData(...args),
  listPatients: (params: ListPatientsInput) => api.listPatients(params),
  getPatient: (...args: Parameters<typeof api.getPatient>) => api.getPatient(...args),
  getPatientContext: (...args: Parameters<typeof api.getPatientContext>) =>
    api.getPatientContext(...args),
  createPatient: (data: CreatePatientInput) => api.createPatient(data),
  updatePatient: (...args: Parameters<typeof api.updatePatient>) => api.updatePatient(...args),
  matchPatients: (...args: Parameters<typeof api.matchPatients>) => api.matchPatients(...args),
  listDepartments: () => api.listDepartments(),
  listDoctors: () => api.listDoctors(),
  listCamps: (params?: ListCampsInput) => api.listCamps(params),
  listFacilities: () => api.listFacilities(),
};
