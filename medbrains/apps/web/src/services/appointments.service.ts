import { opdApi } from "@medbrains/api/modules/opd";
import { patientsApi } from "@medbrains/api/modules/patients";
import { publicApi } from "@medbrains/api/modules/public";
import { setupApi } from "@medbrains/api/modules/setup";

export type BookAppointmentInput = Parameters<typeof opdApi.bookAppointment>[0];
export type CancelAppointmentInput = Parameters<typeof opdApi.cancelAppointment>[1];
export type RescheduleAppointmentInput = Parameters<typeof opdApi.rescheduleAppointment>[1];

export const appointmentsService = {
  publicKioskCheckin: (...args: Parameters<typeof publicApi.publicKioskCheckin>) =>
    publicApi.publicKioskCheckin(...args),
  getPublicQueueTokenStatus: (statusToken: string) =>
    publicApi.getPublicQueueTokenStatus(statusToken),
  getPublicBookableDoctors: (tenantCode: string) => publicApi.getPublicBookableDoctors(tenantCode),
  getPublicAppointmentSlots: (params: Parameters<typeof publicApi.getPublicAppointmentSlots>[0]) =>
    publicApi.getPublicAppointmentSlots(params),
  bookPublicAppointment: (data: Parameters<typeof publicApi.bookPublicAppointment>[0]) =>
    publicApi.bookPublicAppointment(data),
  requestPublicBookingOtp: (data: Parameters<typeof publicApi.requestPublicBookingOtp>[0]) =>
    publicApi.requestPublicBookingOtp(data),
  listDepartments: () => setupApi.listDepartments(),
  listSetupUsers: () => setupApi.listSetupUsers(),
  listPatients: (params: Parameters<typeof patientsApi.listPatients>[0]) =>
    patientsApi.listPatients(params),
  getAvailableSlots: (doctorId: string, date: string) => opdApi.getAvailableSlots(doctorId, date),
  bookAppointment: (data: BookAppointmentInput) => opdApi.bookAppointment(data),
  createEncounter: (...args: Parameters<typeof opdApi.createEncounter>) =>
    opdApi.createEncounter(...args),
  listAppointments: (params?: Parameters<typeof opdApi.listAppointments>[0]) =>
    opdApi.listAppointments(params),
  checkInAppointment: (id: string) => opdApi.checkInAppointment(id),
  completeAppointment: (id: string) => opdApi.completeAppointment(id),
  markAppointmentNoShow: (id: string) => opdApi.markAppointmentNoShow(id),
  cancelAppointment: (id: string, data: CancelAppointmentInput) =>
    opdApi.cancelAppointment(id, data),
  rescheduleAppointment: (id: string, data: RescheduleAppointmentInput) =>
    opdApi.rescheduleAppointment(id, data),
};
