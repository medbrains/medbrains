import { api } from "@medbrains/api";

export type CreateVitalInput = Parameters<typeof api.createVital>[1];
export type CreateConsultationInput = Parameters<typeof api.createConsultation>[1];
export type UpdateConsultationInput = Parameters<typeof api.updateConsultation>[2];
export type CreatePrescriptionInput = Parameters<typeof api.createPrescription>[1];
export type ListPharmacyCatalogInput = Parameters<typeof api.listPharmacyCatalog>[0];
export type ListLabCatalogInput = Parameters<typeof api.listLabCatalog>[0];
export type ListLabOrdersInput = Parameters<typeof api.listLabOrders>[0];
export type CreateLabOrderInput = Parameters<typeof api.createLabOrder>[0];
export type ListRadiologyOrdersInput = Parameters<typeof api.listRadiologyOrders>[0];
export type CreateRadiologyOrderInput = Parameters<typeof api.createRadiologyOrder>[0];

export const clinicalService = {
  listVitals: (encounterId: string) => api.listVitals(encounterId),
  createVital: (encounterId: string, data: CreateVitalInput) => api.createVital(encounterId, data),
  getConsultation: (encounterId: string) => api.getConsultation(encounterId),
  createConsultation: (encounterId: string, data: CreateConsultationInput) =>
    api.createConsultation(encounterId, data),
  updateConsultation: (
    encounterId: string,
    consultationId: string,
    data: UpdateConsultationInput,
  ) => api.updateConsultation(encounterId, consultationId, data),
  listDiagnoses: (encounterId: string) => api.listDiagnoses(encounterId),
  listPrescriptions: (encounterId: string) => api.listPrescriptions(encounterId),
  listPharmacyCatalog: (params: ListPharmacyCatalogInput) => api.listPharmacyCatalog(params),
  createPrescription: (encounterId: string, data: CreatePrescriptionInput) =>
    api.createPrescription(encounterId, data),
  listLabCatalog: (params: ListLabCatalogInput) => api.listLabCatalog(params),
  listLabOrders: (params: ListLabOrdersInput) => api.listLabOrders(params),
  getLabOrder: (orderId: string) => api.getLabOrder(orderId),
  createLabOrder: (data: CreateLabOrderInput) => api.createLabOrder(data),
  listRadiologyOrders: (params: ListRadiologyOrdersInput) => api.listRadiologyOrders(params),
  createRadiologyOrder: (data: CreateRadiologyOrderInput) => api.createRadiologyOrder(data),
  listRadiologyModalities: () => api.listRadiologyModalities(),
};
