import { otApi } from "@medbrains/api/modules/ot";

export const otService = {
  listOtRooms: (...args: Parameters<typeof otApi.listOtRooms>) => otApi.listOtRooms(...args),
  getOtSchedule: (...args: Parameters<typeof otApi.getOtSchedule>) => otApi.getOtSchedule(...args),
  listOtBookings: (...args: Parameters<typeof otApi.listOtBookings>) =>
    otApi.listOtBookings(...args),
  createOtBooking: (...args: Parameters<typeof otApi.createOtBooking>) =>
    otApi.createOtBooking(...args),
  getOtBooking: (...args: Parameters<typeof otApi.getOtBooking>) => otApi.getOtBooking(...args),
  getOtBookingConsents: (bookingId: string) => otApi.getOtBookingConsents(bookingId),
  linkOtBookingConsent: (bookingId: string, consentId: string) =>
    otApi.linkOtBookingConsent(bookingId, consentId),
  unlinkOtBookingConsent: (bookingId: string, consentId: string, reason: string) =>
    otApi.unlinkOtBookingConsent(bookingId, consentId, reason),
  certifyOtEmergencyConsent: (bookingId: string, reason?: string) =>
    otApi.certifyOtEmergencyConsent(bookingId, reason),
  updateOtBookingStatus: (...args: Parameters<typeof otApi.updateOtBookingStatus>) =>
    otApi.updateOtBookingStatus(...args),
  listPreopAssessments: (...args: Parameters<typeof otApi.listPreopAssessments>) =>
    otApi.listPreopAssessments(...args),
  createPreopAssessment: (...args: Parameters<typeof otApi.createPreopAssessment>) =>
    otApi.createPreopAssessment(...args),
  updatePreopAssessment: (...args: Parameters<typeof otApi.updatePreopAssessment>) =>
    otApi.updatePreopAssessment(...args),
  getPreopHandoff: (...args: Parameters<typeof otApi.getPreopHandoff>) =>
    otApi.getPreopHandoff(...args),
  upsertPreopHandoff: (...args: Parameters<typeof otApi.upsertPreopHandoff>) =>
    otApi.upsertPreopHandoff(...args),
  getPostopHandoff: (...args: Parameters<typeof otApi.getPostopHandoff>) =>
    otApi.getPostopHandoff(...args),
  upsertPostopHandoff: (...args: Parameters<typeof otApi.upsertPostopHandoff>) =>
    otApi.upsertPostopHandoff(...args),
  listSafetyChecklists: (...args: Parameters<typeof otApi.listSafetyChecklists>) =>
    otApi.listSafetyChecklists(...args),
  createSafetyChecklist: (...args: Parameters<typeof otApi.createSafetyChecklist>) =>
    otApi.createSafetyChecklist(...args),
  updateSafetyChecklist: (...args: Parameters<typeof otApi.updateSafetyChecklist>) =>
    otApi.updateSafetyChecklist(...args),
  getCaseRecord: (...args: Parameters<typeof otApi.getCaseRecord>) => otApi.getCaseRecord(...args),
  createCaseRecord: (...args: Parameters<typeof otApi.createCaseRecord>) =>
    otApi.createCaseRecord(...args),
  getAnesthesiaRecord: (...args: Parameters<typeof otApi.getAnesthesiaRecord>) =>
    otApi.getAnesthesiaRecord(...args),
  createAnesthesiaRecord: (...args: Parameters<typeof otApi.createAnesthesiaRecord>) =>
    otApi.createAnesthesiaRecord(...args),
  getPostopRecord: (...args: Parameters<typeof otApi.getPostopRecord>) =>
    otApi.getPostopRecord(...args),
  createPostopRecord: (...args: Parameters<typeof otApi.createPostopRecord>) =>
    otApi.createPostopRecord(...args),
  updatePostopRecord: (...args: Parameters<typeof otApi.updatePostopRecord>) =>
    otApi.updatePostopRecord(...args),
  createOtRoom: (...args: Parameters<typeof otApi.createOtRoom>) => otApi.createOtRoom(...args),
  listSurgeonPreferences: (...args: Parameters<typeof otApi.listSurgeonPreferences>) =>
    otApi.listSurgeonPreferences(...args),
  createSurgeonPreference: (...args: Parameters<typeof otApi.createSurgeonPreference>) =>
    otApi.createSurgeonPreference(...args),
  otUtilization: (...args: Parameters<typeof otApi.otUtilization>) => otApi.otUtilization(...args),
};
