import { api } from "@medbrains/api";

export type UpdatePatientInput = Parameters<typeof api.updatePatient>[1];
export type ListPatientsInput = Parameters<typeof api.listPatients>[0];
export type ListAdmissionsInput = Parameters<typeof api.listAdmissions>[0];
export type ListBillingInvoicesInput = Parameters<typeof api.listInvoices>[0];
export type ListCampRegistrationsInput = Parameters<typeof api.listCampRegistrations>[0];
export type ListErVisitsInput = Parameters<typeof api.listErVisits>[0];
export type CancelAppointmentInput = Parameters<typeof api.cancelAppointment>[1];
export type WaitEstimateInput = Parameters<typeof api.getWaitEstimate>[0];

export const patientService = {
  getPatient: (patientId: string) => api.getPatient(patientId),
  updatePatient: (patientId: string, data: UpdatePatientInput) =>
    api.updatePatient(patientId, data),
  listPatientVisits: (patientId: string) => api.listPatientVisits(patientId),
  listPatientAllergies: (patientId: string) => api.listPatientAllergies(patientId),
  listPatientLabOrders: (patientId: string) => api.listPatientLabOrders(patientId),
  listPatientInvoices: (patientId: string) => api.listPatientInvoices(patientId),
  listBillingInvoices: (params?: ListBillingInvoicesInput) => api.listInvoices(params),
  listPatientAppointments: (patientId: string) => api.listPatientAppointments(patientId),
  listPatientPrescriptions: (patientId: string) => api.listPatientPrescriptions(patientId),
  listAdmissions: (params?: ListAdmissionsInput) => api.listAdmissions(params),
  listCampRegistrations: (params: ListCampRegistrationsInput) => api.listCampRegistrations(params),
  createCampRegistration: (data: Parameters<typeof api.createCampRegistration>[0]) =>
    api.createCampRegistration(data),
  listCamps: (params?: Parameters<typeof api.listCamps>[0]) => api.listCamps(params),
  listErVisits: (params?: ListErVisitsInput) => api.listErVisits(params),
  listPatients: (params: ListPatientsInput) => api.listPatients(params),
  getAppointment: (appointmentId: string) => api.getAppointment(appointmentId),
  getWaitEstimate: (params: WaitEstimateInput) => api.getWaitEstimate(params),
  cancelAppointment: (appointmentId: string, data: CancelAppointmentInput) =>
    api.cancelAppointment(appointmentId, data),
};
