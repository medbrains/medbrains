import { api } from "@medbrains/api";

export const bedsideService = {
  listBedsideSessions: (...args: Parameters<typeof api.listBedsideSessions>) =>
    api.listBedsideSessions(...args),
  createBedsideSession: (...args: Parameters<typeof api.createBedsideSession>) =>
    api.createBedsideSession(...args),
  endBedsideSession: (...args: Parameters<typeof api.endBedsideSession>) =>
    api.endBedsideSession(...args),
  getBedsideDailySchedule: (...args: Parameters<typeof api.getBedsideDailySchedule>) =>
    api.getBedsideDailySchedule(...args),
  getBedsideMedications: (...args: Parameters<typeof api.getBedsideMedications>) =>
    api.getBedsideMedications(...args),
  getBedsideVitals: (...args: Parameters<typeof api.getBedsideVitals>) =>
    api.getBedsideVitals(...args),
  listBedsideVideos: (...args: Parameters<typeof api.listBedsideVideos>) =>
    api.listBedsideVideos(...args),
  createBedsideVideo: (...args: Parameters<typeof api.createBedsideVideo>) =>
    api.createBedsideVideo(...args),
  updateBedsideVideo: (...args: Parameters<typeof api.updateBedsideVideo>) =>
    api.updateBedsideVideo(...args),
  listBedsideFeedback: (...args: Parameters<typeof api.listBedsideFeedback>) =>
    api.listBedsideFeedback(...args),
  createBedsideNurseRequest: (...args: Parameters<typeof api.createBedsideNurseRequest>) =>
    api.createBedsideNurseRequest(...args),
  listBedsideNurseRequests: (...args: Parameters<typeof api.listBedsideNurseRequests>) =>
    api.listBedsideNurseRequests(...args),
  updateBedsideRequestStatus: (...args: Parameters<typeof api.updateBedsideRequestStatus>) =>
    api.updateBedsideRequestStatus(...args),
  submitBedsideFeedback: (...args: Parameters<typeof api.submitBedsideFeedback>) =>
    api.submitBedsideFeedback(...args),
  getBedsideLabResults: (...args: Parameters<typeof api.getBedsideLabResults>) =>
    api.getBedsideLabResults(...args),
  getBedsideDietOrder: (...args: Parameters<typeof api.getBedsideDietOrder>) =>
    api.getBedsideDietOrder(...args),
};
