import { api } from "@medbrains/api";

export const otService = {
  listOtRooms: (...args: Parameters<typeof api.listOtRooms>) => api.listOtRooms(...args),
  getOtSchedule: (...args: Parameters<typeof api.getOtSchedule>) => api.getOtSchedule(...args),
  listOtBookings: (...args: Parameters<typeof api.listOtBookings>) => api.listOtBookings(...args),
  createOtBooking: (...args: Parameters<typeof api.createOtBooking>) =>
    api.createOtBooking(...args),
  getOtBooking: (...args: Parameters<typeof api.getOtBooking>) => api.getOtBooking(...args),
  updateOtBookingStatus: (...args: Parameters<typeof api.updateOtBookingStatus>) =>
    api.updateOtBookingStatus(...args),
  listPreopAssessments: (...args: Parameters<typeof api.listPreopAssessments>) =>
    api.listPreopAssessments(...args),
  createPreopAssessment: (...args: Parameters<typeof api.createPreopAssessment>) =>
    api.createPreopAssessment(...args),
  updatePreopAssessment: (...args: Parameters<typeof api.updatePreopAssessment>) =>
    api.updatePreopAssessment(...args),
  getPreopHandoff: (...args: Parameters<typeof api.getPreopHandoff>) =>
    api.getPreopHandoff(...args),
  upsertPreopHandoff: (...args: Parameters<typeof api.upsertPreopHandoff>) =>
    api.upsertPreopHandoff(...args),
  getPostopHandoff: (...args: Parameters<typeof api.getPostopHandoff>) =>
    api.getPostopHandoff(...args),
  upsertPostopHandoff: (...args: Parameters<typeof api.upsertPostopHandoff>) =>
    api.upsertPostopHandoff(...args),
  listSafetyChecklists: (...args: Parameters<typeof api.listSafetyChecklists>) =>
    api.listSafetyChecklists(...args),
  createSafetyChecklist: (...args: Parameters<typeof api.createSafetyChecklist>) =>
    api.createSafetyChecklist(...args),
  updateSafetyChecklist: (...args: Parameters<typeof api.updateSafetyChecklist>) =>
    api.updateSafetyChecklist(...args),
  getCaseRecord: (...args: Parameters<typeof api.getCaseRecord>) => api.getCaseRecord(...args),
  createCaseRecord: (...args: Parameters<typeof api.createCaseRecord>) =>
    api.createCaseRecord(...args),
  getAnesthesiaRecord: (...args: Parameters<typeof api.getAnesthesiaRecord>) =>
    api.getAnesthesiaRecord(...args),
  createAnesthesiaRecord: (...args: Parameters<typeof api.createAnesthesiaRecord>) =>
    api.createAnesthesiaRecord(...args),
  getPostopRecord: (...args: Parameters<typeof api.getPostopRecord>) =>
    api.getPostopRecord(...args),
  createPostopRecord: (...args: Parameters<typeof api.createPostopRecord>) =>
    api.createPostopRecord(...args),
  updatePostopRecord: (...args: Parameters<typeof api.updatePostopRecord>) =>
    api.updatePostopRecord(...args),
  createOtRoom: (...args: Parameters<typeof api.createOtRoom>) => api.createOtRoom(...args),
  listSurgeonPreferences: (...args: Parameters<typeof api.listSurgeonPreferences>) =>
    api.listSurgeonPreferences(...args),
  createSurgeonPreference: (...args: Parameters<typeof api.createSurgeonPreference>) =>
    api.createSurgeonPreference(...args),
  otUtilization: (...args: Parameters<typeof api.otUtilization>) => api.otUtilization(...args),
};
