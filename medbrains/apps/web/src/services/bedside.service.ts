import { bedsideApi } from "@medbrains/api/modules/bedside";

export const bedsideService = {
  listBedsideSessions: (...args: Parameters<typeof bedsideApi.listBedsideSessions>) =>
    bedsideApi.listBedsideSessions(...args),
  createBedsideSession: (...args: Parameters<typeof bedsideApi.createBedsideSession>) =>
    bedsideApi.createBedsideSession(...args),
  endBedsideSession: (...args: Parameters<typeof bedsideApi.endBedsideSession>) =>
    bedsideApi.endBedsideSession(...args),
  getBedsideDailySchedule: (...args: Parameters<typeof bedsideApi.getBedsideDailySchedule>) =>
    bedsideApi.getBedsideDailySchedule(...args),
  getBedsideMedications: (...args: Parameters<typeof bedsideApi.getBedsideMedications>) =>
    bedsideApi.getBedsideMedications(...args),
  getBedsideVitals: (...args: Parameters<typeof bedsideApi.getBedsideVitals>) =>
    bedsideApi.getBedsideVitals(...args),
  listBedsideVideos: (...args: Parameters<typeof bedsideApi.listBedsideVideos>) =>
    bedsideApi.listBedsideVideos(...args),
  createBedsideVideo: (...args: Parameters<typeof bedsideApi.createBedsideVideo>) =>
    bedsideApi.createBedsideVideo(...args),
  updateBedsideVideo: (...args: Parameters<typeof bedsideApi.updateBedsideVideo>) =>
    bedsideApi.updateBedsideVideo(...args),
  listBedsideFeedback: (...args: Parameters<typeof bedsideApi.listBedsideFeedback>) =>
    bedsideApi.listBedsideFeedback(...args),
  createBedsideNurseRequest: (...args: Parameters<typeof bedsideApi.createBedsideNurseRequest>) =>
    bedsideApi.createBedsideNurseRequest(...args),
  listBedsideNurseRequests: (...args: Parameters<typeof bedsideApi.listBedsideNurseRequests>) =>
    bedsideApi.listBedsideNurseRequests(...args),
  updateBedsideRequestStatus: (...args: Parameters<typeof bedsideApi.updateBedsideRequestStatus>) =>
    bedsideApi.updateBedsideRequestStatus(...args),
  submitBedsideFeedback: (...args: Parameters<typeof bedsideApi.submitBedsideFeedback>) =>
    bedsideApi.submitBedsideFeedback(...args),
  getBedsideLabResults: (...args: Parameters<typeof bedsideApi.getBedsideLabResults>) =>
    bedsideApi.getBedsideLabResults(...args),
  getBedsideDietOrder: (...args: Parameters<typeof bedsideApi.getBedsideDietOrder>) =>
    bedsideApi.getBedsideDietOrder(...args),
};
