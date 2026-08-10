import { api } from "@medbrains/api";

export type BookAppointmentInput = Parameters<typeof api.bookAppointment>[0];
export type CancelAppointmentInput = Parameters<typeof api.cancelAppointment>[1];
export type RescheduleAppointmentInput = Parameters<typeof api.rescheduleAppointment>[1];

export const appointmentsService = {
  publicKioskCheckin: (...args: Parameters<typeof api.publicKioskCheckin>) =>
    api.publicKioskCheckin(...args),
  getPublicQueueTokenStatus: (statusToken: string) => api.getPublicQueueTokenStatus(statusToken),
  getPublicBookableDoctors: (tenantCode: string) => api.getPublicBookableDoctors(tenantCode),
  getPublicAppointmentSlots: (params: Parameters<typeof api.getPublicAppointmentSlots>[0]) =>
    api.getPublicAppointmentSlots(params),
  bookPublicAppointment: (data: Parameters<typeof api.bookPublicAppointment>[0]) =>
    api.bookPublicAppointment(data),
  requestPublicBookingOtp: (data: Parameters<typeof api.requestPublicBookingOtp>[0]) =>
    api.requestPublicBookingOtp(data),
  listDepartments: () => api.listDepartments(),
  listSetupUsers: () => api.listSetupUsers(),
  listPatients: (params: Parameters<typeof api.listPatients>[0]) => api.listPatients(params),
  getAvailableSlots: (doctorId: string, date: string) => api.getAvailableSlots(doctorId, date),
  bookAppointment: (data: BookAppointmentInput) => api.bookAppointment(data),
  createEncounter: (...args: Parameters<typeof api.createEncounter>) =>
    api.createEncounter(...args),
  listAppointments: (params?: Parameters<typeof api.listAppointments>[0]) =>
    api.listAppointments(params),
  checkInAppointment: (id: string) => api.checkInAppointment(id),
  completeAppointment: (id: string) => api.completeAppointment(id),
  markAppointmentNoShow: (id: string) => api.markAppointmentNoShow(id),
  cancelAppointment: (id: string, data: CancelAppointmentInput) => api.cancelAppointment(id, data),
  rescheduleAppointment: (id: string, data: RescheduleAppointmentInput) =>
    api.rescheduleAppointment(id, data),
};
