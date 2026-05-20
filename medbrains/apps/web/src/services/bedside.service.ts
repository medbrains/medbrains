import { api } from "@medbrains/api";

export const bedsideService = {
  getBedsideDailySchedule: (...args: Parameters<typeof api.getBedsideDailySchedule>) =>
    api.getBedsideDailySchedule(...args),
  getBedsideMedications: (...args: Parameters<typeof api.getBedsideMedications>) =>
    api.getBedsideMedications(...args),
  getBedsideVitals: (...args: Parameters<typeof api.getBedsideVitals>) =>
    api.getBedsideVitals(...args),
  listBedsideVideos: (...args: Parameters<typeof api.listBedsideVideos>) =>
    api.listBedsideVideos(...args),
  listBedsideFeedback: (...args: Parameters<typeof api.listBedsideFeedback>) =>
    api.listBedsideFeedback(...args),
  createBedsideNurseRequest: (...args: Parameters<typeof api.createBedsideNurseRequest>) =>
    api.createBedsideNurseRequest(...args),
  submitBedsideFeedback: (...args: Parameters<typeof api.submitBedsideFeedback>) =>
    api.submitBedsideFeedback(...args),
  getBedsideLabResults: (...args: Parameters<typeof api.getBedsideLabResults>) =>
    api.getBedsideLabResults(...args),
};
